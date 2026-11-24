import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { MAX_LEVEL } from '#lib/character/level-up.ts'
import { formatClock } from '#lib/play/clock.ts'
import type { Queryable } from '../db/connect'
import { equippable, isBodyArmor } from '#lib/rules/armor-class.ts'
import { character, characterItem, equipment, type Coin } from '../db/schema'
import { loadWizardRules } from '../character/wizard-rules'
import { createHitDiceCall, type HitDicePart } from '../play/calls'
import { combatant, type Combatant } from '../play/combatants'
import { advanceClock, currentMinute } from '../play/scene'
import { ToolError, writeTool } from './contract'

/*
 * Rests by the SRD. A short rest is an hour: Characters may spend Hit Dice (one Call asks each
 * Player how many) and regain short-rest feature uses and a Warlock's Pact Magic slots. A long rest
 * is eight hours: all HP, all slots, all feature uses, and spent Hit Dice up to half the
 * Character's level (at least one); temporary HP end. A Character at 0 HP gains nothing from a
 * long rest. The clock moves inside the rest's own transaction.
 */

type CharacterCombatant = Extract<Combatant, { kind: 'character' }>

/** The Characters a rest names: Characters only. */
export function restingCharacters(db: Queryable, who: string[]): CharacterCombatant[] {
  return who.map((ref) => {
    const found = combatant(db, ref)
    if (found.kind !== 'character') {
      throw new ToolError(
        'not_a_character',
        `${found.name} is not a Character`,
        'NPCs rest when you say so; name only Characters'
      )
    }
    return found
  })
}

/**
 * Features whose uses come back on a short rest (SRD class tables), by slug prefix. Every other
 * feature waits for a long rest. Bardic Inspiration joins them with Font of Inspiration.
 */
const SHORT_REST_FEATURES = ['second-wind', 'action-surge', 'channel-divinity', 'wild-shape', 'ki']

function shortRestFeature(c: CharacterCombatant, slug: string): boolean {
  if (SHORT_REST_FEATURES.some((p) => slug === p || slug.startsWith(`${p}-`))) return true
  return (
    slug.startsWith('bardic-inspiration') &&
    c.features.some((f) => f.slug === 'font-of-inspiration')
  )
}

/** A Character's Hit Die size, from its class. */
const hitDieOf = (c: CharacterCombatant) =>
  loadWizardRules().classes.find((k) => k.slug === c.detail.classSlug)?.hitDie ?? 8

/**
 * What a short rest returns to one Character: short-rest feature uses and, for a Warlock, Pact
 * Magic slots. Returns the Hit Dice part to ask about, when hurt with Hit Dice left.
 */
function shortRest(db: Queryable, c: CharacterCombatant): HitDicePart | null {
  const featureUses = Object.fromEntries(
    Object.entries(c.detail.featureUses).filter(([slug]) => !shortRestFeature(c, slug))
  )
  const spentSlots =
    c.detail.classSlug === 'warlock' ? [0, 0, 0, 0, 0, 0, 0, 0, 0] : c.detail.spentSlots
  db.update(character).set({ featureUses, spentSlots }).where(eq(character.id, c.id)).run()
  const available = c.detail.level - c.detail.hitDiceSpent
  if (available <= 0 || c.hp >= c.maxHp) return null
  const con = c.stats.abilities.con
  return {
    characterId: c.id,
    player: c.player,
    die: hitDieOf(c),
    available,
    conModifier: con.status === 'ok' ? con.value.modifier : 0
  }
}

/** What a long rest restores to one Character, applied in the caller's transaction. */
function longRest(db: Queryable, c: CharacterCombatant) {
  if (c.hp === 0) return { character: c.handle, restored: false, reason: 'at 0 HP' }
  const level = c.detail.level
  const regained = Math.min(c.detail.hitDiceSpent, Math.max(1, Math.floor(level / 2)))
  db.update(character)
    .set({
      currentHp: c.maxHp,
      tempHp: 0,
      spentSlots: [0, 0, 0, 0, 0, 0, 0, 0, 0],
      featureUses: {},
      hitDiceSpent: c.detail.hitDiceSpent - regained
    })
    .where(eq(character.id, c.id))
    .run()
  return {
    character: c.handle,
    restored: true,
    hp: c.maxHp,
    hit_dice: level - (c.detail.hitDiceSpent - regained)
  }
}

/** An SRD item by slug or name, or a refusal pointing at lookup. */
function srdItem(db: Queryable, name: string) {
  const key = name.trim().toLowerCase()
  const slug = key
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  const found = db
    .select()
    .from(equipment)
    .all()
    .find((e) => e.slug === slug || e.name.toLowerCase() === key)
  if (!found) {
    throw new ToolError(
      'unknown_item',
      `No SRD item is called ${name}`,
      'Find the item with lookup({query}) and use its slug; describe anything else in narration'
    )
  }
  return found
}

/** One Character's carried stack of an item, or null. */
const carried = (db: Queryable, characterId: string, itemId: number) =>
  db
    .select()
    .from(characterItem)
    .where(and(eq(characterItem.characterId, characterId), eq(characterItem.itemId, itemId)))
    .get() ?? null

const stack = (characterId: string, itemId: number) =>
  and(eq(characterItem.characterId, characterId), eq(characterItem.itemId, itemId))

function notCarried(who: CharacterCombatant, item: { name: string }) {
  return new ToolError(
    'not_carried',
    `${who.name} doesn't carry ${item.name}`,
    `Check ${who.name}'s inventory with sheet, or give the item first`
  )
}

/** A Character tool's target: one Character. */
const characterOf = (db: Queryable, ref: string) => restingCharacters(db, [ref])[0]

const itemInput = {
  character: z.string().min(1).describe('char:…'),
  item: z.string().min(1).describe('An SRD item by slug or name, such as torch or chain-mail')
}

const DENOMINATIONS = ['cp', 'sp', 'ep', 'gp', 'pp'] as const

export const restTools = [
  writeTool({
    name: 'rest',
    description:
      'Run a rest by the SRD for the named Characters. long: 8 hours; all HP, slots and feature uses, Hit Dice up to half their level, temporary HP end (nothing for a Character at 0 HP). short: 1 hour; short-rest features and Pact Magic return, and a pending Call asks each Player how many Hit Dice to spend: attach it with your closing narrate(text, call: id). The clock moves with the rest.',
    input: z.object({
      kind: z.enum(['short', 'long']),
      who: z.array(z.string().min(1)).min(1).describe('The resting Characters: char:…')
    }),
    activity: (input) => `DM runs a ${input.kind} rest`,
    run: ({ db, now }, input) => {
      const resting = restingCharacters(db, input.who)
      const from = currentMinute(db)
      const { to } = advanceClock(db, from + (input.kind === 'long' ? 8 : 1) * 60)
      const clock = { kind: input.kind, clock: formatClock(to), minute: to }
      let result: Record<string, unknown>
      if (input.kind === 'long') {
        result = { ...clock, characters: resting.map((c) => longRest(db, c)) }
      } else {
        const parts = resting.flatMap((c) => shortRest(db, c) ?? [])
        const id = parts.length ? createHitDiceCall(db, parts, now) : null
        result = {
          ...clock,
          ...(id && {
            pending_call: id,
            next: `Attach it with your closing narrate(text, call: "${id}"): each Player says how many Hit Dice to spend`
          })
        }
      }
      return {
        result,
        event: {
          kind: 'rest',
          summary: `${resting.map((c) => c.name).join(', ')} finish a ${input.kind} rest`,
          data: { kind: input.kind, characters: resting.map((c) => c.handle), to }
        }
      }
    }
  }),

  writeTool({
    name: 'give',
    description:
      'Give a Character SRD items: loot, a purchase, a gift. No encumbrance. For anything outside the SRD item list, narrate it instead.',
    input: z.object({ ...itemInput, quantity: z.number().int().min(1).default(1) }),
    activity: 'DM changes an inventory',
    run: ({ db }, input) => {
      const who = characterOf(db, input.character)
      const item = srdItem(db, input.item)
      const have = carried(db, who.id, item.id)
      const quantity = (have?.quantity ?? 0) + input.quantity
      if (have) {
        db.update(characterItem).set({ quantity }).where(stack(who.id, item.id)).run()
      } else {
        db.insert(characterItem).values({ characterId: who.id, itemId: item.id, quantity }).run()
      }
      return {
        result: { character: who.handle, item: item.slug, quantity },
        event: {
          kind: 'item_given',
          summary: `${who.name} gains ${input.quantity} × ${item.name}`,
          data: { character: who.handle, item: item.slug, quantity: input.quantity }
        }
      }
    }
  }),

  writeTool({
    name: 'take',
    description:
      "Take SRD items from a Character: used up, dropped, sold, stolen. Refused for what the Character doesn't carry.",
    input: z.object({ ...itemInput, quantity: z.number().int().min(1).default(1) }),
    activity: 'DM changes an inventory',
    run: ({ db }, input) => {
      const who = characterOf(db, input.character)
      const item = srdItem(db, input.item)
      const have = carried(db, who.id, item.id)
      if (!have || have.quantity < input.quantity) {
        if (!have) throw notCarried(who, item)
        throw new ToolError(
          'not_carried',
          `${who.name} carries only ${have.quantity} × ${item.name}`,
          `Take at most ${have.quantity}`
        )
      }
      const quantity = have.quantity - input.quantity
      if (quantity === 0) db.delete(characterItem).where(stack(who.id, item.id)).run()
      else db.update(characterItem).set({ quantity }).where(stack(who.id, item.id)).run()
      return {
        result: { character: who.handle, item: item.slug, quantity },
        event: {
          kind: 'item_taken',
          summary: `${who.name} loses ${input.quantity} × ${item.name}`,
          data: { character: who.handle, item: item.slug, quantity: input.quantity }
        }
      }
    }
  }),

  writeTool({
    name: 'equip',
    description:
      'Equip armor, a shield or a weapon a Character carries. Equipped armor and shield set AC; a new suit of armor replaces the one worn.',
    input: z.object(itemInput),
    activity: 'DM changes what a Character wears',
    run: ({ db }, input) => {
      const who = characterOf(db, input.character)
      const item = srdItem(db, input.item)
      if (!carried(db, who.id, item.id)) throw notCarried(who, item)
      if (!equippable(item)) {
        throw new ToolError(
          'not_equippable',
          `${item.name} isn't armor, a shield or a weapon`,
          'Only armor, shields and weapons are equipped; the rest is just carried'
        )
      }
      if (isBodyArmor(item) || item.armorCategory === 'Shield') {
        // One suit of armor and one shield at a time.
        const same = db
          .select({ itemId: characterItem.itemId, armorCategory: equipment.armorCategory })
          .from(characterItem)
          .innerJoin(equipment, eq(equipment.id, characterItem.itemId))
          .where(and(eq(characterItem.characterId, who.id), eq(characterItem.equipped, true)))
          .all()
          .filter((e) =>
            item.armorCategory === 'Shield' ? e.armorCategory === 'Shield' : isBodyArmor(e)
          )
        for (const e of same) {
          db.update(characterItem).set({ equipped: false }).where(stack(who.id, e.itemId)).run()
        }
      }
      db.update(characterItem).set({ equipped: true }).where(stack(who.id, item.id)).run()
      return {
        result: { character: who.handle, equipped: item.slug, ac: characterOf(db, who.id).ac },
        event: {
          kind: 'item_equipped',
          summary: `${who.name} equips ${item.name}`,
          data: { character: who.handle, item: item.slug }
        }
      }
    }
  }),

  writeTool({
    name: 'unequip',
    description: 'Take off or stow armor, a shield or a weapon; the Character keeps carrying it.',
    input: z.object(itemInput),
    activity: 'DM changes what a Character wears',
    run: ({ db }, input) => {
      const who = characterOf(db, input.character)
      const item = srdItem(db, input.item)
      const have = carried(db, who.id, item.id)
      if (!have) throw notCarried(who, item)
      if (!have.equipped) {
        throw new ToolError(
          'not_equipped',
          `${who.name} doesn't have ${item.name} equipped`,
          'Nothing to do; read the sheet for what is equipped'
        )
      }
      db.update(characterItem).set({ equipped: false }).where(stack(who.id, item.id)).run()
      return {
        result: { character: who.handle, unequipped: item.slug, ac: characterOf(db, who.id).ac },
        event: {
          kind: 'item_unequipped',
          summary: `${who.name} unequips ${item.name}`,
          data: { character: who.handle, item: item.slug }
        }
      }
    }
  }),

  writeTool({
    name: 'coin',
    description:
      "Change a Character's coin by denomination: positive to gain, negative to pay, such as {gp: -5, sp: 3}. Refused when a denomination would go below 0; make change yourself with one call that converts.",
    input: z.object({
      character: z.string().min(1).describe('char:…'),
      change: z
        .object(Object.fromEntries(DENOMINATIONS.map((d) => [d, z.number().int().optional()])))
        .refine((c) => Object.values(c).some((v) => v), { message: 'Change at least one coin' })
    }),
    activity: "DM changes a Character's coin",
    run: ({ db }, input) => {
      const who = characterOf(db, input.character)
      const coin = { ...who.detail.coin }
      for (const d of DENOMINATIONS) coin[d] += input.change[d] ?? 0
      const short = DENOMINATIONS.filter((d) => coin[d] < 0)
      if (short.length) {
        const held = DENOMINATIONS.map((d) => `${who.detail.coin[d]} ${d}`).join(', ')
        throw new ToolError(
          'not_enough_coin',
          `${who.name} doesn't have enough ${short.join(', ')} (has ${held})`,
          'Pay in other denominations, converting in the same call (1 gp = 10 sp = 100 cp)'
        )
      }
      db.update(character).set({ coin }).where(eq(character.id, who.id)).run()
      const change = DENOMINATIONS.flatMap((d) =>
        input.change[d] ? [`${input.change[d]! > 0 ? '+' : ''}${input.change[d]} ${d}`] : []
      ).join(', ')
      return {
        result: { character: who.handle, coin },
        event: {
          kind: 'coin',
          summary: `${who.name}: ${change}`,
          data: { character: who.handle, change: input.change, coin: coin satisfies Coin }
        }
      }
    }
  }),

  writeTool({
    name: 'award_level',
    description:
      'Award a milestone level to Characters. Each Player then takes the level-up in the UI, choosing any new spells; code applies HP, slots and features. You cannot level a Character yourself.',
    input: z.object({
      characters: z.array(z.string().min(1)).min(1).describe('char:… handles')
    }),
    activity: 'DM awards a level',
    run: ({ db }, input) => {
      const awarded = restingCharacters(db, input.characters).map((c) => {
        const levels = c.detail.levelsAwarded + 1
        if (c.detail.level + levels > MAX_LEVEL) {
          throw new ToolError(
            'max_level',
            `${c.name} is already at level ${MAX_LEVEL}`,
            'Leave them out of the award'
          )
        }
        db.update(character).set({ levelsAwarded: levels }).where(eq(character.id, c.id)).run()
        return { character: c.handle, to_take: levels, next_level: c.detail.level + 1 }
      })
      return {
        result: {
          awarded,
          next: 'The Player levels up in the UI; you hear of it as a change'
        },
        event: {
          kind: 'level_awarded',
          summary: `Level awarded to ${awarded.map((a) => a.character).join(', ')}`,
          data: { awarded }
        }
      }
    }
  })
]
