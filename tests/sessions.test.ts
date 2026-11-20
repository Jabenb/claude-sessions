import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import type { PageState, Session } from '../hooks/contract'
import { EMPTY, parseAction, parseAppList, parseSemantic, parseState, semanticPrompt, usdOf, withApp } from '../hooks/model'
import { PAGE } from '../hooks/page/page'

type On = Parameters<TestBody>[1]

const HOME = '/home/u'
const DATA = `${HOME}/.claude/mods-data/sessions`
const LOCK = `${DATA}/leader.json`
const START = { cwd: '/w/shop', surface: 'desktop', isInteractive: true } as const
const NOW = 1_800_000_000_000
const A = '11111111-aaaa-bbbb-cccc-000000000001'
const B = '22222222-aaaa-bbbb-cccc-000000000002'

const session = (id: string, patch: Partial<Session> = {}): Session => ({
  id, folder: '-w-shop', cwd: '/w/shop', parent: null, forkN: 0, n: 4, title: '', first: 'Сделай драйвер Apaleo', lastPrompt: 'PR', start: NOW - 9000, last: NOW - 1000,
  mtime: NOW - 1000, size: 100, live: false, branches: ['main'], models: ['claude-opus-5-5'], effort: 'high', perm: 'auto', entry: 'cli', version: '2.1.0',
  prompts: 2, answers: 2, tools: { Edit: 1 }, files: [], web: 0, subagents: {}, subagentCost: 0, cost: 1.5, costKnown: true,
  tokens: { in: 1, out: 2, cr: 3, cw5: 0, cw1: 4, think: 0 }, byModel: {}, apiMs: null, toolMs: null, added: null, removed: null, deleteAt: NOW + 86400000, app: null, memMb: null, appLink: null, archived: null, activity: 'closed', ...patch,
})

type World = {
  files: Map<string, string>
  runs: string[][]
  pushed: PageState[]
  state: unknown
  pages: Array<{ scope: unknown; title: unknown }>
  presses: unknown[][]
  index: Session[]
  asked: string[]
  reply: { isAnswered: true; text: string; usage: Record<string, number> } | { isAnswered: false; reason: string; usage: Record<string, number> }
  /** Claude Desktop's sessions, the calls the mod made to its tools, and whether the tools are there. */
  apps: Array<Record<string, unknown>>
  appCalls: Array<{ tool: string; args: Record<string, unknown> }>
  hasApp: boolean
}

/** The engine and the hub beneath the mod, held in memory: files, the chat-file reader's answers, the model, and the hub's page, push, read and pull. */
const world = (on: On, given: Partial<World> = {}): World => {
  const held: World = {
    files: new Map(), runs: [], pushed: [], state: null, pages: [], presses: [], index: [session(A, { live: true, app: 'local_a', mtime: NOW - 600_000 }), session(B, { parent: A, forkN: 2 })], asked: [],
    apps: [{ sessionId: 'local_a', title: 'A', cwd: '/w/shop', isArchived: false, isRunning: false, link: 'claude://claude.ai/epitaxy/local_a' }],
    appCalls: [], hasApp: true,
    reply: { isAnswered: true, text: `[{"id": "${B}", "why": "про очередь"}, {"id": "nope", "why": "x"}]`, usage: { input_tokens: 1_000_000, output_tokens: 0 } },
    ...given,
  }

  on('engine.create', async (_, e, next) => ({
    ...(await next(e)),
    webhub: {
      page: async ({ scope, title }: { scope?: unknown; title?: unknown }) => {
        held.pages.push({ scope, title })

        return { isUp: true, url: 'http://localhost:7777/#/global/sessions' }
      },
      push: async ({ state, scope }: { state: unknown; scope?: unknown }) => {
        expect(scope).toBe('global')
        held.state = state
        held.pushed.push(state as PageState)

        return { isUp: true }
      },
      read: async () => ({ isUp: true, state: held.state }),
      pull: async () => {
        const data = held.presses.shift() ?? []

        return { isUp: true, isStale: false, isRegistered: true, actions: data.map((one, index) => ({ id: index + 1, at: 0, data: one })) }
      },
    },
  }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: undefined }) as never)
  on('env.get', (_, e) => ({ value: e.name === 'HOME' ? HOME : undefined }))
  on('ui.status', () => ({ value: undefined }))
  on('process.run', (_, e) => {
    held.runs.push([...e.argv])
    const command = e.argv[3]
    const stdout =
      e.argv[0] === 'hostname' ? 'devbox\n'
      : command === 'index' ? JSON.stringify({ sessions: held.index, keepDays: 30, at: NOW })
      : command === 'search' ? JSON.stringify({ hits: [{ sid: A, n: 1, role: 'user', tool: '', snip: ['Сделай ', 'драйвер', ''] }], scanned: 2, sessions: 1, ms: 5, isCut: false })
      : command === 'transcript' ? JSON.stringify({ sid: A, items: [{ n: 1, role: 'user', text: 'привет', at: 0, copied: false }], total: 1, start: 1 })
      : ''

    return { value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } } as never
  })
  on('fs.exists', (_, e) => ({ value: held.files.has(e.path) }))
  on('fs.read', (_, e) => ({ value: held.files.get(e.path) ?? '' }))
  on('fs.write', (_, e) => {
    held.files.set(e.path, e.text)

    return { value: undefined }
  })
  on('session.id', () => ({ value: A }))
  on('mcp.call', (_, e) => {
    if (!held.hasApp) {
      return { value: { content: [{ type: 'text', text: 'no server named ccd_session_mgmt' }], isError: true } } as never
    }

    held.appCalls.push({ tool: e.tool, args: e.args })

    if (e.tool === 'list_sessions') {
      return { value: { content: [{ type: 'text', text: `${JSON.stringify(held.apps)}\n\nOnly sessions on this SSH connection [are] shown.` }], isError: false } } as never
    }

    const refused = e.args.session_id === 'local_b'
    held.apps = held.apps.map(app => (app.sessionId === e.args.session_id && !refused ? { ...app, isArchived: e.tool === 'archive_session' } : app))

    return { value: { content: [{ type: 'text', text: refused ? 'The session is pinned' : 'Archived' }], isError: refused } } as never
  })
  on('model.complete', (_, e) => {
    held.asked.push(typeof e.prompt === 'string' ? e.prompt : '')

    return { value: held.reply } as never
  })

  return held
}

const started = async ($: Parameters<TestBody>[0], on: On, given: Partial<World> = {}) => {
  const held = world(on, given)
  const clock = mock.clock(on, { now: NOW })
  await $.session.start(START)
  await clock.advance(10)

  /** Presses on the page, handed over by the next pull, and the work they start let finish. */
  const press = async (...data: unknown[]) => {
    held.presses.push(data)
    await clock.advance(1000)
    await clock.advance(10)
  }

  return { held, press, clock }
}

const last = (held: World): PageState => parseState(held.state)
const indexRuns = (held: World): number => held.runs.filter(run => run[3] === 'index').length

test('a session puts the one page of the whole machine in the hub and the sessions on it', async ($, on) => {
  const { held } = await started($, on)

  expect(held.pages[0]).toEqual({ scope: 'global', title: 'Сессии' })
  expect(held.runs.find(run => run[3] === 'index')).toEqual([
    'python3', '-I', expect.stringMatching(/\/hooks\/sessions\.py$/) as never, 'index', '--cache', `${DATA}/cache.json`, '--config', `${HOME}/.claude`,
  ])
  expect(last(held)).toMatchObject({ v: 1, host: 'devbox', keepDays: 30, isIndexing: false, semanticModel: 'haiku' })
  expect(last(held).sessions.map(one => one.id)).toEqual([A, B])
  expect(JSON.parse(held.files.get(LOCK) ?? '{}')).toMatchObject({ at: NOW })
})

test('an unchanged index is not pushed again; a refresh from the page indexes at once', async ($, on) => {
  const { held, press, clock } = await started($, on)
  const pushes = held.pushed.length
  await clock.advance(15_000)
  await clock.advance(10)

  expect(indexRuns(held)).toBe(2)
  expect(held.pushed.length).toBe(pushes)

  held.index = [session(A, { title: 'Новое имя' })]
  await press({ type: 'refresh' })

  expect(indexRuns(held)).toBe(3)
  expect(last(held).sessions.map(one => one.title)).toEqual(['Новое имя'])
})

test('another session holding a fresh lock does the indexing; a quiet one is taken over', async ($, on) => {
  const held = world(on)
  held.files.set(LOCK, JSON.stringify({ owner: 'someone-else', at: NOW - 1000 }))
  const clock = mock.clock(on, { now: NOW })
  await $.session.start(START)
  await clock.advance(10)

  expect(indexRuns(held)).toBe(0)

  await clock.advance(45_000)
  await clock.advance(10)

  expect(indexRuns(held)).toBe(1)
  expect(JSON.parse(held.files.get(LOCK) ?? '{}').owner).not.toBe('someone-else')
})

test('a full-text search shows that it runs, then its hits; what other sessions put on the page is kept', async ($, on) => {
  const { held, press } = await started($, on)
  await press({ type: 'fts', id: 7, q: 'драйвер', tools: true })
  const search = held.runs.find(run => run[3] === 'search') ?? []

  expect(search.slice(3, 8)).toEqual(['search', '--query', 'драйвер', '--limit', '60'])
  expect(search).toContain('--tools')
  expect(held.pushed.some(state => state.fts?.status === 'running' && state.fts.id === 7)).toBe(true)
  expect(last(held).fts).toMatchObject({ id: 7, q: 'драйвер', status: 'done', sessions: 1 })
  expect(last(held).fts?.hits[0]?.snip).toEqual(['Сделай ', 'драйвер', ''])
  expect(last(held).sessions).toHaveLength(2)
})

test('the reader puts a window of one session on the page', async ($, on) => {
  const { held, press } = await started($, on)
  await press({ type: 'read', id: 3, sid: A, start: 1, count: 200, tools: true })

  expect(held.runs.find(run => run[3] === 'transcript')?.slice(3, 10)).toEqual(['transcript', '--session', A, '--start', '1', '--count', '200'])
  expect(last(held).reader).toMatchObject({ id: 3, sid: A, status: 'done', total: 1 })
})

test('search by meaning asks the model about the sessions and keeps only the ids it knows', async ($, on) => {
  const { held, press } = await started($, on)
  await press({ type: 'semantic', id: 9, q: 'где я делал очередь' })

  expect(held.asked[0]).toContain(`${B} | `)
  expect(held.asked[0]).toContain('«где я делал очередь»')
  expect(last(held).semantic).toMatchObject({ id: 9, status: 'done', model: 'haiku', results: [{ sid: B, why: 'про очередь' }], usd: 0.1 })
})

test('a failed model call shows why on the page', async ($, on) => {
  const { held, press } = await started($, on, { reply: { isAnswered: false, reason: 'api-error', usage: {} } })
  await press({ type: 'semantic', id: 2, q: 'x' })

  expect(last(held).semantic).toMatchObject({ status: 'error', error: 'api-error' })
})

test('a press from the page is read strictly; anything unknown is dropped', async () => {
  expect(parseAction({ type: 'fts', id: 1, q: '  apaleo ', tools: 1 })).toEqual({ type: 'fts', id: 1, q: 'apaleo', tools: false })
  expect(parseAction({ type: 'fts', id: 1, q: '   ' })).toBeNull()
  expect(parseAction({ type: 'read', id: 1, sid: '../../etc', start: 1, count: 5 })).toBeNull()
  expect(parseAction({ type: 'read', id: 1, sid: A, start: -4, count: 99_999 })).toEqual({ type: 'read', id: 1, sid: A, start: 1, count: 1000, tools: true })
  expect(parseAction({ type: 'rm', path: '/' })).toBeNull()
  expect(parseAction('fts')).toBeNull()
  expect(parseAction({ type: 'archive', id: 2, sids: [A, A, '../x', 5] })).toEqual({ type: 'archive', id: 2, sids: [A] })
  expect(parseAction({ type: 'unarchive', id: 2, sids: [] })).toBeNull()
})

test('the state of an older or broken page is read as far as it goes', async () => {
  expect(parseState(null)).toEqual(EMPTY)
  expect(parseState({ v: 2 })).toEqual(EMPTY)
  expect(parseState({ v: 1, host: 'h', sessions: 'x', fts: [] })).toMatchObject({ host: 'h', sessions: [], fts: null })
})

test('the model\'s answer is read out of the text around its JSON, unknown and repeated ids dropped', async () => {
  const known = new Set([A, B])

  expect(parseSemantic(`Вот: [{"id":"${A}","why":"a"},{"id":"${A}","why":"b"},{"id":"zzz"}] готово`, known)).toEqual([{ sid: A, why: 'a' }])
  expect(parseSemantic('ничего', known)).toEqual([])
  expect(semanticPrompt([session(A, { title: 'Драйвер\nApaleo' })], 'q').split('\n').filter(line => line.startsWith(A))).toHaveLength(1)
  expect(usdOf('claude-sonnet-5-5', { input_tokens: 1000, output_tokens: 1000 })).toBe(0.012)
  expect(usdOf('mystery', { input_tokens: 1 })).toBeNull()
})

test('the page is one whole document that talks to the hub', async () => {
  expect(PAGE.startsWith('<!doctype html>')).toBe(true)
  expect(PAGE).toContain('/hub.js')
  expect(PAGE).toContain('hub.onState')
  expect(PAGE).not.toContain('${')
})

test('the sessions carry what Claude Desktop says of them: its link, the archive, and what they do now', async ($, on) => {
  const { held } = await started($, on)
  const [a, b] = last(held).sessions

  expect(held.appCalls[0]).toEqual({ tool: 'list_sessions', args: { include_archived: true, limit: 1000 } })
  expect(last(held).app).toMatchObject({ status: 'ok', error: '' })
  expect(a).toMatchObject({ app: 'local_a', appLink: 'claude://claude.ai/epitaxy/local_a', archived: false, activity: 'open' })
  expect(b).toMatchObject({ app: null, appLink: null, archived: null, activity: 'closed' })
})

test('without Claude Desktop\'s tools the page says why and keeps what the files say', async ($, on) => {
  const { held } = await started($, on, { hasApp: false })

  expect(last(held).app).toMatchObject({ status: 'unavailable', error: 'no server named ccd_session_mgmt' })
  expect(last(held).sessions[0]).toMatchObject({ app: 'local_a', archived: null, activity: 'open' })
})

test('archiving from the page goes through Claude Desktop one session at a time and reports each', async ($, on) => {
  const { held, press } = await started($, on)
  held.index = [session(A, { live: true, app: 'local_a' }), session(B, { app: 'local_b', live: true }), session('cccccccc-0000-0000-0000-000000000003')]
  await press({ type: 'refresh' })
  await press({ type: 'archive', id: 5, sids: [A, B, 'cccccccc-0000-0000-0000-000000000003'] })
  const calls = held.appCalls.filter(call => call.tool === 'archive_session')

  expect(calls.map(call => call.args.session_id)).toEqual(['local_b', 'local_a'])
  expect(calls[0]?.args.reason).toBe('From the Sessions page in Claude Hub')
  expect(last(held).op).toEqual({
    id: 5, kind: 'archive', status: 'done', results: [
      { sid: B, ok: false, message: 'The session is pinned' },
      { sid: 'cccccccc-0000-0000-0000-000000000003', ok: false, message: 'Claude Desktop does not know this session' },
      { sid: A, ok: true, message: 'Archived' },
    ],
  })
  expect(last(held).sessions.find(one => one.id === A)?.activity).toBe('archived')

  await press({ type: 'unarchive', id: 6, sids: [A] })

  expect(held.appCalls.at(-2)).toEqual({ tool: 'unarchive_session', args: { session_id: 'local_a' } })
  expect(last(held).op).toMatchObject({ id: 6, kind: 'unarchive', status: 'done' })
})

test('the app\'s list is read from the text of its answer, notes after it ignored', async () => {
  const listed = parseAppList('[{"sessionId":"local_1","title":"Про ] скобку","cwd":"/w","isArchived":true,"isRunning":false,"link":"claude://claude.ai/epitaxy/local_1"},{"sessionId":"x"}]\n\nOnly [these].')

  expect(listed).toEqual([{ sessionId: 'local_1', title: 'Про ] скобку', cwd: '/w', isArchived: true, isRunning: false, link: 'claude://claude.ai/epitaxy/local_1' }])
  expect(() => parseAppList('nothing')).toThrow()
})

test('a session the app knows only by name and folder is matched when exactly one fits', async () => {
  const apps = [
    { sessionId: `local_${B}`, title: 'x', cwd: '/w/shop', isArchived: true, isRunning: false, link: '' },
    { sessionId: 'local_named', title: 'Драйвер', cwd: '/w/shop', isArchived: false, isRunning: true, link: '' },
    { sessionId: 'local_twin1', title: 'Двойник', cwd: '/w/shop', isArchived: false, isRunning: false, link: '' },
    { sessionId: 'local_twin2', title: 'Двойник', cwd: '/w/shop', isArchived: false, isRunning: false, link: '' },
  ]
  const [byFile, byName, twin, working] = withApp([
    session(B), session(A, { title: 'Драйвер', live: true, mtime: NOW - 1_000_000 }), session('cccccccc-0000-0000-0000-000000000003', { title: 'Двойник' }),
    session('dddddddd-0000-0000-0000-000000000004', { live: true, mtime: NOW - 1000 }),
  ], apps, NOW)

  expect(byFile).toMatchObject({ app: `local_${B}`, archived: true, activity: 'archived', appLink: `claude://claude.ai/epitaxy/local_${B}` })
  expect(byName).toMatchObject({ app: 'local_named', activity: 'working' })
  expect(twin).toMatchObject({ app: null, archived: null, activity: 'closed' })
  expect(working).toMatchObject({ activity: 'working' })
})
