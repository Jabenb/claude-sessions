import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import type { PageState, Session } from '../hooks/contract'
import { EMPTY, parseAction, parseSemantic, parseState, semanticPrompt, usdOf } from '../hooks/model'
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
  tokens: { in: 1, out: 2, cr: 3, cw5: 0, cw1: 4, think: 0 }, byModel: {}, apiMs: null, toolMs: null, added: null, removed: null, deleteAt: NOW + 86400000, ...patch,
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
}

/** The engine and the hub beneath the mod, held in memory: files, the chat-file reader's answers, the model, and the hub's page, push, read and pull. */
const world = (on: On, given: Partial<World> = {}): World => {
  const held: World = {
    files: new Map(), runs: [], pushed: [], state: null, pages: [], presses: [], index: [session(A), session(B, { parent: A, forkN: 2 })], asked: [],
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
