import type { NpcStatus, Stance } from '#lib/memory/enums.ts'
import type { JournalPosition } from '#lib/memory/journal.ts'
import { estimateTokens } from '../ai/tokens.ts'

/**
 * World memory in the DM's context. A pure function of records, the mention window and a token
 * budget: no clock, no randomness, no model. It picks the always-on core, scores the rest per
 * Turn, trims to the budget and renders plain text. The caller loads the rows and decides the
 * window; the block is absent (null) when there is nothing to say, so a Campaign with no memory
 * keeps a byte-for-byte unchanged prompt.
 */

/** Memory gets at most this share of the context left after the fixed prompts and reply reserve. */
export const MEMORY_BUDGET_SHARE = 0.25
/** How many of the newest Turns count as the window for mention matching. */
export const MENTION_WINDOW_TURNS = 6
/** A record counts as recently changed within this many Turns of the focus point. */
export const RECENT_CHANGE_TURNS = 10
/** The most non-alive NPCs listed on the compact "gone" line. */
export const GONE_LINE_MAX = 10

/** The share of the remaining tokens memory may use. */
export const memoryBudget = (remainingTokens: number) =>
  Math.floor(Math.max(0, remainingTokens) * MEMORY_BUDGET_SHARE)

interface Stamped {
  id: string
  createdSessionId: string
  changedSessionId: string
  changedSeq: number
  updatedAt: number
  retiredAt: number | null
}
export interface MemoryNpc extends Stamped {
  name: string
  description: string | null
  role: string | null
  status: NpcStatus
  placeId: string | null
  /** Stance toward the Character the context is for, when one is recorded. */
  stance: Stance | null
  note: string | null
  knowsFactIds: readonly string[]
}
export interface MemoryNamed extends Stamped {
  name: string
  description: string | null
}
export interface MemoryFact extends Stamped {
  title: string
  detail: string | null
  worldChanging: boolean
  supersededById: string | null
}

export interface MemoryInput {
  npcs: readonly MemoryNpc[]
  places: readonly MemoryNamed[]
  factions: readonly MemoryNamed[]
  events: readonly MemoryNamed[]
  facts: readonly MemoryFact[]
  /** Text of the newest Turns, for name matching. */
  window: readonly string[]
  /** The Session and Turn seq "now" is measured from, for recency and "created this Session". */
  focus: JournalPosition
}

export const MEMORY_HEADER =
  'World memory (what the story has established about this Campaign; where it disagrees with the story summary below, memory wins):'

type Kind = 'npc' | 'place' | 'faction' | 'event' | 'fact'
const KIND_ORDER: Kind[] = ['npc', 'place', 'faction', 'event', 'fact']
const SECTION: Record<Kind, string> = {
  npc: 'People',
  place: 'Places',
  faction: 'Factions',
  event: 'Events',
  fact: 'Facts'
}

const SCORE = { mention: 8, link: 4, recent: 2, created: 1 } as const

interface Entry {
  kind: Kind
  id: string
  label: string
  updatedAt: number
  /** Core entries: 0 stance, 1 recent mention, 2 world-changing. Selected entries: -score. */
  rank: number
  full: string
  nameOnly: string
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function mentions(label: string, window: readonly string[]): boolean {
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${escape(label.trim())}(?![\\p{L}\\p{N}])`, 'iu')
  return window.some((w) => re.test(w))
}

/** Most recently changed first, then a stable order by kind, label and id. */
function byRecency(a: Entry, b: Entry): number {
  return (
    b.updatedAt - a.updatedAt ||
    KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
    (a.label < b.label ? -1 : a.label > b.label ? 1 : 0) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  )
}
const ranked = (a: Entry, b: Entry) => a.rank - b.rank || byRecency(a, b)

const withText = (head: string, text: string | null) => (text ? `${head}: ${text}` : head)

export interface MemoryBlockOptions {
  /** Prefix every record with its id in brackets, for callers that must refer to records. */
  ids?: boolean
  /** Replaces the DM-facing header. */
  header?: string
}

export function buildMemoryBlock(
  input: MemoryInput,
  budgetTokens: number,
  options: MemoryBlockOptions = {}
): string | null {
  const tag = (id: string) => (options.ids ? `[${id}] ` : '')
  const live = <T extends Stamped>(rows: readonly T[]) => rows.filter((r) => r.retiredAt === null)
  const npcs = live(input.npcs)
  const places = live(input.places)
  const factions = live(input.factions)
  const events = live(input.events)
  const facts = live(input.facts).filter((f) => f.supersededById === null)
  const factById = new Map(facts.map((f) => [f.id, f]))

  const recent = (r: Stamped) =>
    r.changedSessionId === input.focus.sessionId &&
    r.changedSeq > input.focus.seq - RECENT_CHANGE_TURNS
  const created = (r: Stamped) => r.createdSessionId === input.focus.sessionId

  // Links, both directions, as a map of record key to the keys it touches.
  const links = new Map<string, Set<string>>()
  const link = (a: string, b: string) => {
    for (const [x, y] of [
      [a, b],
      [b, a]
    ]) {
      if (!links.has(x)) links.set(x, new Set())
      links.get(x)!.add(y)
    }
  }
  const key = (kind: Kind, id: string) => `${kind}:${id}`
  for (const n of npcs) {
    if (n.placeId) link(key('npc', n.id), key('place', n.placeId))
    for (const f of n.knowsFactIds) if (factById.has(f)) link(key('npc', n.id), key('fact', f))
  }

  const factLine = (f: MemoryFact) => withText(`- ${tag(f.id)}${f.title}`, f.detail)
  const namedLine = (r: MemoryNamed) => withText(`- ${tag(r.id)}${r.name}`, r.description)
  const npcLine = (n: MemoryNpc, withKnows: boolean) => {
    const bits = [n.status, ...(n.stance ? [`${n.stance} toward you`] : [])].join(', ')
    const head = `- ${tag(n.id)}${n.name} (${bits})${n.role ? `, ${n.role}` : ''}`
    const body = [n.description, n.note ? `Note: ${n.note}` : null].filter(Boolean).join(' ')
    const knows = n.knowsFactIds
      .map((id) => factById.get(id)?.title)
      .filter((t): t is string => !!t)
    const tail = withKnows && knows.length > 0 ? ` Knows: ${knows.join('; ')}` : ''
    return `${withText(head, body || null)}${tail}`
  }

  const entryOf = (kind: Kind, r: Stamped, label: string, full: string, rank: number): Entry => ({
    kind,
    id: r.id,
    label,
    updatedAt: r.updatedAt,
    rank,
    full,
    nameOnly: `- ${tag(r.id)}${label}`
  })

  // Core: stance-bearing live NPCs, NPCs in the window, world-changing facts.
  const core = new Map<string, Entry>()
  for (const n of npcs) {
    const stance =
      n.status === 'alive' && ['allied', 'friendly', 'hostile'].includes(n.stance ?? '')
    const mentioned = mentions(n.name, input.window)
    if (stance || mentioned) {
      core.set(key('npc', n.id), entryOf('npc', n, n.name, npcLine(n, true), stance ? 0 : 1))
    }
  }
  for (const f of facts) {
    if (f.worldChanging) core.set(key('fact', f.id), entryOf('fact', f, f.title, factLine(f), 2))
  }

  // Selected: score the rest. Core records and mentions seed the one-hop links.
  const mentionedKeys = new Set<string>()
  for (const n of npcs) if (mentions(n.name, input.window)) mentionedKeys.add(key('npc', n.id))
  for (const f of facts) if (mentions(f.title, input.window)) mentionedKeys.add(key('fact', f.id))
  for (const [kind, rows] of [
    ['place', places],
    ['faction', factions],
    ['event', events]
  ] as const) {
    for (const r of rows) if (mentions(r.name, input.window)) mentionedKeys.add(key(kind, r.id))
  }
  const seeds = new Set([...core.keys(), ...mentionedKeys])

  const candidates: { kind: Kind; r: Stamped; label: string; full: string }[] = [
    ...npcs.map((n) => ({ kind: 'npc' as const, r: n, label: n.name, full: npcLine(n, true) })),
    ...places.map((p) => ({ kind: 'place' as const, r: p, label: p.name, full: namedLine(p) })),
    ...factions.map((p) => ({ kind: 'faction' as const, r: p, label: p.name, full: namedLine(p) })),
    ...events.map((p) => ({ kind: 'event' as const, r: p, label: p.name, full: namedLine(p) })),
    ...facts.map((f) => ({ kind: 'fact' as const, r: f, label: f.title, full: factLine(f) }))
  ]
  const selected: Entry[] = []
  for (const c of candidates) {
    const k = key(c.kind, c.r.id)
    if (core.has(k)) continue
    const score =
      (mentionedKeys.has(k) ? SCORE.mention : 0) +
      ([...(links.get(k) ?? [])].some((o) => seeds.has(o)) ? SCORE.link : 0) +
      (recent(c.r) ? SCORE.recent : 0) +
      (created(c.r) ? SCORE.created : 0)
    if (score > 0) selected.push(entryOf(c.kind, c.r, c.label, c.full, -score))
  }

  const taken = new Set([...core.keys(), ...selected.map((e) => key(e.kind, e.id))])
  const gone = npcs
    .filter((n) => n.status !== 'alive' && !taken.has(key('npc', n.id)))
    .map((n) => entryOf('npc', n, `${n.name} (${n.status})`, '', 0))
    .sort(byRecency)
    .slice(0, GONE_LINE_MAX)

  const coreList = [...core.values()].sort(ranked)
  const selectedList = selected.sort(ranked)
  const degraded = new Set<string>()
  let goneList = gone

  const render = (): string | null => {
    const entries = [...coreList, ...selectedList]
    if (entries.length === 0 && goneList.length === 0) return null
    const lines = [options.header ?? MEMORY_HEADER]
    for (const kind of KIND_ORDER) {
      const rows = entries.filter((e) => e.kind === kind)
      if (rows.length === 0) continue
      lines.push(`${SECTION[kind]}:`)
      for (const e of rows) lines.push(degraded.has(key(e.kind, e.id)) ? e.nameOnly : e.full)
    }
    if (goneList.length > 0)
      lines.push(`Gone: ${goneList.map((g) => `${tag(g.id)}${g.label}`).join(', ')}`)
    return lines.join('\n')
  }

  // Overflow order, chosen deliberately (the spec's two statements about it disagree, and the
  // tests pin this one): drop selected records first (lowest score first), then degrade the
  // core to name-only (lowest rank first), then drop core entries, then the gone line. Records
  // never shrink mid-record. Keeping the core longest is the safer reading of "always on".
  let block = render()
  while (block !== null && estimateTokens(block) > budgetTokens) {
    if (selectedList.length > 0) selectedList.pop()
    else {
      const next = [...coreList].reverse().find((e) => !degraded.has(key(e.kind, e.id)))
      if (next) degraded.add(key(next.kind, next.id))
      else if (coreList.length > 0) coreList.pop()
      else goneList = []
    }
    block = render()
  }
  return block
}
