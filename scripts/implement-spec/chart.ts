// Draws a spec run's progress as text: the ticket graph in dependency layers, each ticket's status
// and times, and the end-of-run steps. Pure: the same state, tickets and options give the same frame.
import { join } from 'node:path'
import {
  logPath,
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
  /** The time zone for clock times, such as when a usage limit resets; the local one by default. */
  timeZone?: string
  /** Ends the frame with the run's one-line verdict. */
  verdict?: boolean
}

type Glyph = 'pending' | 'running' | 'waiting' | 'implemented' | 'done' | 'failed'

const GLYPHS: Record<Glyph, { mark: string; color: number }> = {
  pending: { mark: '·', color: 2 },
  running: { mark: '◐', color: 33 },
  waiting: { mark: '⏸', color: 33 },
  implemented: { mark: '●', color: 36 },
  done: { mark: '✓', color: 32 },
  failed: { mark: '✗', color: 31 }
}

/** A row of the chart: its glyph, its label (the part cut to fit) and its detail. */
type Row = { glyph: Glyph; label: string; detail: string }

/** One block of rows under a heading; `layer` is set for ticket layers, which may collapse. */
type Section = { heading: string; rows: Row[]; layer?: number }

const END_STEPS: { name: StepName; role?: Role }[] = [
  { name: 'review', role: 'reviewer' },
  { name: 'fix', role: 'fixer' },
  { name: 'pr-description', role: 'pr-writer' },
  { name: 'ready' }
]

/** `45s`, `12m` or `1h 52m`. */
export const duration = (ms: number) => {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

/** Whether a session is mid-attempt: started and not yet ended. */
const live = (session: SessionState | undefined) =>
  session?.startedAt !== undefined && session.endedAt === undefined

/** A session's active time over every attempt, up to `now` for the attempt in progress. */
const activeTime = (session: SessionState, now: number) => {
  if (session.startedAt === undefined) return undefined
  return (session.activeMs ?? 0) + (session.endedAt ?? now) - session.startedAt
}

/** `impl 12m`, with the attempt when there was more than one; `—` for a time not recorded. */
const timed = (name: string, session: SessionState | undefined, now: number) => {
  if (session === undefined) return undefined
  const time = activeTime(session, now)
  const attempt = (session.attempts ?? 1) > 1 ? ` (attempt ${session.attempts})` : ''
  return `${name} ${time === undefined ? '—' : duration(time)}${attempt}`
}

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

/** The time it resumes, as `14:05 (23m)`. */
const resumes = (until: number, options: ChartOptions) => {
  const clock = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: options.timeZone
  }).format(until)
  return `resumes ${clock} (${duration(until - options.now)})`
}

const ticketRow = (
  ticket: Ticket,
  entry: TicketState,
  state: RunState,
  queue: number[],
  options: ChartOptions
): Row => {
  const { now } = options
  const label = `#${ticket.number} ${ticket.title}`
  const logs = join('.implement-spec', String(state.spec), 'logs')
  const log = (role: Role) => logPath(logs, role, ticket.number)
  const impl = timed('impl', entry.session, now)
  const merge = timed('merge', entry.merger, now)
  const waiting = [entry.session, entry.merger].find((session) => session?.waitingUntil)
  if (waiting?.waitingUntil !== undefined) {
    const role = waiting === entry.merger ? 'merger' : 'implementer'
    return {
      glyph: 'waiting',
      label,
      detail: joined('usage limit', resumes(waiting.waitingUntil, options), log(role))
    }
  }
  switch (entry.status) {
    case 'pending': {
      const open = ticket.blockedBy
        .filter((blocker) => blocker.open && state.tickets[blocker.number]?.status !== 'done')
        .map((blocker) => `#${blocker.number}`)
      return {
        glyph: 'pending',
        label,
        detail: joined('pending', open.length > 0 && `blocked by ${open.join(' ')}`)
      }
    }
    case 'running':
      return { glyph: 'running', label, detail: joined(impl, log('implementer')) }
    case 'failed':
      return {
        glyph: 'failed',
        label,
        detail: joined(entry.session?.outcome?.check, impl, log('implementer'))
      }
    case 'implemented': {
      if (live(entry.merger)) {
        return { glyph: 'running', label, detail: joined(impl, merge, log('merger')) }
      }
      const check = entry.merger?.outcome?.check
      if (check !== undefined && check !== 'passed') {
        return { glyph: 'failed', label, detail: joined(`merge ${check}`, impl, log('merger')) }
      }
      return {
        glyph: 'implemented',
        label,
        detail: joined(`queued ${queue.indexOf(ticket.number) + 1}`, impl)
      }
    }
    case 'done':
      return { glyph: 'done', label, detail: joined(impl, merge) }
  }
}

const stepRow = (state: RunState, name: StepName, role: Role | undefined, now: number): Row => {
  const step = state.steps?.[name]
  const session = step?.session
  const log = role && logPath(join('.implement-spec', String(state.spec), 'logs'), role)
  if (step === undefined) return { glyph: 'pending', label: name, detail: '' }
  const time = session && activeTime(session, now)
  const attempt = (session?.attempts ?? 1) > 1 ? ` (attempt ${session?.attempts})` : ''
  const took = session && `${time === undefined ? '—' : duration(time)}${attempt}`
  if (session?.waitingUntil !== undefined) {
    return { glyph: 'waiting', label: name, detail: joined('usage limit', log) }
  }
  if (step.status === 'done') return { glyph: 'done', label: name, detail: took ?? '' }
  if (step.status === 'failed') {
    return { glyph: 'failed', label: name, detail: joined(session?.outcome?.check, took, log) }
  }
  return { glyph: 'running', label: name, detail: joined(took, log) }
}

/** Whether any session is mid-attempt or waiting, so the latest run is still going. */
export const anyLive = (state: RunState) => {
  const sessions = [
    ...Object.values(state.tickets).flatMap((entry) => [entry.session, entry.merger]),
    ...Object.values(state.steps ?? {}).map((step) => step.session)
  ]
  return sessions.some((session) => live(session) || session?.waitingUntil !== undefined)
}

/** The time every run took, the latest counted up to `now` while it is still going. */
const totalTime = (state: RunState, now: number) => {
  const runs = state.runs ?? []
  const going = anyLive(state)
  return runs.reduce(
    (sum, run, i) => sum + ((i === runs.length - 1 && going ? now : run.endedAt) - run.startedAt),
    0
  )
}

const header = (state: RunState, now: number) =>
  joined(
    `spec #${state.spec}`,
    state.pr !== undefined && `PR #${state.pr} ${state.prReady ? 'ready' : 'draft'}`,
    duration(totalTime(state, now))
  )

const verdict = (state: RunState, tickets: Ticket[], now: number) => {
  const total = duration(totalTime(state, now))
  if (state.steps?.ready?.status === 'done') return `✓ PR #${state.pr} ready · ${total}`
  const failed =
    tickets.filter(({ number }) => {
      const entry = state.tickets[number]
      if (entry?.status === 'failed') return true
      const check = entry?.status === 'implemented' ? entry.merger?.outcome?.check : undefined
      return check !== undefined && check !== 'passed'
    }).length + Object.values(state.steps ?? {}).filter((step) => step.status === 'failed').length
  const stuck = tickets.filter(({ number }) => state.tickets[number]?.status === 'pending').length
  const counts = [failed > 0 && `${failed} failed`, stuck > 0 && `${stuck} stuck`]
    .filter(Boolean)
    .join(', ')
  return `✗ ${counts || 'unfinished'} · re-run to resume · ${total}`
}

const paint = (glyph: Glyph, color: boolean) => {
  const { mark, color: code } = GLYPHS[glyph]
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
  const { now, width, height, color } = options
  const depth = layers(tickets)
  const queue = Object.entries(state.tickets)
    .filter(([, entry]) => entry.status === 'implemented' && entry.merger === undefined)
    .sort(([, a], [, b]) => (a.finishOrder ?? 0) - (b.finishOrder ?? 0))
    .map(([key]) => Number(key))

  const sections: Section[] = []
  if (state.steps?.explore) {
    sections.push({ heading: 'explore', rows: [stepRow(state, 'explore', 'explorer', now)] })
  }
  const deepest = Math.max(-1, ...depth.values())
  for (let layer = 0; layer <= deepest; layer++) {
    const rows = tickets
      .filter(({ number }) => depth.get(number) === layer)
      .sort((a, b) => a.number - b.number)
      .map((ticket) =>
        ticketRow(
          ticket,
          state.tickets[ticket.number] ?? { status: 'pending' },
          state,
          queue,
          options
        )
      )
    sections.push({ heading: `layer ${layer}`, rows, layer })
  }
  sections.push({
    heading: 'finish',
    rows: END_STEPS.map(({ name, role }) => stepRow(state, name, role, now))
  })

  const fixed = 1 + (options.verdict ? 1 : 0)
  const size = (all: Section[]) =>
    fixed +
    all.reduce((sum, section) => sum + (section.rows.length > 0 ? 1 + section.rows.length : 1), 0)
  for (const section of sections) {
    if (size(sections) <= height) break
    if (section.layer === undefined || section.rows.length === 0) continue
    if (!section.rows.every((row) => row.glyph === 'done')) continue
    section.heading = `${paint('done', color)} layer ${section.layer} · ${section.rows.length} done`
    section.rows = []
  }

  const detailed = sections.flatMap((section) => section.rows.filter((row) => row.detail))
  const labels = detailed.map((row) => row.label)
  const details = detailed.map((row) => row.detail)
  const longestDetail = Math.max(0, ...details.map((detail) => detail.length))
  const room = width - 4 - (longestDetail > 0 ? 2 + longestDetail : 0)
  const column = Math.min(Math.max(0, ...labels.map((label) => label.length)), Math.max(12, room))

  const line = (row: Row) => {
    const text = row.detail ? `${clip(row.label, column).padEnd(column)}  ${row.detail}` : row.label
    return `  ${paint(row.glyph, color)} ${clip(text, width - 4)}`
  }
  const body = sections.flatMap((section) => [section.heading, ...section.rows.map(line)])
  const budget = Math.max(1, height - fixed)
  const shown =
    body.length <= budget
      ? body
      : [...body.slice(0, budget - 1), `  … ${body.length - (budget - 1)} more lines`]
  return [
    clip(header(state, now), width),
    ...shown,
    ...(options.verdict ? [clip(verdict(state, tickets, now), width)] : [])
  ].join('\n')
}
