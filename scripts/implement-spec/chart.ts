// Draws a spec run's progress as text: the ticket graph in dependency layers, each ticket's status
// and times, and the end-of-run steps. Pure: the same state, tickets and options give the same frame.
import {
  checksLogPath,
  failedChecks,
  logPath,
  openBlockers,
  runPaths,
  type GitMergeState,
  type Role,
  type RunState,
  type SessionState,
  type StepName,
  type Ticket,
  type TicketState
} from './run-spec.ts'

export type ChartOptions = {
  /** The current time, in epoch milliseconds. */
  now: number
  /** The terminal's columns: no line is longer. */
  width: number
  /** The terminal's rows: the frame has no more lines, collapsing finished layers first. */
  height: number
  /** Colors the status glyphs with ANSI escapes. */
  color: boolean
  /**
   * Whether the latest run is still going. When it isn't, a session it left open was cut short:
   * shown as interrupted and timed to the run's last save.
   */
  live: boolean
  /** The time zone for clock times, such as when a usage limit resets; the local one by default. */
  timeZone?: string
  /** Ends the frame with the run's one-line verdict. */
  verdict?: boolean
}

/** How a row looks: each has its own glyph and color. */
type RowStatus =
  'pending' | 'running' | 'waiting' | 'implemented' | 'done' | 'failed' | 'interrupted'

const MARKS: Record<RowStatus, { mark: string; color: number }> = {
  pending: { mark: '·', color: 2 },
  running: { mark: '◐', color: 33 },
  waiting: { mark: '⏸', color: 33 },
  implemented: { mark: '●', color: 36 },
  done: { mark: '✓', color: 32 },
  failed: { mark: '✗', color: 31 },
  interrupted: { mark: '✗', color: 31 }
}

/** A row of the chart: how it looks, its label (the part cut to fit) and its detail. */
type Row = { status: RowStatus; label: string; detail: string }

/** One block of rows under a heading; `layer` is set for ticket layers, which may collapse. */
type Section = { heading: string; rows: Row[]; layer?: number }

const END_STEPS: { name: StepName; role?: Role }[] = [
  { name: 'review', role: 'reviewer' },
  { name: 'fix', role: 'fixer' },
  { name: 'pr-description', role: 'pr-writer' },
  { name: 'ready' }
]

/** What every row needs besides its own entry. */
type Context = {
  state: RunState
  options: ChartOptions
  /** Where an open session's time runs to: now while the run is live, else its last save. */
  openUntil: number
  /** A role's log, relative to the repository root. */
  log: (role: Role, ticket?: number) => string
  /** A ticket's checks log, relative to the repository root. */
  checksLog: (ticket: number) => string
}

/** `45s`, `12m` or `1h 52m`. */
const duration = (ms: number) => {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

/**
 * Where a session is: `live` mid-attempt, `waiting` out a usage limit, `interrupted` when it was
 * either of those as a run that is no longer going stopped, or undefined when it isn't open.
 */
const sessionPhase = (session: SessionState | undefined, context: Context) => {
  if (session?.startedAt === undefined) return undefined
  const waiting = session.waitingUntil !== undefined
  if (!waiting && session.endedAt !== undefined) return undefined
  if (!context.options.live) return 'interrupted'
  return waiting ? 'waiting' : 'live'
}

/** `12m (attempt 2)`: a session's active time over every attempt, `—` when not recorded. */
const took = (session: SessionState, context: Context) => {
  const { startedAt } = session
  const time =
    startedAt === undefined
      ? '—'
      : duration((session.activeMs ?? 0) + (session.endedAt ?? context.openUntil) - startedAt)
  const attempt = (session.attempts ?? 1) > 1 ? ` (attempt ${session.attempts})` : ''
  return `${time}${attempt}`
}

/** `impl 12m`, or undefined for no session. */
const timed = (name: string, session: SessionState | undefined, context: Context) =>
  session && `${name} ${took(session, context)}`

/** The parts of a detail that exist, joined. */
const joined = (...parts: (string | undefined | false)[]) =>
  parts.filter((part): part is string => !!part).join(' · ')

/** Each ticket's layer: 0 with no blocker in the spec, otherwise one past its deepest such blocker. */
const layers = (tickets: Ticket[]) => {
  const byNumber = new Map(tickets.map((ticket) => [ticket.number, ticket]))
  const depth = new Map<number, number>()
  const visit = (ticket: Ticket, path: Set<number>): number => {
    const known = depth.get(ticket.number)
    if (known !== undefined) return known
    path.add(ticket.number)
    let deepest = -1
    for (const blocker of ticket.blockedBy) {
      const inSpec = byNumber.get(blocker.number)
      if (inSpec === undefined || path.has(blocker.number)) continue
      deepest = Math.max(deepest, visit(inSpec, path))
    }
    path.delete(ticket.number)
    depth.set(ticket.number, deepest + 1)
    return deepest + 1
  }
  for (const ticket of tickets) visit(ticket, new Set())
  return depth
}

/** `usage limit · resumes 14:05 (23m)`. */
const usageLimit = (until: number, options: ChartOptions) => {
  const clock = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: options.timeZone
  }).format(until)
  return `usage limit · resumes ${clock} (${duration(until - options.now)})`
}

/** A row for a session that is waiting out a usage limit or was interrupted, else undefined. */
const openSessionRow = (
  label: string,
  session: SessionState | undefined,
  context: Context,
  interrupted: string,
  rest: (string | undefined)[]
): Row | undefined => {
  const phase = sessionPhase(session, context)
  if (phase === 'waiting' && session?.waitingUntil !== undefined) {
    const [log] = rest.slice(-1)
    return {
      status: 'waiting',
      label,
      detail: joined(usageLimit(session.waitingUntil, context.options), log)
    }
  }
  if (phase === 'interrupted') {
    return { status: 'interrupted', label, detail: joined(interrupted, ...rest) }
  }
  return undefined
}

/** The check a merger failed, or undefined when it passed or hasn't finished. */
const failedMerge = (entry: TicketState) => {
  const check = entry.merger?.outcome?.check
  return check !== undefined && check !== 'passed' ? check : undefined
}

/** `merge (git) 4m`: the time from the git merge to the end of its checks, or to now while they run. */
const gitMerged = (record: GitMergeState, context: Context) =>
  `merge (git) ${duration((record.endedAt ?? context.openUntil) - record.startedAt)}`

/**
 * Whether a ticket's checks were started by the latest run and haven't ended: running while it is
 * live. Open checks from an earlier run wait for the latest run to reach them again.
 */
const checksOpen = (entry: TicketState, state: RunState) => {
  const record = entry.gitMerge
  if (record === undefined || record.endedAt !== undefined) return false
  return record.startedAt >= (state.runs?.at(-1)?.startedAt ?? 0)
}

/** Whether an `implemented` ticket waits in the merge queue: nothing has tried or failed its merge. */
const queued = (entry: TicketState, state: RunState) =>
  entry.status === 'implemented' &&
  entry.merger === undefined &&
  entry.mergeError === undefined &&
  failedChecks(entry) === undefined &&
  !checksOpen(entry, state)

/**
 * A row for an `implemented` ticket with no merger: failed with the error that stopped its merge,
 * running while its checks run (interrupted once the run stops), failed with the checks log when
 * they failed, else undefined.
 */
const gitMergeRow = (
  label: string,
  ticket: number,
  entry: TicketState,
  impl: string | undefined,
  context: Context
): Row | undefined => {
  if (entry.merger !== undefined || entry.status !== 'implemented') return undefined
  if (entry.mergeError !== undefined) {
    return { status: 'failed', label, detail: joined(`merge error: ${entry.mergeError}`, impl) }
  }
  const record = entry.gitMerge
  if (record === undefined) return undefined
  const merge = gitMerged(record, context)
  if (checksOpen(entry, context.state)) {
    return context.options.live
      ? { status: 'running', label, detail: joined(impl, merge) }
      : { status: 'interrupted', label, detail: joined('merge interrupted', impl, merge) }
  }
  const step = failedChecks(entry)
  if (step !== undefined) {
    return {
      status: 'failed',
      label,
      detail: joined(`checks ${step}`, impl, merge, context.checksLog(ticket))
    }
  }
  return undefined
}

const ticketRow = (ticket: Ticket, entry: TicketState, queue: number[], context: Context): Row => {
  const label = `#${ticket.number} ${ticket.title}`
  const log = (role: Role) => context.log(role, ticket.number)
  const impl = timed('impl', entry.session, context)
  const byGit = gitMergeRow(label, ticket.number, entry, impl, context)
  if (byGit) return byGit
  const merge = timed('merge', entry.merger, context)
  const open =
    openSessionRow(label, entry.merger, context, 'merge interrupted', [
      impl,
      merge,
      log('merger')
    ]) ?? openSessionRow(label, entry.session, context, 'interrupted', [impl, log('implementer')])
  if (open) return open
  switch (entry.status) {
    case 'pending': {
      const blockers = openBlockers(ticket, context.state).map((blocker) => `#${blocker}`)
      return {
        status: 'pending',
        label,
        detail: joined('pending', blockers.length > 0 && `blocked by ${blockers.join(' ')}`)
      }
    }
    case 'running':
      return { status: 'running', label, detail: joined(impl, log('implementer')) }
    case 'failed':
      return {
        status: 'failed',
        label,
        detail: joined(entry.session?.outcome?.check, impl, log('implementer'))
      }
    case 'implemented': {
      if (sessionPhase(entry.merger, context) === 'live') {
        return { status: 'running', label, detail: joined(impl, merge, log('merger')) }
      }
      const check = failedMerge(entry)
      if (check !== undefined) {
        return { status: 'failed', label, detail: joined(`merge ${check}`, impl, log('merger')) }
      }
      return {
        status: 'implemented',
        label,
        detail: joined(`queued ${queue.indexOf(ticket.number) + 1}`, impl)
      }
    }
    case 'done': {
      const byGit = entry.merger === undefined && entry.gitMerge
      return {
        status: 'done',
        label,
        detail: joined(impl, byGit ? gitMerged(byGit, context) : merge)
      }
    }
  }
}

const stepRow = (name: StepName, role: Role | undefined, context: Context): Row => {
  const step = context.state.steps?.[name]
  if (step === undefined) return { status: 'pending', label: name, detail: '' }
  const { session } = step
  const log = role && context.log(role)
  const time = session && took(session, context)
  const open = openSessionRow(name, session, context, 'interrupted', [time, log])
  if (open) return open
  if (step.status === 'done') return { status: 'done', label: name, detail: time ?? '' }
  if (step.status === 'failed') {
    return { status: 'failed', label: name, detail: joined(session?.outcome?.check, time, log) }
  }
  return { status: 'running', label: name, detail: joined(time, log) }
}

/** The time every run took, the latest counted up to `now` while it is live; undefined if never recorded. */
const totalTime = (state: RunState, options: ChartOptions) => {
  const runs = state.runs
  if (runs === undefined || runs.length === 0) return undefined
  return runs.reduce((sum, run, i) => {
    const end = i === runs.length - 1 && options.live ? options.now : run.endedAt
    return sum + end - run.startedAt
  }, 0)
}

const total = (state: RunState, options: ChartOptions) => {
  const time = totalTime(state, options)
  return time === undefined ? '—' : duration(time)
}

const header = (state: RunState, options: ChartOptions) =>
  joined(
    `spec #${state.spec}`,
    state.pr !== undefined && `PR #${state.pr} ${state.prReady ? 'ready' : 'draft'}`,
    total(state, options)
  )

/** Counts as `2 failed, 3 stuck`, leaving out the zeros. */
const counted = (counts: [number, string][]) =>
  counts
    .filter(([count]) => count > 0)
    .map(([count, what]) => `${count} ${what}`)
    .join(', ')

/**
 * `✓ PR #412 ready · 1h 52m`, or what kept the run from finishing: failed and interrupted rows,
 * pending tickets `stuck` behind an open blocker, and pending tickets `not started`.
 */
const verdict = (state: RunState, tickets: Ticket[], rows: Row[], options: ChartOptions) => {
  const time = total(state, options)
  if (state.steps?.ready?.status === 'done') return `✓ PR #${state.pr} ready · ${time}`
  const pending = tickets.filter(
    ({ number }) => (state.tickets[number]?.status ?? 'pending') === 'pending'
  )
  const stuck = pending.filter((ticket) => openBlockers(ticket, state).length > 0).length
  const counts = counted([
    [rows.filter((row) => row.status === 'failed').length, 'failed'],
    [rows.filter((row) => row.status === 'interrupted').length, 'interrupted'],
    [stuck, 'stuck'],
    [pending.length - stuck, 'not started']
  ])
  return `✗ ${counts || 'unfinished'} — re-run to resume · ${time}`
}

const paint = (status: RowStatus, color: boolean) => {
  const { mark, color: code } = MARKS[status]
  return color ? `\x1b[${code}m${mark}\x1b[0m` : mark
}

/** `text` cut to `width` characters, ending in `…` when cut. */
const clip = (text: string, width: number) =>
  text.length <= width ? text : `${text.slice(0, Math.max(0, width - 1))}…`

/**
 * The chart as lines: a header (spec, PR, total time), an `explore` row when the run explores,
 * the tickets in dependency layers, the end-of-run steps, and the verdict when asked for. Each
 * row is `glyph label  detail`, with labels padded to one column and cut so rows fit `width`.
 * When the frame is taller than `height`, layers whose tickets are all done collapse to one line
 * each, top first, and what still doesn't fit is cut with a count of the rows left out.
 */
export const render = (state: RunState, tickets: Ticket[], options: ChartOptions): string => {
  const { width, height, color } = options
  const logs = runPaths('.', state.spec).logs
  const context: Context = {
    state,
    options,
    openUntil: options.live ? options.now : (state.runs?.at(-1)?.endedAt ?? options.now),
    log: (role, ticket) => logPath(logs, role, ticket),
    checksLog: (ticket) => checksLogPath(logs, ticket)
  }
  const depth = layers(tickets)
  const queue = Object.entries(state.tickets)
    .filter(([, entry]) => queued(entry, state))
    .sort(([, a], [, b]) => (a.finishOrder ?? 0) - (b.finishOrder ?? 0))
    .map(([key]) => Number(key))

  const sections: Section[] = []
  if (state.steps?.explore) {
    sections.push({ heading: 'explore', rows: [stepRow('explore', 'explorer', context)] })
  }
  const deepest = Math.max(-1, ...depth.values())
  for (let layer = 0; layer <= deepest; layer++) {
    const rows = tickets
      .filter(({ number }) => depth.get(number) === layer)
      .sort((a, b) => a.number - b.number)
      .map((ticket) =>
        ticketRow(ticket, state.tickets[ticket.number] ?? { status: 'pending' }, queue, context)
      )
    sections.push({ heading: `layer ${layer}`, rows, layer })
  }
  sections.push({
    heading: 'finish',
    rows: END_STEPS.map(({ name, role }) => stepRow(name, role, context))
  })
  const rows = sections.flatMap((section) => section.rows)

  const outerLines = 1 + (options.verdict ? 1 : 0)
  const lineCount = (all: Section[]) =>
    outerLines + all.reduce((sum, section) => sum + 1 + section.rows.length, 0)
  for (const section of sections) {
    if (lineCount(sections) <= height) break
    if (section.layer === undefined || section.rows.length === 0) continue
    if (!section.rows.every((row) => row.status === 'done')) continue
    section.heading = `${paint('done', color)} layer ${section.layer}: ${section.rows.length} done`
    section.rows = []
  }

  const rowsWithDetail = sections.flatMap((section) => section.rows.filter((row) => row.detail))
  const longestDetail = Math.max(0, ...rowsWithDetail.map((row) => row.detail.length))
  const labelRoom = width - 4 - (longestDetail > 0 ? 2 + longestDetail : 0)
  const longestLabel = Math.max(0, ...rowsWithDetail.map((row) => row.label.length))
  const column = Math.min(longestLabel, Math.max(12, labelRoom))

  const line = (row: Row) => {
    const text = row.detail ? `${clip(row.label, column).padEnd(column)}  ${row.detail}` : row.label
    return `  ${paint(row.status, color)} ${clip(text, width - 4)}`
  }
  const body = sections.flatMap((section) => [section.heading, ...section.rows.map(line)])
  const budget = Math.max(1, height - outerLines)
  const shown =
    body.length <= budget
      ? body
      : [...body.slice(0, budget - 1), `  … ${body.length - (budget - 1)} more lines`]
  return [
    clip(header(state, options), width),
    ...shown,
    ...(options.verdict ? [clip(verdict(state, tickets, rows, options), width)] : [])
  ].join('\n')
}
