import { z } from 'zod'
import { NPC_STATUSES, type EntityType } from '#lib/world/entity-types.ts'

/** A Place's handle, as a field value that must name an existing Place. */
const placeHandle = z.string().regex(/^place:[a-z0-9-]+$/, 'Expected a place handle (place:…)')

const prose = z.string().trim()

/**
 * Each Entity type's typed fields. `name` is common to every type and kept outside `fields`. A
 * row field is the single owner of its value: Facts and Pages should not restate it.
 */
export const FIELD_SCHEMAS = {
  npc: z.strictObject({
    description: prose.optional(),
    role: prose.optional(),
    status: z.enum(NPC_STATUSES).default('alive'),
    whereabouts: placeHandle.optional(),
    stat_block: z
      .string()
      .regex(/^monster:[a-z0-9-]+$/, 'Expected a monster handle (monster:…)')
      .optional()
  }),
  place: z.strictObject({
    description: prose.optional(),
    exits: z.array(z.strictObject({ name: prose.min(1), to: placeHandle.optional() })).default([])
  }),
  faction: z.strictObject({ description: prose.optional() }),
  topic: z.strictObject({})
} satisfies Record<EntityType, z.ZodType>

export type Fields = Record<string, unknown>

/** The handles a type's fields point at, which must name existing Places. */
export function placeRefs(fields: Fields): string[] {
  const refs: string[] = []
  if (typeof fields.whereabouts === 'string') refs.push(fields.whereabouts)
  if (Array.isArray(fields.exits)) {
    for (const exit of fields.exits as { to?: string }[]) if (exit.to) refs.push(exit.to)
  }
  return refs
}

/** Parses a type's fields, or returns the problem in words. */
export function parseFields(
  type: EntityType,
  fields: unknown
): { ok: true; fields: Fields } | { ok: false; message: string } {
  const parsed = FIELD_SCHEMAS[type].safeParse(fields ?? {})
  if (parsed.success) return { ok: true, fields: parsed.data as Fields }
  return { ok: false, message: z.prettifyError(parsed.error) }
}

/** The field names a type has, besides `name`. */
export function fieldNames(type: EntityType): string[] {
  return Object.keys(FIELD_SCHEMAS[type].shape)
}
