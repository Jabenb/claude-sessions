import type { EngineInterface, Register } from 'claude-code'

import type { PageAction, PageState } from './contract'
import { EMPTY, FTS_RUNNING, ftsOf, MOD, parseAction, parseIndex, parseSemantic, parseState, READER_RUNNING, readerOf, semanticPrompt, usdOf } from './model'
import { PAGE } from './page/page'

const SCOPE = 'global'
const TITLE = 'Сессии'
const ICON = '🗂'
const COMMAND = 'sessions'
const PULL_WAIT_MS = 5000
const PULL_STUCK_MS = PULL_WAIT_MS + 10_000
const INDEX_EVERY_MS = 15_000
/** One session indexes for all: the one holding the lock, taken over when its holder has not renewed it for this long. */
const LEADER_STALE_MS = 45_000
const INDEX_TIMEOUT_MS = 300_000
const SEARCH_TIMEOUT_MS = 120_000

/** One load of this module: the hub hands the page's presses to the newest load only, and the index lock names it. */
const LISTENER = `${Date.now()}-${Math.random().toString(36).slice(2)}`

/** This load's own values; a reload runs `register` again and starts them over. */
let listening = { since: 0, isFirst: true, isStale: false }
let indexing = false
let lastSessions = ''
let model = EMPTY.semanticModel
let queue: Promise<unknown> = Promise.resolve()

/** Writes to the page run one at a time: each reads what the one before it left. */
const serial = <T>(work: () => Promise<T>): Promise<T> => {
  const run = queue.then(work, work)
  queue = run.catch(() => undefined)

  return run
}

const configDir = async ($: EngineInterface): Promise<string> => (await $.env.get('CLAUDE_CONFIG_DIR')) ?? `${(await $.env.get('HOME')) ?? ''}/.claude`
const dataDir = async ($: EngineInterface): Promise<string> => `${await configDir($)}/mods-data/${MOD}`

/** Runs the reader of the chat files (hooks/sessions.py) and gives its output, or why it failed. */
const reader = async ($: EngineInterface, args: string[], timeoutMs: number): Promise<{ stdout: string; failure: string }> => {
  try {
    const ran = await $.process.run(['python3', '-I', `${$.plugin.root}/hooks/sessions.py`, ...args, '--config', await configDir($)], { timeoutMs })

    if (ran.exitCode !== 0) {
      return { stdout: '', failure: ran.stderr.trim().split('\n').at(-1) ?? `exit ${ran.exitCode}` }
    }

    return ran.isStdoutTruncated ? { stdout: '', failure: 'the answer is over 4 MiB' } : { stdout: ran.stdout, failure: '' }
  } catch (error) {
    return { stdout: '', failure: error instanceof Error ? error.message : String(error) }
  }
}

/** Puts a change on the page over what the hub holds now: other sessions of the mod write to the same page. */
const publish = ($: EngineInterface, change: (held: PageState) => PageState | null): Promise<void> =>
  serial(async () => {
    const { state } = await $.webhub.read({ mod: MOD, scope: SCOPE })
    const next = change(parseState(state))

    if (next !== null) {
      await $.webhub.push({ mod: MOD, scope: SCOPE, state: next, badge: 0 })
    }
  })

const show = async ($: EngineInterface): Promise<{ isUp: boolean; url: string }> => $.webhub.page({ mod: MOD, scope: SCOPE, title: TITLE, html: PAGE, icon: ICON })

/** Whether this load may index now: it holds the lock, or the one who held it went quiet. Taking or renewing it is a write. */
const isLeader = async ($: EngineInterface): Promise<boolean> => {
  const lock = `${await dataDir($)}/leader.json`
  const now = await $.clock.now()

  try {
    if (await $.fs.exists(lock)) {
      const held = JSON.parse(String(await $.fs.read(lock))) as { owner?: unknown; at?: unknown }

      if (held.owner !== LISTENER && typeof held.at === 'number' && now - held.at < LEADER_STALE_MS) {
        return false
      }
    }
  } catch {
    // An unreadable lock is taken over.
  }

  await $.fs.write(lock, JSON.stringify({ owner: LISTENER, at: now }))

  return true
}

/** Indexes the chat files and puts the sessions on the page when they changed. */
const refresh = async ($: EngineInterface, isForced: boolean): Promise<void> => {
  if (indexing || (!isForced && !(await isLeader($)))) {
    return
  }

  indexing = true

  try {
    const { stdout, failure } = await reader($, ['index', '--cache', `${await dataDir($)}/cache.json`], INDEX_TIMEOUT_MS)
    const index = parseIndex(stdout)

    if (index === null) {
      $.ui.status(`sessions: ${failure === '' ? 'no index' : failure}`)

      return
    }

    $.ui.status(undefined)
    const sessions = JSON.stringify(index.sessions)
    const host = await hostName($)

    await publish($, held => {
      if (!isForced && sessions === lastSessions && !held.isIndexing && held.sessions.length === index.sessions.length && held.host === host) {
        return null
      }

      return { ...held, host, at: index.at, keepDays: index.keepDays, isIndexing: false, sessions: index.sessions, semanticModel: model }
    })
    lastSessions = sessions
  } finally {
    indexing = false
  }
}

let host = ''

const hostName = async ($: EngineInterface): Promise<string> => {
  if (host === '') {
    try {
      host = (await $.process.run(['hostname'])).stdout.trim()
    } catch {
      host = 'local'
    }
  }

  return host || 'local'
}

/** Does what one press on the page asks; the answer goes on the page, never to Claude. */
const handle = async ($: EngineInterface, action: PageAction): Promise<void> => {
  switch (action.type) {
    case 'refresh':
      await refresh($, true)
      return

    case 'fts': {
      await publish($, held => ({ ...held, fts: FTS_RUNNING(action) }))
      const { stdout, failure } = await reader($, ['search', '--query', action.q, '--limit', '60', ...(action.tools ? ['--tools'] : [])], SEARCH_TIMEOUT_MS)
      await publish($, held => (held.fts !== null && held.fts.id !== action.id ? null : { ...held, fts: ftsOf(action, stdout, failure) }))
      return
    }

    case 'read': {
      await publish($, held => ({ ...held, reader: READER_RUNNING(action) }))
      const args = ['transcript', '--session', action.sid, '--start', String(action.start), '--count', String(action.count), ...(action.tools ? ['--tools'] : [])]
      const { stdout, failure } = await reader($, args, SEARCH_TIMEOUT_MS)
      await publish($, held => (held.reader !== null && held.reader.id !== action.id ? null : { ...held, reader: readerOf(action, stdout, failure) }))
      return
    }

    case 'semantic': {
      const running = { id: action.id, q: action.q, status: 'running' as const, results: [], model, usd: null, error: '' }
      let sessions: PageState['sessions'] = []
      await publish($, held => {
        sessions = held.sessions

        return { ...held, semantic: running }
      })

      const answer = await $.model.complete({ model, prompt: semanticPrompt(sessions, action.q), maxTokens: 2000, effort: 'low', timeoutMs: 90_000 })
      const semantic = answer.isAnswered
        ? { ...running, status: 'done' as const, results: parseSemantic(answer.text, new Set(sessions.map(one => one.id))), usd: usdOf(model, answer.usage) }
        : { ...running, status: 'error' as const, error: String(answer.reason), usd: usdOf(model, answer.usage) }
      await publish($, held => (held.semantic !== null && held.semantic.id !== action.id ? null : { ...held, semantic }))
      return
    }
  }
}

/** One long-poll for the page's presses; a pull still running is not doubled, one the engine dropped is given up after a while. */
const listen = async ($: EngineInterface): Promise<void> => {
  const now = Date.now()

  if (listening.isStale || (listening.since !== 0 && now - listening.since < PULL_STUCK_MS)) {
    return
  }

  listening = { ...listening, since: now }

  try {
    const pulled = await $.webhub.pull({ mod: MOD, scope: SCOPE, listener: LISTENER, isFirst: listening.isFirst, waitMs: PULL_WAIT_MS })
    listening = { ...listening, isStale: pulled.isStale, isFirst: listening.isFirst && !pulled.isUp }

    if (pulled.isUp && !pulled.isRegistered) {
      await show($)
      lastSessions = ''
      void refresh($, true).catch(() => undefined)
    }

    for (const pulledAction of pulled.actions) {
      const action = parseAction(pulledAction.data)

      if (action !== null) {
        void handle($, action).catch(() => undefined)
      }
    }
  } finally {
    listening = { ...listening, since: 0 }
  }
}

export const register: Register = (on, options) => {
  listening = { since: 0, isFirst: true, isStale: false }
  indexing = false
  lastSessions = ''
  host = ''
  queue = Promise.resolve()
  model = typeof options.semanticModel === 'string' && options.semanticModel.trim() !== '' ? options.semanticModel.trim() : EMPTY.semanticModel

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await $.command.register({ name: COMMAND, description: 'Show the address of the page with all your Claude Code sessions' })
    await show($)
    void refresh($, false).catch(() => undefined)
    $.clock.every(1000, () => void listen($).catch(() => undefined))
    $.clock.every(INDEX_EVERY_MS, () => void refresh($, false).catch(() => undefined))

    return result
  })

  on('command.run', { command: COMMAND }, async $ => {
    const { isUp, url } = await show($).catch(() => ({ isUp: false, url: '' }))

    return { text: isUp ? `Сессии: ${url}` : 'Claude Hub не отвечает (запущен ли docker?).' }
  })
}
