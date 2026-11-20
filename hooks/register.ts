import type { EngineInterface, Register } from 'claude-code'

import type { AppLink, PageAction, PageState } from './contract'
import { answerText, EMPTY, FTS_RUNNING, ftsOf, MOD, parseAction, parseAppList, parseIndex, parseSemantic, parseState, READER_RUNNING, readerOf, semanticPrompt, usdOf, withApp } from './model'
import type { AppSession } from './model'
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
/**
 * What the page's state holds as this load writes it. A lock taken by a load of a lower one (none: 0.1.x, which knows
 * nothing of `app` and drops it) is taken over at once: an older version left running in a long session must not index
 * for all and strip what it does not know.
 */
const LOCK_SCHEMA = 2
const INDEX_TIMEOUT_MS = 300_000
const SEARCH_TIMEOUT_MS = 120_000
/** Claude Desktop's tools for its sessions, as the engine names the server. */
const APP_SERVER = 'ccd_session_mgmt'
const APP_LIST_LIMIT = 1000

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
      const held = JSON.parse(String(await $.fs.read(lock))) as { owner?: unknown; at?: unknown; schema?: unknown }
      const schema = typeof held.schema === 'number' ? held.schema : 1

      if (held.owner !== LISTENER && typeof held.at === 'number' && now - held.at < LEADER_STALE_MS && schema >= LOCK_SCHEMA) {
        return false
      }
    }
  } catch {
    // An unreadable lock is taken over.
  }

  await $.fs.write(lock, JSON.stringify({ owner: LISTENER, at: now, schema: LOCK_SCHEMA }))

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
    const apps = await appSessions($)
    const merged = withApp(index.sessions, apps.list, await $.clock.now())
    const sessions = JSON.stringify([merged, apps.link.status, apps.link.error])
    const host = await hostName($)

    await publish($, held => {
      if (!isForced && sessions === lastSessions && !held.isIndexing && held.sessions.length === merged.length && held.host === host && held.app !== null) {
        return null
      }

      return { ...held, host, at: index.at, keepDays: index.keepDays, isIndexing: false, sessions: merged, semanticModel: model, app: apps.link }
    })
    lastSessions = sessions
  } finally {
    indexing = false
  }
}

let host = ''

/** Claude Desktop's sessions, archived ones too; null with the reason when its tools are out of reach (a CLI session, an old app). */
const appSessions = async ($: EngineInterface): Promise<{ list: AppSession[] | null; link: AppLink }> => {
  const at = await $.clock.now()

  try {
    const answer = await $.mcp.call(APP_SERVER, 'list_sessions', { include_archived: true, limit: APP_LIST_LIMIT })

    if (answer.isError === true) {
      return { list: null, link: { status: 'unavailable', error: answerText(answer) || 'list_sessions failed', at } }
    }

    return { list: parseAppList(answerText(answer)), link: { status: 'ok', error: '', at } }
  } catch (error) {
    return { list: null, link: { status: 'unavailable', error: error instanceof Error ? error.message : String(error), at } }
  }
}

/** The input a hook of the app put in place of the call's, as its refusal quotes it; null when it quotes none. */
export const rewrittenInput = (text: string): Record<string, unknown> | null => {
  const at = text.indexOf('The hook produced this input: ')

  if (at === -1) {
    return null
  }

  const start = text.indexOf('{', at)

  for (let end = text.indexOf('}', start); start !== -1 && end !== -1; end = text.indexOf('}', end + 1)) {
    try {
      const parsed = JSON.parse(text.slice(start, end + 1)) as unknown

      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch {
      // Not the whole object yet.
    }
  }

  return null
}

/**
 * Calls one of the app's tools as the person's own request: through the session's tool path with the press as
 * `consent`, so the permission path (auto mode included) reads it as the user's, which a plugin's direct
 * `$.mcp.call` is not. When the app's hook rewrote the input after review, the call is made once more with it.
 */
const askApp = async ($: EngineInterface, tool: string, args: Record<string, unknown>, consent: string): Promise<{ ok: boolean; message: string }> => {
  const name = `mcp__${APP_SERVER}__${tool}`
  let input: Record<string, unknown> = args

  for (let attempt = 0; attempt < 2; attempt++) {
    const answer = await $.tool.call({ ...input, tool: name, consent } as never) as { deny?: string; result?: unknown; text?: string; isError?: boolean }
    const text = answer.deny ?? (typeof answer.text === 'string' && answer.text !== '' ? answer.text : answerText(answer.result as { content?: unknown }))
    const failed = answer.deny !== undefined || answer.isError === true
    const rewritten = failed && attempt === 0 ? rewrittenInput(text) : null

    if (rewritten === null) {
      return { ok: !failed, message: text }
    }

    const { tool: _tool, tool_use_id: _id, consent: _consent, ...own } = rewritten
    input = own
  }

  return { ok: false, message: 'the app changed the call again' }
}

/** Archives or restores sessions in Claude Desktop one by one (the app may ask the person about each), the session of this mod last. */
const archive = async ($: EngineInterface, action: { id: number; kind: 'archive' | 'unarchive'; sids: string[] }): Promise<void> => {
  let known: PageState['sessions'] = []
  await publish($, held => {
    known = held.sessions

    return { ...held, op: { id: action.id, kind: action.kind, status: 'running', results: [] } }
  })

  const own = await $.session.id()
  const order = [...action.sids].sort((a, b) => Number(a === own) - Number(b === own))
  const results: Array<{ sid: string; ok: boolean; message: string }> = []
  const press = action.kind === 'archive' ? 'Archive' : 'Restore from archive'

  for (const sid of order) {
    const one = known.find(each => each.id === sid)
    const app = one?.app ?? null

    if (app === null) {
      results.push({ sid, ok: false, message: 'Claude Desktop does not know this session' })
      continue
    }

    const name = (one?.title || one?.first || sid).slice(0, 80)
    const consent = `The user pressed "${press}" on the Sessions page for the session "${name}" (${app}) and wants it ${action.kind === 'archive' ? 'archived' : 'restored from the archive'}.`

    try {
      results.push({ sid, ...(await askApp($, action.kind === 'archive' ? 'archive_session' : 'unarchive_session',
        action.kind === 'archive' ? { session_id: app, reason: 'From the Sessions page in Claude Hub' } : { session_id: app }, consent)) })
    } catch (error) {
      results.push({ sid, ok: false, message: error instanceof Error ? error.message : String(error) })
    }

    await publish($, held => (held.op?.id !== action.id ? null : { ...held, op: { ...held.op, results: [...results] } }))
  }

  await publish($, held => (held.op?.id !== action.id ? null : { ...held, op: { id: action.id, kind: action.kind, status: 'done', results } }))
  await refresh($, true)
}

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

    case 'archive':
    case 'unarchive':
      await archive($, { id: action.id, kind: action.type, sids: action.sids })
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
