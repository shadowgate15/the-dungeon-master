import { z } from 'zod'
import type { Queryable } from '../db/connect'
import type { Dice } from '../dice'
import { cancelPendingCall, createPendingCall } from '../play/calls'
import { combatant, mustAct, type Combatant } from '../play/combatants'
import {
  attackSequence,
  rollAll,
  sequenceText,
  type Sequence,
  type StepRolled
} from '../play/sequences'
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

/** One NPC roll in the dice log: Player-safe, with no AC, DC or NPC HP number. */
function diceLogRoll(actor: string, rolled: StepRolled, mode: Mode) {
  const d20 = rolled.roll.kept !== null
  return {
    characterName: actor,
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

/** Rolls an NPC's sequences now; returns the DM's result and the one Event with the dice log. */
function rollNow(
  db: Queryable,
  dice: Dice,
  actor: Combatant,
  sequences: Sequence[],
  mode: Mode
): { result: Record<string, unknown>; event: ToolEvent } {
  const outcomes = sequences.map((s) => rollAll(db, s, dice, mode))
  const rolls = outcomes.flatMap((o) => o.steps.map((s) => diceLogRoll(actor.name, s, mode)))
  return {
    result: {
      rolled: outcomes.map((o) => sequenceText(o.sequence, mode.mode)).join('\n'),
      targets: outcomes.map((o) => {
        const last = o.sequence.rolls.findLast((r) => r.after)
        return { handle: o.sequence.target.handle, hp: last?.after?.hp ?? null }
      })
    },
    event: {
      kind: 'rolls',
      summary: rolls
        .map((r) => `${r.characterName} ${r.what}: ${r.total}${r.outcome ? ` (${r.outcome})` : ''}`)
        .join('; '),
      data: { rolls }
    }
  }
}

export const actionTools = [
  writeTool({
    name: 'attack',
    description:
      "Make a weapon or natural attack. A Character attacker returns a pending Call: attach it with your closing narrate(text, call: id) and the Player rolls to hit, then damage (you hear one call_result). An NPC attacker rolls and applies at once, in the dice log. The target's AC stays hidden from the Player.",
    input: z.object({
      actor: z.string().min(1).describe('Who attacks: char:… or npc:…'),
      target: z.string().min(1).describe('Who is attacked: char:… or npc:…'),
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
      const mode = modeOf(input)
      if (actor.kind === 'character') {
        const id = createPendingCall(
          db,
          [{ characterId: actor.id, player: actor.player, sequence, ...mode }],
          now
        )
        return {
          result: { pending_call: id, next: pendingNext(id) },
          event: {
            kind: 'call_pending',
            summary: `${actor.name}'s ${sequence.label} on ${target.name}`,
            data: { call: id },
            dmOnly: true
          }
        }
      }
      return rollNow(db, dice, actor, [sequence], mode)
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
  })
]
