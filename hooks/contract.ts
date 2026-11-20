/**
 * What the mod and its page say to each other through the hub. The mod pushes `PageState` (the page gets it in
 * `hub.onState`); the page sends `PageAction`s (`hub.send`), which the mod pulls and answers by pushing a new state.
 */

/** One session as the index has it (hooks/sessions.py `index`). Times are milliseconds since the epoch. */
export type Session = {
  id: string
  /** The folder of its chat file under ~/.claude/projects (the encoded working directory). */
  folder: string
  /** Where it started; '' when the file never said. */
  cwd: string
  /** The session it was forked or resumed from, and how many messages it took over from it. */
  parent: string | null
  forkN: number
  /** Messages in the file, the copied ones included (the numbering the reader and the search use). */
  n: number
  /** The name the person gave it, else the generated one; '' when none. */
  title: string
  first: string
  lastPrompt: string
  start: number
  last: number
  mtime: number
  size: number
  /** Its process runs now. */
  live: boolean
  branches: string[]
  models: string[]
  effort: string
  perm: string
  /** `claude-desktop`, `cli`, … */
  entry: string
  version: string
  /** Messages the person wrote, and Claude's answers. */
  prompts: number
  answers: number
  /** Tool name -> calls. */
  tools: Record<string, number>
  files: string[]
  web: number
  /** Subagent type -> how many ran. */
  subagents: Record<string, number>
  subagentCost: number
  /** Dollars, estimated from the tokens (the page shows it with ≈); `costKnown` false when a model's price is unknown. */
  cost: number
  costKnown: boolean
  /** Tokens: input, output, cache read, cache write (5 min / 1 h), thinking (part of output). */
  tokens: { in: number; out: number; cr: number; cw5: number; cw1: number; think: number }
  byModel: Record<string, { in: number; out: number; cr: number; cw5: number; cw1: number; think: number; cost: number }>
  /** From Claude Code's own record of the last run, when it has one; else null. */
  apiMs: number | null
  toolMs: number | null
  added: number | null
  removed: number | null
  /** When Claude Code deletes the file (last change + cleanupPeriodDays); null while the session runs. */
  deleteAt: number | null
  /** The session's id in Claude Desktop (`local_…`), when known: seen in its process's file, or matched to the app's list. */
  app: string | null
  /** Memory its process holds, resident and swapped, in MB; null without a process. */
  memMb: number | null
  /** Filled by the mod from the app's list of sessions: the link that opens it in Claude Desktop, and whether it is archived. */
  appLink: string | null
  archived: boolean | null
  /**
   * `working`: its process runs and wrote in the last minutes (or the app says it is mid-turn); `open`: its process
   * runs, idle; `archived`: archived in Claude Desktop; `closed`: no process.
   */
  activity: Activity
}

export type Activity = 'working' | 'open' | 'archived' | 'closed'

/** Archiving or restoring sessions in Claude Desktop, asked with `{ type: 'archive' | 'unarchive' }`. */
export type Op = {
  id: number
  kind: 'archive' | 'unarchive'
  status: Status
  results: Array<{ sid: string; ok: boolean; message: string }>
}

/** Whether the mod reaches Claude Desktop's session tools (`ccd_session_mgmt`). */
export type AppLink = {
  status: 'ok' | 'unavailable'
  error: string
  at: number
}

export type Hit = {
  sid: string
  /** The message's number in its session. */
  n: number
  role: 'user' | 'claude' | 'tool' | 'output'
  /** The tool, for a tool call or its output. */
  tool: string
  /** Text before the match, the match, text after it. */
  snip: [string, string, string]
}

export type Status = 'running' | 'done' | 'error'

/** Full-text search, asked by the page with `{ type: 'fts' }`. */
export type Fts = {
  id: number
  q: string
  tools: boolean
  status: Status
  hits: Hit[]
  scanned: number
  sessions: number
  ms: number
  isCut: boolean
  error: string
}

/** Search by meaning (a model call; costs tokens), asked with `{ type: 'semantic' }`. */
export type Semantic = {
  id: number
  q: string
  status: Status
  results: Array<{ sid: string; why: string }>
  model: string
  /** Dollars the call cost, when known. */
  usd: number | null
  error: string
}

export type Item = {
  n: number
  role: 'user' | 'claude' | 'tool'
  text: string
  /** For a tool call: its tool and (when asked with `tools`) its output, cut. */
  tool?: string
  out?: string
  at: number
  /** Taken over from the parent session. */
  copied: boolean
}

/** A window of one session's messages, asked with `{ type: 'read' }`. */
export type Reader = {
  id: number
  sid: string
  status: Status
  start: number
  total: number
  tools: boolean
  items: Item[]
  error: string
}

export type PageState = {
  v: 1
  /** The machine's name (the tree's host level). */
  host: string
  /** When the index was made; 0 before the first one. */
  at: number
  /** Days Claude Code keeps a chat file (cleanupPeriodDays). */
  keepDays: number
  /** True while the first index is made: the page shows its loading state. */
  isIndexing: boolean
  sessions: Session[]
  fts: Fts | null
  semantic: Semantic | null
  reader: Reader | null
  /** The model search by meaning uses. */
  semanticModel: string
  /** Whether archiving and the app's links are available; null before the mod asked the app. */
  app: AppLink | null
  /** The last archive or restore asked from the page. */
  op: Op | null
}

export type PageAction =
  | { type: 'fts'; id: number; q: string; tools: boolean }
  | { type: 'semantic'; id: number; q: string }
  | { type: 'read'; id: number; sid: string; start: number; count: number; tools: boolean }
  | { type: 'refresh' }
  | { type: 'archive' | 'unarchive'; id: number; sids: string[] }
