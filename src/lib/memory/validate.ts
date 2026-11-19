import {
  BEAT_STATES,
  MEMORY_MAX,
  NPC_STATUSES,
  STANCES,
  type BeatState,
  type NpcStatus,
  type Stance
} from './enums'

/**
 * Pure validators for World memory records. Each returns the cleaned value or the reason it was
 * rejected, so a caller can drop an item and record why (never the item's text). The model only
 * proposes; these decide. Text must hold no digits: numbers and state belong to code.
 */
export type Check<T> = { ok: true; value: T } | { ok: false; reason: string }

const ok = <T>(value: T): Check<T> => ({ ok: true, value })
const fail = (reason: string): Check<never> => ({ ok: false, reason })

/** A name's identity key: lowercase, accents and punctuation dropped, whitespace collapsed. */
export function normalizeName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Trim, then require non-empty, within `max`, and digit-free. `label` names the field. */
function text(label: string, raw: unknown, max: number, required = true): Check<string> {
  if (typeof raw !== 'string') return fail(`${label} must be text`)
  const value = raw.trim()
  if (required && !value) return fail(`${label} is empty`)
  if (value.length > max) return fail(`${label} is over ${max} characters`)
  if (/\p{Nd}/u.test(value)) return fail(`${label} contains a digit`)
  return ok(value)
}

type Fields<T> = { [K in keyof T]: Check<T[K]> }

/** Combines per-field checks: the first failure wins, otherwise the cleaned record. */
function all<T extends object>(fields: Fields<T>): Check<T> {
  const out = {} as T
  for (const key of Object.keys(fields) as (keyof T)[]) {
    const c = fields[key]
    if (!c.ok) return c
    out[key] = c.value
  }
  return ok(out)
}

export interface NpcInput {
  name: string
  description: string
  role: string
}
export interface ValidNpc extends NpcInput {
  /** The normalized name, unique per Campaign. */
  nameKey: string
}

/** `takenKeys` holds the normalized names already used in the Campaign. */
export function validateNpc(input: NpcInput, ctx: { takenKeys: ReadonlySet<string> }) {
  const name = text('name', input.name, MEMORY_MAX.npcName)
  if (!name.ok) return name
  const nameKey = normalizeName(name.value)
  if (!nameKey) return fail('name has no letters')
  if (ctx.takenKeys.has(nameKey)) return fail('name is already taken in this Campaign')
  return all<ValidNpc>({
    name,
    description: text('description', input.description, MEMORY_MAX.npcDescription),
    role: text('role', input.role, MEMORY_MAX.npcRole),
    nameKey: ok(nameKey)
  })
}

/** Dead stays dead unless explicitly revived with a stated reason. */
export function validateNpcStatusChange(
  from: NpcStatus,
  to: NpcStatus,
  opts: { revivedReason?: string } = {}
): Check<NpcStatus> {
  if (!NPC_STATUSES.includes(to)) return fail('unknown status')
  if (from === 'dead' && to !== 'dead' && !opts.revivedReason?.trim())
    return fail('a dead NPC stays dead without a stated revival reason')
  return ok(to)
}

export interface DispositionInput {
  stance: string
  note: string
}

export function validateDisposition(input: DispositionInput) {
  if (!STANCES.includes(input.stance as Stance)) return fail('unknown stance')
  return all<{ stance: Stance; note: string }>({
    stance: ok(input.stance as Stance),
    note: text('note', input.note, MEMORY_MAX.dispositionNote, false)
  })
}

export interface FactInput {
  title: string
  detail: string
  worldChanging?: boolean
}

export function validateFact(input: FactInput) {
  return all<{ title: string; detail: string; worldChanging: boolean }>({
    title: text('title', input.title, MEMORY_MAX.factTitle),
    detail: text('detail', input.detail, MEMORY_MAX.factDetail),
    worldChanging: ok(input.worldChanging === true)
  })
}

export interface FactChange {
  supersededById?: string
  retiredReason?: string
  [other: string]: unknown
}

/** A Fact is immutable: it changes only by being superseded or retired, never edited. */
export function validateFactChange(change: FactChange): Check<{
  supersededById?: string
  retiredReason?: string
}> {
  const { supersededById, retiredReason, ...rest } = change
  if (Object.keys(rest).length) return fail('a fact is never edited; supersede or retire it')
  const out: { supersededById?: string; retiredReason?: string } = {}
  if (supersededById !== undefined) {
    if (!supersededById) return fail('superseding fact is missing')
    out.supersededById = supersededById
  }
  if (retiredReason !== undefined) {
    const r = text('reason', retiredReason, MEMORY_MAX.retiredReason)
    if (!r.ok) return r
    out.retiredReason = r.value
  }
  if (out.supersededById === undefined && out.retiredReason === undefined)
    return fail('nothing to change')
  return ok(out)
}

/** The reason recorded when a place, NPC or fact is retired. */
export const validateRetiredReason = (raw: string) => text('reason', raw, MEMORY_MAX.retiredReason)

export function validatePlace(input: { name: string; description: string }) {
  return all<{ name: string; description: string }>({
    name: text('name', input.name, MEMORY_MAX.placeName),
    description: text('description', input.description, MEMORY_MAX.placeDescription)
  })
}

export const validateExitName = (raw: string) => text('exit name', raw, MEMORY_MAX.exitName)

/** A Rolling summary is prose: no digits, capped in code. */
export const validateSummary = (raw: string) => text('summary', raw, MEMORY_MAX.summary)

/** A Beat leaves `pending` once, for `reached` or `abandoned`, and never returns. */
export function validateBeatTransition(from: BeatState, to: BeatState): Check<BeatState> {
  if (!BEAT_STATES.includes(to)) return fail('unknown Beat state')
  if (from !== 'pending') return fail(`a ${from} Beat does not change again`)
  if (to === 'pending') return fail('a Beat only leaves pending')
  return ok(to)
}
