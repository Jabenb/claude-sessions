import type { Fts, PageAction, PageState, Reader, Semantic, Session } from './contract'

export const MOD = 'sessions'
export const READ_MAX = 1000
const SEMANTIC_SESSIONS = 400
const SEMANTIC_RESULTS = 10

export const EMPTY: PageState = {
  v: 1,
  host: '',
  at: 0,
  keepDays: 30,
  isIndexing: true,
  sessions: [],
  fts: null,
  semantic: null,
  reader: null,
  semanticModel: 'haiku',
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const text = (value: unknown, max = 500): string => (typeof value === 'string' ? value.trim().slice(0, max) : '')
const whole = (value: unknown, fallback: number): number => (typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : fallback)

/** A press from the page, read strictly: anything malformed is dropped. */
export const parseAction = (data: unknown): PageAction | null => {
  if (!isRecord(data)) {
    return null
  }

  const id = whole(data.id, 0)

  switch (data.type) {
    case 'fts': {
      const q = text(data.q)

      return q === '' ? null : { type: 'fts', id, q, tools: data.tools === true }
    }
    case 'semantic': {
      const q = text(data.q)

      return q === '' ? null : { type: 'semantic', id, q }
    }
    case 'read': {
      const sid = text(data.sid, 80)

      return /^[A-Za-z0-9-]{8,80}$/.test(sid)
        ? { type: 'read', id, sid, start: Math.max(1, whole(data.start, 1)), count: Math.min(READ_MAX, Math.max(1, whole(data.count, 200))), tools: data.tools !== false }
        : null
    }
    case 'refresh':
      return { type: 'refresh' }
    default:
      return null
  }
}

/** The state the hub holds, as this version reads it: what an older version stored keeps its parts, the rest is filled in. */
export const parseState = (held: unknown): PageState => {
  if (!isRecord(held) || held.v !== 1) {
    return EMPTY
  }

  return {
    ...EMPTY,
    host: typeof held.host === 'string' ? held.host : '',
    at: whole(held.at, 0),
    keepDays: whole(held.keepDays, 30),
    isIndexing: held.isIndexing === true,
    sessions: Array.isArray(held.sessions) ? (held.sessions as Session[]) : [],
    fts: isRecord(held.fts) ? (held.fts as Fts) : null,
    semantic: isRecord(held.semantic) ? (held.semantic as Semantic) : null,
    reader: isRecord(held.reader) ? (held.reader as Reader) : null,
    semanticModel: typeof held.semanticModel === 'string' && held.semanticModel !== '' ? held.semanticModel : EMPTY.semanticModel,
  }
}

/** What `sessions.py index` printed, or null when it is not an index. */
export const parseIndex = (stdout: string): { sessions: Session[]; keepDays: number; at: number } | null => {
  try {
    const parsed = JSON.parse(stdout) as unknown

    return isRecord(parsed) && Array.isArray(parsed.sessions)
      ? { sessions: parsed.sessions as Session[], keepDays: whole(parsed.keepDays, 30), at: whole(parsed.at, Date.now()) }
      : null
  } catch {
    return null
  }
}

export const FTS_RUNNING = (action: { id: number; q: string; tools: boolean }): Fts => ({
  id: action.id, q: action.q, tools: action.tools, status: 'running', hits: [], scanned: 0, sessions: 0, ms: 0, isCut: false, error: '',
})

/** The full-text search's answer from `sessions.py search`, or its failure. */
export const ftsOf = (action: { id: number; q: string; tools: boolean }, stdout: string, failure: string): Fts => {
  try {
    const parsed = JSON.parse(stdout) as Record<string, unknown>

    return {
      ...FTS_RUNNING(action),
      status: 'done',
      hits: Array.isArray(parsed.hits) ? (parsed.hits as Fts['hits']) : [],
      scanned: whole(parsed.scanned, 0),
      sessions: whole(parsed.sessions, 0),
      ms: whole(parsed.ms, 0),
      isCut: parsed.isCut === true,
    }
  } catch {
    return { ...FTS_RUNNING(action), status: 'error', error: failure === '' ? 'the search printed no answer' : failure }
  }
}

export const READER_RUNNING = (action: { id: number; sid: string; start: number; tools: boolean }): Reader => ({
  id: action.id, sid: action.sid, status: 'running', start: action.start, total: 0, tools: action.tools, items: [], error: '',
})

export const readerOf = (action: { id: number; sid: string; start: number; tools: boolean }, stdout: string, failure: string): Reader => {
  try {
    const parsed = JSON.parse(stdout) as Record<string, unknown>

    if (parsed.missing === true) {
      return { ...READER_RUNNING(action), status: 'error', error: 'the chat file is gone' }
    }

    return { ...READER_RUNNING(action), status: 'done', start: whole(parsed.start, action.start), total: whole(parsed.total, 0), items: Array.isArray(parsed.items) ? (parsed.items as Reader['items']) : [] }
  } catch {
    return { ...READER_RUNNING(action), status: 'error', error: failure === '' ? 'the reader printed no answer' : failure }
  }
}

const day = (at: number): string => new Date(at).toISOString().slice(0, 10)

/** The question for search by meaning: one line per session, newest first, then what the person asks. */
export const semanticPrompt = (sessions: readonly Session[], q: string): string => {
  const lines = sessions.slice(0, SEMANTIC_SESSIONS).map(one =>
    [one.id, day(one.last), one.cwd, one.branches.join(', '), one.title, one.first, one.lastPrompt]
      .map(part => part.replace(/\s+/g, ' ').trim().slice(0, 160))
      .join(' | '),
  )

  return [
    'Below are Claude Code chat sessions, one per line: id | last active | folder | git branches | title | first prompt | last prompt.',
    '',
    ...lines,
    '',
    `Which sessions are about this: «${q}»?`,
    `Answer with JSON only, no prose: [{"id": "<session id>", "why": "<one short line in the language of the question>"}], the best match first, at most ${SEMANTIC_RESULTS}. An empty array when none fits.`,
  ].join('\n')
}

/** The sessions the model named, known ids only, in its order. */
export const parseSemantic = (reply: string, known: ReadonlySet<string>): Array<{ sid: string; why: string }> => {
  const start = reply.indexOf('[')
  const end = reply.lastIndexOf(']')

  if (start < 0 || end <= start) {
    return []
  }

  try {
    const parsed = JSON.parse(reply.slice(start, end + 1)) as unknown

    return (Array.isArray(parsed) ? parsed : [])
      .filter(isRecord)
      .map(entry => ({ sid: text(entry.id, 80), why: text(entry.why, 300) }))
      .filter(entry => known.has(entry.sid))
      .filter((entry, index, all) => all.findIndex(other => other.sid === entry.sid) === index)
      .slice(0, SEMANTIC_RESULTS)
  } catch {
    return []
  }
}

/** $ per million tokens (input, output, cache read, cache write) of the models an alias may name. */
const PRICES: Array<[RegExp, [number, number, number, number]]> = [
  [/haiku/, [0.1, 0.5, 0.01, 0.125]],
  [/sonnet/, [2, 10, 0.1, 2.5]],
  [/opus/, [4, 20, 0.2, 5]],
  [/fable/, [8, 40, 0.2, 10]],
]

export type Usage = { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number }

/** Dollars one call cost, or null for a model this table does not know. */
export const usdOf = (model: string, usage: Usage | undefined): number | null => {
  const price = PRICES.find(([pattern]) => pattern.test(model.toLowerCase()))?.[1]

  if (price === undefined || usage === undefined) {
    return null
  }

  const sum = (usage.input_tokens ?? 0) * price[0] + (usage.output_tokens ?? 0) * price[1] + (usage.cache_read_input_tokens ?? 0) * price[2] + (usage.cache_creation_input_tokens ?? 0) * price[3]

  return Math.round(sum) / 1e6
}
