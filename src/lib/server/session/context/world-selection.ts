/**
 * World memory selection: a pure function of the records, the history text and a budget (see
 * GLOSSARY.md). The core is always included: the Scene's NPCs, `world_changing` facts and one
 * compact line naming the dead or retired. Everything else is scored by being named in history,
 * being linked to a Scene NPC and having changed recently, and fills what budget is left, highest
 * score first, as a full entry, else names-only, else not at all. The Narrator sees selected live
 * Facts but never per-NPC knowledge notes, so no disposition or knowledge text is an input here.
 */
import type { NpcStatus } from '#lib/memory/enums.ts'
import { estimateTokens } from '../../ai/tokens.ts'

export interface WorldPlaceRecord {
  id: string
  name: string
  description: string
  retired: boolean
  recent: boolean
}

export interface WorldNpcRecord {
  id: string
  name: string
  role: string
  description: string
  status: NpcStatus
  retired: boolean
  recent: boolean
}

/** A live Fact (not retired, not superseded) and the NPCs linked to it; links only score it. */
export interface WorldFactRecord {
  id: string
  title: string
  detail: string
  worldChanging: boolean
  recent: boolean
  npcIds: string[]
}

export interface WorldRecords {
  places: WorldPlaceRecord[]
  npcs: WorldNpcRecord[]
  facts: WorldFactRecord[]
}

export interface WorldSelectionInput {
  records: WorldRecords
  /** The NPC row ids present in the Scene. */
  sceneNpcIds: string[]
  /** The history text the Narrator will see, searched for names. */
  history: string
  /** Tokens the scored entries may use; the core is included regardless. */
  budget: number
}

type Level = 'full' | 'names' | 'dropped'

interface Entry {
  score: number
  full: string
  names: string
  level: Level
}

export interface WorldSelection {
  /** Always-on lines. */
  core: string[]
  /** Scored entries, highest score first; `level` says how much of each is shown. */
  scored: Entry[]
}

/** Score weights, per signal. Tunable. */
const MENTIONED = 4
const LINKED = 2
const RECENT = 1

const HEADER = 'World memory:'

const mentions = (history: string, name: string) =>
  history.includes(name.toLowerCase()) && name.length > 0

function goneLine(records: WorldRecords): string | undefined {
  const gone = [
    ...records.npcs
      .filter((n) => n.status === 'dead' || n.retired)
      .map((n) => `${n.name} (${n.retired ? 'retired' : 'dead'})`),
    ...records.places.filter((p) => p.retired).map((p) => `${p.name} (retired)`)
  ]
  return gone.length ? `- Gone: ${gone.join(', ')}` : undefined
}

export function selectWorldMemory(input: WorldSelectionInput): WorldSelection {
  const { records, history } = input
  const lower = history.toLowerCase()
  const scene = new Set(input.sceneNpcIds)
  const live = (n: WorldNpcRecord) => !n.retired && n.status !== 'dead'

  const core: string[] = []
  const inScene = records.npcs.filter((n) => scene.has(n.id) && live(n))
  for (const n of inScene) core.push(`- Here: ${n.name} (${n.role}): ${n.description}`)
  for (const f of records.facts.filter((f) => f.worldChanging)) {
    core.push(`- Established: ${f.title}: ${f.detail}`)
  }
  const gone = goneLine(records)
  if (gone) core.push(gone)

  const entries: Omit<Entry, 'level'>[] = []
  for (const n of records.npcs) {
    if (scene.has(n.id) || !live(n)) continue
    entries.push({
      score: (mentions(lower, n.name) ? MENTIONED : 0) + (n.recent ? RECENT : 0),
      full: `- ${n.name} (${n.role}): ${n.description}`,
      names: `- ${n.name}`
    })
  }
  for (const p of records.places) {
    if (p.retired) continue
    entries.push({
      score: (mentions(lower, p.name) ? MENTIONED : 0) + (p.recent ? RECENT : 0),
      full: `- Place ${p.name}: ${p.description}`,
      names: `- Place ${p.name}`
    })
  }
  for (const f of records.facts) {
    if (f.worldChanging) continue
    entries.push({
      score:
        (mentions(lower, f.title) ? MENTIONED : 0) +
        (f.npcIds.some((id) => scene.has(id)) ? LINKED : 0) +
        (f.recent ? RECENT : 0),
      full: `- ${f.title}: ${f.detail}`,
      names: `- ${f.title}`
    })
  }

  // Stable sort: equal scores keep records order (NPCs, places, then facts).
  entries.sort((a, b) => b.score - a.score)
  let used = estimateTokens([HEADER, ...core].join('\n'))
  const scored: Entry[] = entries.map((e) => {
    const cost = (text: string) => estimateTokens(text) + 1
    if (used + cost(e.full) <= input.budget) {
      used += cost(e.full)
      return { ...e, level: 'full' }
    }
    if (used + cost(e.names) <= input.budget) {
      used += cost(e.names)
      return { ...e, level: 'names' }
    }
    return { ...e, level: 'dropped' }
  })
  return { core, scored }
}

/** The World memory block; empty when there is nothing to show. */
export function renderWorldMemory(selection: WorldSelection): string {
  const shown = selection.scored.flatMap((e) =>
    e.level === 'full' ? [e.full] : e.level === 'names' ? [e.names] : []
  )
  const lines = [...selection.core, ...shown]
  return lines.length ? [HEADER, ...lines].join('\n') : ''
}

export const worldMemoryTokens = (selection: WorldSelection) =>
  estimateTokens(renderWorldMemory(selection))

/**
 * One trim step: the lowest-scoring entry still shown goes names-only, or is dropped when it
 * already is. Null when only the core is left.
 */
export function degradeWorldMemory(selection: WorldSelection): WorldSelection | null {
  let target = -1
  selection.scored.forEach((e, i) => {
    if (e.level !== 'dropped' && (target < 0 || e.score <= selection.scored[target].score))
      target = i
  })
  if (target < 0) return null
  const scored = selection.scored.map((e, i): Entry => {
    if (i !== target) return e
    const level: Level = e.level === 'full' && e.names !== e.full ? 'names' : 'dropped'
    return { ...e, level }
  })
  return { core: selection.core, scored }
}
