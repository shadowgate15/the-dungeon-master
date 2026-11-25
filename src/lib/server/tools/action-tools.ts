import { eq } from 'drizzle-orm'
import { z } from 'zod'
import type { AbilityKey } from '#lib/rules/derive-stats.ts'
import type { Queryable } from '../db/connect'
import { hpState } from '#lib/play/hp-state.ts'
import { character } from '../db/schema'
import type { Dice } from '../dice'
import {
  ABILITY_NAMES,
  cancelPendingCall,
  createPendingCall,
  DC_BY_TIER,
  PASS,
  saveKey,
  TIERS,
  type PendingPart
} from '../play/calls'
import {
  applyDamage,
  applyHealing,
  combatant,
  incapacitates,
  mustAct,
  saveBonus,
  setConditions,
  type Combatant
} from '../play/combatants'
import {
  attackSequence,
  damageSequence,
  rollAll,
  saveSequence,
  sequenceText,
  type Sequence,
  type StepRolled
} from '../play/sequences'
import { spendTurnResource } from '../play/combat'
import { concentrate, setConcentration } from '../play/concentration'
import { createRulesRepository } from '../rules/repository'
import { ToolError, writeTool, type ToolEvent } from './contract'

/*
 * Action tools branch on who acts. A Character's roll is the Player's to click: the tool stores a
 * pending Call and returns its id for the closing `narrate(..., call: id)`. An NPC rolls at once,
 * inside the tool call, and its rolls go to the dice log. Code owns every number.
 */

const adv = {
  adv: z.enum(['advantage', 'disadvantage']).optional(),
  reason: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe('Why advantage or disadvantage, shown to the Player')
}

type Mode = { mode: 'normal' | 'advantage' | 'disadvantage'; reason: string | null }
const modeOf = (input: { adv?: 'advantage' | 'disadvantage'; reason?: string }): Mode => ({
  mode: input.adv ?? 'normal',
  reason: input.adv ? (input.reason ?? '') : null
})

const pendingNext = (id: string) =>
  `Attach it with your closing narrate(text, call: "${id}"), or drop it with cancel_call`

/** An attack a combatant can make: its name, to-hit bonus and damage. */
type Attack = { name: string; bonus: number; damage: { dice: string; damageType: string } | null }

const withModifier = (dice: string, modifier: number) =>
  modifier === 0 ? dice : `${dice}${modifier > 0 ? '+' : '-'}${Math.abs(modifier)}`

/** The attacks a combatant has: a Character's weapons, an NPC's stat block actions. */
function attacksOf(who: Combatant): Attack[] {
  if (who.kind === 'character') {
    const attacks = who.stats.attacks.status === 'ok' ? who.stats.attacks.value : []
    return attacks.map((a) => ({
      name: a.name,
      bonus: a.attackBonus,
      damage: a.damage && {
        dice: withModifier(a.damage.dice, a.damage.modifier),
        damageType: a.damage.type
      }
    }))
  }
  type Action = {
    name: string
    attack_bonus?: number
    damage?: { damage_dice?: string; damage_type?: string }[]
  }
  return (who.monster.actions as Action[]).flatMap((a) => {
    if (a.attack_bonus === undefined) return []
    const first = a.damage?.find((d) => d.damage_dice && d.damage_type)
    return [
      {
        name: a.name,
        bonus: a.attack_bonus,
        damage: first
          ? { dice: first.damage_dice!, damageType: first.damage_type!.toLowerCase() }
          : null
      }
    ]
  })
}

/** The attack `with` names: exactly by name, or the one whose name contains it. */
function findAttack(who: Combatant, name: string): Attack {
  const attacks = attacksOf(who)
  const key = name.trim().toLowerCase()
  const found =
    attacks.find((a) => a.name.toLowerCase() === key) ??
    attacks.find((a) => a.name.toLowerCase().includes(key))
  if (!found) {
    throw new ToolError(
      'unknown_attack',
      `${who.name} has no attack called ${name}`,
      attacks.length
        ? `Use one of ${who.name}'s attacks: ${attacks.map((a) => a.name).join(', ')}`
        : `${who.name} has no attacks; use roll and damage for an improvised one`
    )
  }
  return found
}

/** One roll in the dice log, Player-safe: no AC, DC or NPC HP number. */
type DiceLogRoll = {
  characterName: string
  what: string
  dice: number[]
  modifier: number
  total: number
  outcome: string | null
  mode: Mode['mode']
  reason: string | null
  target: StepRolled['targetState']
}

function diceLogRoll(roller: string, rolled: StepRolled, mode: Mode): DiceLogRoll {
  const d20 = rolled.roll.kept !== null
  return {
    characterName: roller,
    what: rolled.what,
    dice: rolled.roll.dice,
    modifier: rolled.roll.modifier,
    total: rolled.roll.total,
    outcome: rolled.roll.outcome,
    mode: d20 ? mode.mode : 'normal',
    reason: d20 ? mode.reason : null,
    target: rolled.targetState
  }
}

/** A sequence and who rolls it: the attacker for an attack, the target for a save. */
type Roll = { roller: Combatant; sequence: Sequence; mode: Mode }

/** A roll code made before the sequences, such as a save spell's damage, rolled once for all. */
type PreRoll = { text: string; log: DiceLogRoll }

/**
 * Resolves rolls by who makes them. A Character's rolls go into one pending Call for the closing
 * narrate to attach; an NPC's roll now. Returns the DM's result and the one Event: the dice log
 * when anything rolled, else a DM-only note of the pending Call.
 */
function resolve(
  db: Queryable,
  dice: Dice,
  now: number,
  rolls: Roll[],
  {
    summary,
    pre = [],
    result = {}
  }: { summary: string; pre?: PreRoll[]; result?: Record<string, unknown> }
): { result: Record<string, unknown>; event: ToolEvent } {
  const parts: PendingPart[] = rolls.flatMap(({ roller, sequence, mode }) =>
    roller.kind === 'character'
      ? [{ characterId: roller.id, player: roller.player, sequence, ...mode }]
      : []
  )
  const id = parts.length ? createPendingCall(db, parts, now) : null
  const outcomes = rolls
    .filter((r) => r.roller.kind !== 'character')
    .map((r) => ({ ...r, ...rollAll(db, r.sequence, dice, { ...r.mode, at: now }) }))
  const concentration = outcomes.flatMap((o) => o.sequence.rolls.flatMap((r) => r.calls ?? []))
  const log = [
    ...pre.map((p) => p.log),
    ...outcomes.flatMap((o) => o.steps.map((s) => diceLogRoll(o.roller.name, s, o.mode)))
  ]
  const text = [
    ...pre.map((p) => p.text),
    ...outcomes.map((o) => sequenceText(o.sequence, o.mode.mode))
  ]
  const full = {
    ...result,
    ...(text.length && {
      rolled: text.join('\n'),
      targets: outcomes.map((o) => {
        const last = o.sequence.rolls.findLast((r) => r.after)
        return { handle: o.sequence.target.handle, hp: last?.after?.hp ?? null }
      })
    }),
    ...(id && { pending_call: id, next: pendingNext(id) }),
    ...concentrationCalls(concentration)
  }
  if (!log.length) {
    return {
      result: full,
      event: { kind: id ? 'call_pending' : 'action', summary, data: { call: id }, dmOnly: true }
    }
  }
  return {
    result: full,
    event: {
      kind: 'rolls',
      summary: log
        .map((r) => `${r.characterName} ${r.what}: ${r.total}${r.outcome ? ` (${r.outcome})` : ''}`)
        .join('; '),
      data: { rolls: log, call: id }
    }
  }
}

/** Pending concentration saves damage made, each for a closing narrate to attach. */
const concentrationCalls = (ids: string[]) =>
  ids.length
    ? {
        concentration_calls: ids,
        concentration_next: `Attach each with a closing narrate(text, call: id), one per turn`
      }
    : {}

/** Adds an action-economy reminder to a tool's result. */
function withReminder<T extends { result: Record<string, unknown> }>(
  reminder: string | null,
  out: T
): T {
  return reminder ? { ...out, result: { ...out.result, reminder } } : out
}

const abilityName = (ability: AbilityKey) => ABILITY_NAMES.get(ability) ?? ability

/** Rolls an effect's damage once, for every target's save. */
function preRollDamage(
  dice: Dice,
  by: string,
  what: string,
  expression: string,
  damageType: string | null
) {
  const rolled = dice.rollExpression(expression)
  const total = Math.max(0, rolled.total)
  const modifier = rolled.modifier
    ? ` ${rolled.modifier > 0 ? '+' : '-'} ${Math.abs(rolled.modifier)}`
    : ''
  return {
    total,
    pre: {
      text: `${what}: ${rolled.dice.join(' + ')}${modifier} = ${total}${damageType ? ` ${damageType}` : ''}`,
      log: {
        characterName: by,
        what,
        dice: rolled.dice,
        modifier: rolled.modifier,
        total,
        outcome: null,
        mode: 'normal' as const,
        reason: null,
        target: null
      }
    }
  }
}

/** A spell as the rules repository returns it. */
type Spell = ReturnType<ReturnType<typeof createRulesRepository>['spells']>[number]
type SpellDamage = {
  damage_type?: string
  damage_at_slot_level?: Record<string, string>
  damage_at_character_level?: Record<string, string>
}

const slugOf = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/^(spell|condition):/, '')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')

/** What a caster casts with: spell attack bonus, save DC, caster level, and the spells it has. */
function casting(
  who: Combatant
): { attackBonus: number; saveDc: number; level: number; spells: string[] } | null {
  if (who.kind === 'character') {
    const stat = who.stats.spellcasting
    const value = stat.status === 'ok' ? stat.value : null
    if (!value) return null
    return {
      attackBonus: value.attackBonus,
      saveDc: value.saveDc,
      level: who.detail.level,
      spells: who.detail.spells.map((s) => s.spell)
    }
  }
  type Casting = {
    spellcasting?: { level?: number; dc?: number; modifier?: number; spells?: { url: string }[] }
  }
  const block = (who.monster.specialAbilities as Casting[] | null)?.find(
    (a) => a.spellcasting
  )?.spellcasting
  if (!block) return null
  return {
    attackBonus: block.modifier ?? 0,
    saveDc: block.dc ?? 10,
    level: block.level ?? 1,
    spells: (block.spells ?? []).map((s) => s.url.split('/').at(-1)!)
  }
}

/** The spell's damage at this slot level, or at the caster's level for a cantrip. */
function spellDamage(spell: Spell, level: number, casterLevel: number) {
  const first = (spell.damage as SpellDamage[] | null)?.find((d) => d.damage_type)
  if (!first) return null
  const bySlot = first.damage_at_slot_level?.[String(level)]
  const byCaster = Object.entries(first.damage_at_character_level ?? {})
    .filter(([at]) => Number(at) <= casterLevel)
    .sort(([a], [b]) => Number(b) - Number(a))[0]?.[1]
  const dice = bySlot ?? byCaster
  return dice
    ? { dice: dice.replace(/\s+/g, ''), damageType: first.damage_type!.toLowerCase() }
    : null
}

/** Spends a Character's slot of this level, or refuses when none is free. */
function spendSlot(db: Queryable, who: Extract<Combatant, { kind: 'character' }>, level: number) {
  const slots = who.stats.spellSlots.status === 'ok' ? who.stats.spellSlots.value : []
  const max = slots[level - 1] ?? 0
  const spent = who.detail.spentSlots[level - 1] ?? 0
  if (spent >= max) {
    const free = slots.flatMap((m, i) =>
      i + 1 > level && (who.detail.spentSlots[i] ?? 0) < m ? [i + 1] : []
    )
    throw new ToolError(
      'no_slot',
      `${who.name} has no level ${level} spell slot free (${spent} of ${max} spent)`,
      free.length
        ? `Cast it at a higher level with a free slot (${free.join(', ')}), or choose another action`
        : `${who.name} needs a rest to regain slots; choose another action`
    )
  }
  const spentSlots = [...who.detail.spentSlots]
  spentSlots[level - 1] = spent + 1
  db.update(character).set({ spentSlots }).where(eq(character.id, who.id)).run()
  return { level, spent: spent + 1, max }
}

/** Rolls a dice expression, or refuses one that isn't. */
function rollExpressionOrRefuse(dice: Dice, expr: string) {
  try {
    return dice.rollExpression(expr)
  } catch {
    throw new ToolError(
      'bad_dice',
      `${expr} is not a dice expression`,
      'Write it as NdS+M, such as 2d6+1'
    )
  }
}

/** An SRD condition's slug, or a refusal naming them. */
function srdCondition(db: Queryable, name: string): string {
  const rules = createRulesRepository(db)
  const slug = slugOf(name)
  const found = rules.entry(`condition:${slug}`)
  if (!found) {
    const all = rules.conditions().map((c) => c.slug)
    throw new ToolError(
      'unknown_condition',
      `${name} is not an SRD condition`,
      `Use one of: ${all.join(', ')}`
    )
  }
  return slug
}

export const actionTools = [
  writeTool({
    name: 'attack',
    description:
      "Make a weapon or natural attack. A Character attacker returns a pending Call: attach it with your closing narrate(text, call: id) and the Player rolls to hit, then damage (you hear one call_result). An NPC attacker rolls and applies at once, in the dice log. The target's AC stays hidden from the Player.",
    input: z.object({
      actor: z.string().min(1).describe('Who attacks: char:…, npc:… or creature:…'),
      target: z.string().min(1).describe('Who is attacked: char:…, npc:… or creature:…'),
      with: z.string().trim().min(1).describe('The weapon or stat block action, such as longsword'),
      ...adv
    }),
    activity: 'DM resolves an attack',
    run: ({ db, dice, now }, input) => {
      const actor = combatant(db, input.actor)
      mustAct(actor)
      const target = combatant(db, input.target)
      const attack = findAttack(actor, input.with)
      const sequence = attackSequence(attack.name, target, attack.bonus, attack.damage)
      const reminder = spendTurnResource(db, actor.handle, actor.name, 'action')
      return withReminder(
        reminder,
        resolve(db, dice, now, [{ roller: actor, sequence, mode: modeOf(input) }], {
          summary: `${actor.name}'s ${sequence.label} on ${target.name}`
        })
      )
    }
  }),

  writeTool({
    name: 'offer_reaction',
    description:
      "Offer a Character a reaction out of turn, such as an opportunity attack when a foe leaves their reach: returns a pending Call to attach with your closing narrate(text, call: id). The Player takes it or passes; taking it spends their reaction, and with an attack they then roll to hit and damage. You hear one call_result. An NPC's reaction you resolve yourself, with attack.",
    input: z.object({
      character: z.string().min(1).describe('Who can react: char:…'),
      reaction: z
        .string()
        .trim()
        .min(1)
        .describe('What the reaction is, such as opportunity attack'),
      attack: z
        .object({
          target: z.string().min(1).describe('Who is attacked: npc:… or creature:…'),
          with: z.string().trim().min(1).describe('The weapon, such as longsword')
        })
        .optional()
        .describe('The attack the reaction makes, rolled once taken'),
      take: z
        .string()
        .trim()
        .min(1)
        .optional()
        .describe('The take button; Attack with an attack, Take without'),
      ...adv
    }),
    activity: 'DM offers a reaction',
    run: ({ db, now }, input) => {
      const who = combatant(db, input.character)
      if (who.kind !== 'character') {
        throw new ToolError(
          'not_a_character',
          `${who.name} is not a Character`,
          "Resolve an NPC's or Creature's reaction yourself, with attack"
        )
      }
      mustAct(who)
      const target = input.attack && combatant(db, input.attack.target)
      const attack = input.attack && findAttack(who, input.attack.with)
      const sequence =
        target && attack ? attackSequence(attack.name, target, attack.bonus, attack.damage) : null
      const name = input.reaction.toLowerCase()
      const label = name[0].toUpperCase() + name.slice(1)
      const take = input.take ?? (sequence ? 'Attack' : 'Take')
      if (take === PASS) {
        throw new ToolError('bad_take', `${PASS} is the other button`, 'Name the take button')
      }
      const article = /^[aeiou]/.test(name) ? 'an' : 'a'
      const text = `${who.name} can make ${article} ${name}${target ? ` on ${target.name}` : ''}`
      const id = createPendingCall(
        db,
        [
          {
            characterId: who.id,
            player: who.player,
            sequence,
            reaction: label,
            ...modeOf(input)
          }
        ],
        now,
        'reaction',
        { text, choices: [take, PASS] }
      )
      return {
        result: { pending_call: id, next: pendingNext(id) },
        event: { kind: 'call_pending', summary: text, data: { call: id }, dmOnly: true }
      }
    }
  }),

  writeTool({
    name: 'cast',
    description:
      "Cast a spell: checks the caster has it and a free slot of the level, and spends the slot (cantrips are level 0). A spell attack from a Character returns a pending Call (to hit, then damage) to attach with narrate; an NPC's rolls at once. A save spell rolls its damage once; NPC targets save at once against the caster's DC, Character targets get a pending Call. Healing and other effects: apply them with heal, add_condition and the like. A concentration spell links the caster to it and ends the one they concentrated on before.",
    input: z.object({
      caster: z.string().min(1).describe('Who casts: char:… or npc:…'),
      spell: z.string().min(1).describe('The spell: spell:fire-bolt, fire-bolt or Fire Bolt'),
      level: z.number().int().min(0).max(9).describe('The slot level; 0 for a cantrip'),
      targets: z
        .array(z.string().min(1))
        .default([])
        .describe('Who the spell affects: char:… or npc:…'),
      ...adv
    }),
    activity: 'DM resolves a spell',
    run: ({ db, dice, now }, input) => {
      const caster = combatant(db, input.caster)
      mustAct(caster)
      const found = createRulesRepository(db).entry(`spell:${slugOf(input.spell)}`)
      if (!found || found.kind !== 'spell') {
        throw new ToolError(
          'unknown_spell',
          `No SRD spell is called ${input.spell}`,
          'Find the spell with lookup({query}) and call again'
        )
      }
      const spell = found.entry as Spell
      const powers = casting(caster)
      if (!powers || !powers.spells.includes(spell.slug)) {
        throw new ToolError(
          'spell_not_known',
          `${caster.name} doesn't have ${spell.name}`,
          powers?.spells.length
            ? `Cast one of ${caster.name}'s spells: ${powers.spells.join(', ')}`
            : `${caster.name} casts no spells; choose another action`
        )
      }
      if (spell.level === 0 ? input.level !== 0 : input.level < spell.level) {
        throw new ToolError(
          'bad_spell_level',
          `${spell.name} can't be cast at level ${input.level}`,
          spell.level === 0
            ? 'Cast a cantrip at level 0'
            : `Cast it at level ${spell.level} or higher`
        )
      }
      const targets = input.targets.map((t) => combatant(db, t))
      if ((spell.attackType || spell.dcAbility) && !targets.length) {
        throw new ToolError(
          'no_targets',
          `${spell.name} needs a target`,
          'Name its targets and call again'
        )
      }
      // NPC casters' slots aren't tracked; the DM paces them.
      const slot =
        caster.kind === 'character' && input.level > 0 ? spendSlot(db, caster, input.level) : null
      const damage = spellDamage(spell, input.level, powers.level)
      const reminder = spendTurnResource(
        db,
        caster.handle,
        caster.name,
        /bonus action/i.test(String(spell.castingTime ?? '')) ? 'bonusAction' : 'action'
      )
      const ended = spell.concentration ? concentrate(db, caster, spell.slug) : null
      const result = {
        cast: spell.name,
        level: input.level,
        slot,
        ...(reminder && { reminder }),
        ...(spell.concentration && { concentration: spell.slug }),
        ...(ended && { ended_concentration: ended })
      }
      const summary = `${caster.name} casts ${spell.name}${targets.length ? ` on ${targets.map((t) => t.name).join(', ')}` : ''}`

      if (spell.attackType) {
        const label = `${spell.name}`
        return resolve(
          db,
          dice,
          now,
          targets.map((t) => ({
            roller: caster,
            sequence: attackSequence(label, t, powers.attackBonus, damage),
            mode: modeOf(input)
          })),
          { summary, result }
        )
      }
      if (spell.dcAbility) {
        const ability = spell.dcAbility as AbilityKey
        const rolled =
          damage &&
          preRollDamage(dice, caster.name, `${spell.name} damage`, damage.dice, damage.damageType)
        return resolve(
          db,
          dice,
          now,
          targets.map((t) => ({
            roller: t,
            sequence: saveSequence(abilityName(ability), t, {
              ability,
              bonus: saveBonus(t, ability),
              dc: powers.saveDc,
              damage: rolled?.total ?? null,
              damageType: damage?.damageType ?? null,
              condition: null,
              onSuccess: spell.dcSuccess === 'half' ? 'half' : 'none'
            }),
            mode: { mode: 'normal', reason: null }
          })),
          { summary, result, pre: rolled ? [rolled.pre] : [] }
        )
      }
      if (damage && targets.length) {
        return resolve(
          db,
          dice,
          now,
          targets.map((t) => ({
            roller: caster,
            sequence: damageSequence(spell.name, t, damage),
            mode: { mode: 'normal', reason: null }
          })),
          { summary, result }
        )
      }
      return resolve(db, dice, now, [], { summary, result })
    }
  }),

  writeTool({
    name: 'force_save',
    description:
      "Force a saving throw: a trap, a breath, an NPC's spell. Code rolls the damage once; Character targets get a pending Call to attach with narrate (each Player rolls their save), NPC targets save at once. A failure takes the damage and the condition; a success takes half or none. The DC stays hidden from the Player.",
    input: z
      .object({
        targets: z.array(z.string().min(1)).min(1).describe('Who saves: char:… or npc:…'),
        ability: saveKey.describe('The save: dex or Dexterity'),
        dc_tier: z.enum(TIERS).optional().describe('Difficulty; code turns it into the DC'),
        dc: z
          .number()
          .int()
          .min(1)
          .max(30)
          .optional()
          .describe("An exact DC, such as a stat block's"),
        on_fail: z.object({
          damage: z.string().min(1).optional().describe('Dice for the damage, such as 2d6'),
          type: z.string().min(1).optional().describe('The damage type, such as fire'),
          condition: z
            .string()
            .min(1)
            .optional()
            .describe('A condition a failure lands, such as prone')
        }),
        on_success: z.enum(['half', 'none']).default('none'),
        source: z
          .string()
          .trim()
          .min(1)
          .optional()
          .describe('What forces it, shown in the dice log')
      })
      .refine((i) => (i.dc === undefined) !== (i.dc_tier === undefined), {
        message: 'Give exactly one of dc_tier and dc'
      }),
    activity: 'DM calls for a saving throw',
    run: ({ db, dice, now }, input) => {
      const targets = input.targets.map((t) => combatant(db, t))
      const ability = input.ability as AbilityKey
      const dc = input.dc ?? DC_BY_TIER[input.dc_tier!]
      const source = input.source ?? 'Effect'
      const damageType = input.on_fail.type?.toLowerCase() ?? null
      const rolled = input.on_fail.damage
        ? preRollDamage(dice, source, `${source} damage`, input.on_fail.damage, damageType)
        : null
      return resolve(
        db,
        dice,
        now,
        targets.map((t) => ({
          roller: t,
          sequence: saveSequence(abilityName(ability), t, {
            ability,
            bonus: saveBonus(t, ability),
            dc,
            damage: rolled?.total ?? null,
            damageType,
            condition: input.on_fail.condition?.toLowerCase() ?? null,
            onSuccess: input.on_success
          }),
          mode: { mode: 'normal', reason: null }
        })),
        {
          summary: `${abilityName(ability)} save for ${targets.map((t) => t.name).join(', ')}`,
          pre: rolled ? [rolled.pre] : []
        }
      )
    }
  }),

  writeTool({
    name: 'cancel_call',
    description: "Drop a pending Call an action tool returned that you won't attach.",
    input: z.object({ id: z.string().min(1) }),
    activity: null,
    run: ({ db, now }, { id }) => {
      cancelPendingCall(db, id, now)
      return {
        result: { cancelled: id },
        event: {
          kind: 'call_cancelled',
          summary: `Pending Call ${id} cancelled`,
          data: { call: id },
          dmOnly: true
        }
      }
    }
  }),
  writeTool({
    name: 'roll',
    description:
      "Roll dice for yourself alone: a hidden check, a random table, an improvised effect. Nothing is applied and the Player doesn't see it; use damage, heal and the like to apply a result.",
    input: z.object({
      expr: z.string().min(1).describe('Dice such as 2d6+1 or d20+3'),
      ...adv
    }),
    activity: null,
    run: ({ dice }, input) => {
      const d20 = /^\s*1?d20\s*([+-]\s*\d+)?\s*$/i.exec(input.expr)
      if (input.adv && !d20) {
        throw new ToolError(
          'adv_needs_d20',
          'Advantage and disadvantage apply to a single d20',
          'Roll d20+N with adv, or drop adv'
        )
      }
      let result: { dice: number[]; kept: number | null; modifier: number; total: number }
      if (input.adv && d20) {
        const modifier = d20[1] ? Number(d20[1].replace(/\s+/g, '')) : 0
        const rolled = dice.rollD20({ mode: input.adv, reason: input.reason ?? '' })
        result = { dice: rolled.dice, kept: rolled.kept, modifier, total: rolled.kept + modifier }
      } else {
        const rolled = rollExpressionOrRefuse(dice, input.expr)
        result = { dice: rolled.dice, kept: null, modifier: rolled.modifier, total: rolled.total }
      }
      return {
        result,
        event: {
          kind: 'dm_roll',
          summary: `${input.expr}: ${result.total}`,
          data: { ...result, expr: input.expr },
          dmOnly: true
        }
      }
    }
  }),

  writeTool({
    name: 'damage',
    description:
      "Deal damage outside an attack or save, such as a fall. Temporary HP absorb it first, HP stop at 0, and an NPC's resistances apply. A Character dropped to 0 falls Unconscious (or dies outright); damage at 0 is a Death save failure. An NPC or Creature dropped to 0 dies unless knock_out. notes says what came of it.",
    input: z.object({
      target: z.string().min(1).describe('char:… or npc:…'),
      amount: z.number().int().min(0),
      type: z.string().min(1).describe('The damage type, such as bludgeoning'),
      crit: z
        .boolean()
        .optional()
        .describe('A critical hit: at 0 HP a Character takes two Death save failures'),
      knock_out: z
        .boolean()
        .optional()
        .describe('An NPC or Creature dropped to 0 is knocked out instead of killed')
    }),
    activity: 'DM applies damage',
    run: ({ db, dice, now }, input) => {
      const who = combatant(db, input.target)
      const type = input.type.toLowerCase()
      const { calls, ...change } = applyDamage(db, who, input.amount, type, {
        crit: input.crit,
        knockOut: input.knock_out,
        dice,
        at: now
      })
      return {
        result: {
          ...change,
          state: hpState(change.hp, change.max),
          ...concentrationCalls(calls)
        },
        event: {
          kind: 'damage',
          summary: `${who.name} takes ${change.dealt} ${type}`,
          data: {
            target: who.handle,
            dealt: change.dealt,
            type,
            state: hpState(change.hp, change.max)
          }
        }
      }
    }
  }),

  writeTool({
    name: 'heal',
    description:
      'Restore HP, never above the maximum. Roll a healing spell or potion with roll first.',
    input: z.object({
      target: z.string().min(1).describe('char:… or npc:…'),
      amount: z.number().int().min(0)
    }),
    activity: 'DM applies healing',
    run: ({ db }, input) => {
      const who = combatant(db, input.target)
      const change = applyHealing(db, who, input.amount)
      return {
        result: {
          healed: change.dealt,
          hp: change.hp,
          max: change.max,
          state: hpState(change.hp, change.max)
        },
        event: {
          kind: 'heal',
          summary: `${who.name} regains ${change.dealt} HP`,
          data: { target: who.handle, healed: change.dealt, state: hpState(change.hp, change.max) }
        }
      }
    }
  }),

  writeTool({
    name: 'add_condition',
    description:
      'Give a Character or NPC an SRD condition, such as prone or frightened. An incapacitating condition ends concentration.',
    input: z.object({ target: z.string().min(1), condition: z.string().min(1) }),
    activity: 'DM applies a condition',
    run: ({ db }, input) => {
      const who = combatant(db, input.target)
      const condition = srdCondition(db, input.condition)
      if (!who.conditions.includes(condition))
        setConditions(db, who, [...who.conditions, condition])
      const ended = incapacitates(condition) ? who.concentration : null
      if (ended) setConcentration(db, who, null)
      return {
        result: {
          target: who.handle,
          conditions: [...new Set([...who.conditions, condition])],
          ...(ended && { ended_concentration: ended })
        },
        event: {
          kind: 'condition_added',
          summary: `${who.name} is ${condition}`,
          data: { target: who.handle, condition }
        }
      }
    }
  }),

  writeTool({
    name: 'remove_condition',
    description: 'End a condition a Character or NPC has.',
    input: z.object({ target: z.string().min(1), condition: z.string().min(1) }),
    activity: 'DM ends a condition',
    run: ({ db }, input) => {
      const who = combatant(db, input.target)
      const condition = slugOf(input.condition)
      if (!who.conditions.includes(condition)) {
        throw new ToolError(
          'condition_absent',
          `${who.name} isn't ${condition}`,
          who.conditions.length
            ? `${who.name} has: ${who.conditions.join(', ')}`
            : `${who.name} has no conditions`
        )
      }
      const conditions = who.conditions.filter((c) => c !== condition)
      setConditions(db, who, conditions)
      return {
        result: { target: who.handle, conditions },
        event: {
          kind: 'condition_removed',
          summary: `${who.name} is no longer ${condition}`,
          data: { target: who.handle, condition }
        }
      }
    }
  }),

  writeTool({
    name: 'spend',
    description:
      "Spend a Character's resource outside cast: a spell slot (slot:1 to slot:9) or one use of a feature by its slug, such as second-wind.",
    input: z.object({
      character: z.string().min(1).describe('char:…'),
      resource: z.string().min(1).describe('slot:N or a feature slug')
    }),
    activity: null,
    run: ({ db }, input) => {
      const who = combatant(db, input.character)
      if (who.kind !== 'character') {
        throw new ToolError(
          'not_a_character',
          `${who.name} is not a Character`,
          'NPC resources are yours to pace; no tool call needed'
        )
      }
      const slot = /^slot:([1-9])$/.exec(input.resource.trim())
      if (slot) {
        const spent = spendSlot(db, who, Number(slot[1]))
        return {
          result: { character: who.handle, slot: spent },
          event: {
            kind: 'spend',
            summary: `${who.name} spends a level ${spent.level} slot`,
            data: { character: who.handle, resource: input.resource }
          }
        }
      }
      const key = slugOf(input.resource)
      const feature = who.features.find((f) => f.slug === key || slugOf(f.name) === key)
      if (!feature) {
        throw new ToolError(
          'unknown_resource',
          `${who.name} has no resource called ${input.resource}`,
          `Spend slot:N or one of ${who.name}'s features: ${who.features.map((f) => f.slug).join(', ')}`
        )
      }
      const featureUses = {
        ...who.detail.featureUses,
        [feature.slug]: (who.detail.featureUses[feature.slug] ?? 0) + 1
      }
      db.update(character).set({ featureUses }).where(eq(character.id, who.id)).run()
      return {
        result: { character: who.handle, feature: feature.slug, spent: featureUses[feature.slug] },
        event: {
          kind: 'spend',
          summary: `${who.name} uses ${feature.name}`,
          data: { character: who.handle, resource: feature.slug }
        }
      }
    }
  })
]
