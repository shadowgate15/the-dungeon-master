import { handleKind } from '#lib/world/entity-types.ts'
import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { formatClock, parseClock } from '#lib/play/clock.ts'
import type { Queryable } from '../db/connect'
import { campaign, character, entity } from '../db/schema'
import { returnStrandedDrafts } from '../floor/floor'
import {
  advanceClock,
  characterRefs,
  ClockBackwardsError,
  currentMinute,
  floorsWaited,
  present,
  scenePlace
} from '../play/scene'
import { refuseDuringCombat } from '../play/combat'
import { readTool, ToolError, writeTool, type ToolContext } from './contract'

type Exit = { name: string; to?: string }

/** A live Place, or `unknown_handle`. */
function placeAt(db: Queryable, handle: string) {
  const found = db.select().from(entity).where(eq(entity.handle, handle)).get()
  if (!found || found.type !== 'place' || found.retiredAt !== null) {
    throw ToolError.unknownHandle(handle)
  }
  return found
}

function bump(db: Queryable, handle: string, fields: Record<string, unknown>): number {
  return db
    .update(entity)
    .set({ fields, version: sql`${entity.version} + 1` })
    .where(eq(entity.handle, handle))
    .returning({ version: entity.version })
    .get().version
}

/** Whoever `who` names: Characters by `char:` handle, live NPCs by `npc:` handle. */
function movers({ db }: ToolContext, who: string[]) {
  const party = characterRefs(db)
  return who.map((handle) => {
    const member = party.find((c) => c.handle === handle)
    if (member) {
      return { handle, name: member.row.name, at: member.row.whereabouts, character: member.row.id }
    }
    const npc = db.select().from(entity).where(eq(entity.handle, handle)).get()
    if (!npc || npc.type !== 'npc' || npc.retiredAt !== null) throw ToolError.unknownHandle(handle)
    const at = typeof npc.fields.whereabouts === 'string' ? npc.fields.whereabouts : null
    return { handle, name: npc.name, at, character: null }
  })
}

/** The Scene as the DM reads it: Place, clock, who is present and where the rest of the Party is. */
function sceneView(db: Queryable) {
  const { place, characters, elsewhere, npcs } = present(db)
  const minute = currentMinute(db)
  return {
    scene: place && { handle: place.handle, name: place.name },
    clock: formatClock(minute),
    minute,
    present: {
      characters: characters.map((c) => ({ handle: c.handle, name: c.row.name })),
      npcs: npcs.map((n) => ({
        handle: n.handle,
        name: n.name,
        role: n.fields.role ?? null,
        description: n.fields.description ?? null
      }))
    },
    elsewhere: elsewhere.map((c) => ({
      handle: c.handle,
      name: c.row.name,
      whereabouts: c.row.whereabouts,
      floorsWaited: c.row.whereabouts ? floorsWaited(db, c.handle, c.row.whereabouts) : 0
    }))
  }
}

const count = z.int().min(0)

const advanceInput = z
  .strictObject({
    minutes: count.optional(),
    hours: count.optional(),
    days: count.optional(),
    to: z
      .union([count, z.string()])
      .optional()
      .describe('A clock reading ("day 3, 14:20") or a minute, instead of minutes/hours/days')
  })
  .refine(
    (d) =>
      (d.to === undefined) !==
      (d.minutes === undefined && d.hours === undefined && d.days === undefined),
    { message: 'Pass minutes, hours or days, or to (not both)' }
  )

/** Where the spotlight is and what time it is. */
export const sceneTools = [
  readTool({
    name: 'scene',
    description:
      'Read the Scene: its Place, the clock, the Characters and NPCs present, and where each Character elsewhere is.',
    input: z.strictObject({}),
    run: ({ db }) => sceneView(db)
  }),

  writeTool({
    name: 'move',
    description:
      'Set where Characters (char:…) and NPCs (npc:…) are. Pass to (a Place), or via (an exit of the Place they are at) to go through it. An exit whose destination is open needs to as well, and is fixed to it for good. Moving does not move the spotlight: call set_scene for that.',
    input: z
      .strictObject({
        who: z.array(z.string().min(1)).min(1),
        to: z.string().min(1).optional().describe('Place handle'),
        via: z.string().min(1).optional().describe("Exit name on the movers' Place")
      })
      .refine((m) => m.to !== undefined || m.via !== undefined, { message: 'Pass to or via' }),
    activity: (_, result) => {
      const names = (result.moved as { handle: string; name: string }[])
        .filter((m) => handleKind(m.handle) === 'char')
        .map((m) => m.name)
      return names.length ? `DM moves ${names.join(', ')}` : null
    },
    run: (ctx, { who, to, via }) => {
      const { db } = ctx
      const moving = movers(ctx, [...new Set(who)])
      let destination = to
      let fixed: { place: string; exit: string; to: string; version: number } | null = null
      if (via !== undefined) {
        const from = [...new Set(moving.map((m) => m.at))]
        if (from.length !== 1 || from[0] === null) {
          throw new ToolError(
            'not_together',
            `To go via an exit, everyone must be at the same Place (${moving.map((m) => `${m.handle} at ${m.at ?? 'nowhere'}`).join(', ')})`,
            'Move them separately, or pass to instead of via'
          )
        }
        const place = placeAt(db, from[0])
        const exits = (place.fields.exits ?? []) as Exit[]
        const index = exits.findIndex((e) => e.name.toLowerCase() === via.toLowerCase())
        if (index < 0) {
          throw new ToolError(
            'unknown_exit',
            `${place.handle} has no exit named "${via}" (exits: ${exits.map((e) => e.name).join(', ') || 'none'})`,
            `Open ${place.handle} to see its exits`
          )
        }
        const exit = exits[index]
        if (exit.to !== undefined) {
          if (to !== undefined && to !== exit.to) {
            throw ToolError.invalidInput('move', `"${exit.name}" leads to ${exit.to}, not ${to}`)
          }
          destination = exit.to
        } else {
          if (to === undefined) {
            throw ToolError.invalidInput(
              'move',
              `"${exit.name}" has no destination yet: pass to, and it leads there for good`
            )
          }
          placeAt(db, to)
          const next = exits.map((e, i) => (i === index ? { ...e, to } : e))
          const version = bump(db, place.handle, { ...place.fields, exits: next })
          fixed = { place: place.handle, exit: exit.name, to, version }
        }
      }
      const target = placeAt(db, destination!)
      for (const m of moving) {
        if (m.character !== null) {
          db.update(character)
            .set({ whereabouts: target.handle })
            .where(eq(character.id, m.character))
            .run()
        } else {
          const npc = db.select().from(entity).where(eq(entity.handle, m.handle)).get()!
          bump(db, m.handle, { ...npc.fields, whereabouts: target.handle })
        }
      }
      const moved = moving.map((m) => ({ handle: m.handle, name: m.name }))
      return {
        result: { moved, to: { handle: target.handle, name: target.name }, fixed },
        event: {
          kind: 'moved',
          summary: `${moved.map((m) => m.name).join(', ')} to ${target.name}${via ? ` via ${via}` : ''}`,
          data: { who: moved.map((m) => m.handle), to: target.handle, via: via ?? null, fixed },
          dmOnly: !moving.some((m) => m.character !== null)
        }
      }
    }
  }),

  writeTool({
    name: 'set_scene',
    description:
      'Move the spotlight to a Place. Refused unless a Character is there (move them first), and while a Combat is live. Who is present follows from whereabouts. On a cut, Declarations for Characters no longer in the Scene go back to their Player as unsent text and the Floor reopens. Honour a spotlight request within a Floor or two, at a natural break.',
    input: z.strictObject({ place: z.string().min(1).describe('Place handle') }),
    activity: 'DM sets the Scene',
    run: ({ db, now }, { place: handle }) => {
      refuseDuringCombat(db, 'moving the spotlight')
      const place = placeAt(db, handle)
      const party = characterRefs(db).filter((c) => c.row.status === 'alive')
      if (!party.some((c) => c.row.whereabouts === place.handle)) {
        throw new ToolError(
          'nobody_there',
          `No Character is at ${place.handle}`,
          `Call move with the Characters going to ${place.handle} first`
        )
      }
      const cut = scenePlace(db)?.handle !== place.handle
      db.update(campaign).set({ scene: place.handle }).run()
      const returned = cut ? returnStrandedDrafts(db, place.handle, now) : 0
      const view = sceneView(db)
      return {
        result: { ...view, scene: view.scene!, returned },
        event: {
          kind: 'scene_set',
          summary: `Scene: ${place.name}`,
          data: { place: place.handle, name: place.name, returned }
        }
      }
    }
  }),

  writeTool({
    name: 'advance_time',
    description:
      'Move the Campaign clock forward: by {minutes, hours, days} (they add up) or to a clock reading ("day 3, 14:20"). The clock never moves backwards. Keep split groups roughly in step: advance before a cut and narrate "meanwhile" for a group that fell behind.',
    input: advanceInput,
    activity: (_, result) => `Time passes: ${String(result.clock)}`,
    run: ({ db }, input) => {
      const from = currentMinute(db)
      let to: number
      if (input.to !== undefined) {
        const parsed = typeof input.to === 'number' ? input.to : parseClock(input.to)
        if (parsed === null) {
          throw ToolError.invalidInput(
            'advance_time',
            `"${input.to}" is not a clock reading like "day 3, 14:20"`
          )
        }
        to = parsed
      } else {
        to = from + (input.minutes ?? 0) + (input.hours ?? 0) * 60 + (input.days ?? 0) * 24 * 60
      }
      try {
        advanceClock(db, to)
      } catch (e) {
        if (e instanceof ClockBackwardsError) {
          throw new ToolError(
            'clock_backwards',
            e.message,
            'Pass a later time, or leave the clock as it is'
          )
        }
        throw e
      }
      const clock = formatClock(to)
      return {
        result: { minute: to, clock },
        event: { kind: 'time_advanced', summary: `Clock: ${clock}`, data: { from, to } }
      }
    }
  })
]
