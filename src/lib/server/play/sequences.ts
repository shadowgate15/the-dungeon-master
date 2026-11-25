import { hpState, type HpState } from '#lib/play/hp-state.ts'
import type { RollMode } from '#lib/play/call.ts'
import type { Queryable } from '../db/connect'
import type { Sequence, SequenceRoll, SequenceStep } from '../db/schema'
import type { Dice } from '../dice'
import { applyDamage, combatant, setConditions, type Combatant } from './combatants'

/*
 * Roll sequences: chains of rolls code resolves one click (or one tool call) at a time. An attack
 * is to-hit against the hidden AC, then damage on a hit, dice doubled on a critical hit. A save is
 * a saving throw against the hidden DC, then the effect in full or half. The DM hears the whole
 * outcome once; the Player sees each roll with its total and "hit" or "miss", never the AC or DC.
 */

export type { Sequence }

/** A weapon or spell attack: to-hit, then damage on a hit. */
export function attackSequence(
  source: string,
  target: Combatant,
  bonus: number,
  damage: { dice: string; damageType: string } | null
): Sequence {
  const steps: SequenceStep[] = [{ kind: 'to_hit', bonus, ac: target.ac }]
  if (damage) steps.push({ kind: 'damage', ...damage })
  return {
    label: `${source} attack`,
    source,
    target: { handle: target.handle, name: target.name },
    steps,
    rolls: [],
    done: false
  }
}

/** A saving throw: the effect applies in full on a failure, half or nothing on a success. */
export function saveSequence(
  abilityName: string,
  target: Combatant,
  step: Omit<Extract<SequenceStep, { kind: 'save' }>, 'kind'>
): Sequence {
  return {
    label: `${abilityName} save`,
    source: abilityName,
    target: { handle: target.handle, name: target.name },
    steps: [{ kind: 'save', ...step }],
    rolls: [],
    done: false
  }
}

/** A damage roll alone (a spell that always hits, a save-spell's damage), applied to the target. */
export function damageSequence(
  source: string,
  target: Combatant,
  damage: { dice: string; damageType: string }
): Sequence {
  return {
    label: `${source} damage`,
    source,
    target: { handle: target.handle, name: target.name },
    steps: [{ kind: 'damage', ...damage }],
    rolls: [],
    done: false
  }
}

/** What the next step rolls, as the Player's button reads it; null when the sequence is done. */
export function nextStep(sequence: Sequence): 'to hit' | 'damage' | 'save' | null {
  if (sequence.done) return null
  const step = sequence.steps[sequence.rolls.length]
  return step.kind === 'to_hit' ? 'to hit' : step.kind
}

/** What one step rolls, as the Player reads it in the timeline: `Crossbow, light attack`. */
function stepLabel(sequence: Sequence, step: SequenceStep): string {
  if (step.kind === 'to_hit') return `${sequence.source} attack`
  if (step.kind === 'damage') return `${sequence.source} damage`
  return `${sequence.source} save`
}

/** One rolled step, Player-safe: who, what, the dice, total and outcome; an NPC target's HP state. */
export type StepRolled = {
  sequence: Sequence
  what: string
  roll: SequenceRoll
  /** The target's state after damage, when it is an NPC or Creature (never its HP numbers). */
  targetState: { name: string; state: HpState } | null
}

/**
 * Rolls the sequence's next step in code against the hidden number and applies its effect: the
 * target takes the damage, or the save's effect lands. A miss ends the sequence.
 */
export function rollStep(
  db: Queryable,
  sequence: Sequence,
  dice: Dice,
  {
    mode = 'normal',
    reason = '',
    at = Date.now()
  }: { mode?: RollMode; reason?: string | null; at?: number } = {}
): StepRolled {
  const step = sequence.steps[sequence.rolls.length]
  const target = combatant(db, sequence.target.handle)
  const d20 = () =>
    mode === 'normal' ? dice.rollD20() : dice.rollD20({ mode, reason: reason ?? '' })
  let roll: SequenceRoll
  let ends = false

  if (step.kind === 'to_hit') {
    const rolled = d20()
    const total = rolled.kept + step.bonus
    const outcome =
      rolled.kept === 20 ? 'critical hit' : rolled.kept !== 1 && total >= step.ac ? 'hit' : 'miss'
    ends = outcome === 'miss'
    roll = {
      dice: rolled.dice,
      kept: rolled.kept,
      modifier: step.bonus,
      total,
      outcome,
      applied: null,
      after: null
    }
  } else if (step.kind === 'damage') {
    const crit = sequence.rolls.at(-1)?.outcome === 'critical hit'
    const rolled = dice.rollExpression(step.dice, { crit })
    const total = Math.max(0, rolled.total)
    const change = applyDamage(db, target, total, step.damageType, { crit, dice, at })
    roll = {
      dice: rolled.dice,
      kept: null,
      modifier: rolled.modifier,
      total,
      outcome: null,
      applied: { dealt: change.dealt, damageType: step.damageType, condition: null },
      after: { hp: change.hp, max: change.max },
      notes: change.notes,
      calls: change.calls
    }
  } else {
    const rolled = d20()
    const total = rolled.kept + step.bonus
    const success = total >= step.dc
    const dealt =
      step.damage === null
        ? 0
        : success
          ? step.onSuccess === 'half'
            ? Math.floor(step.damage / 2)
            : 0
          : step.damage
    const change = dealt > 0 ? applyDamage(db, target, dealt, step.damageType, { dice, at }) : null
    const condition = !success && step.condition ? step.condition : null
    if (condition && !target.conditions.includes(condition)) {
      setConditions(db, target, [...target.conditions, condition])
    }
    roll = {
      dice: rolled.dice,
      kept: rolled.kept,
      modifier: step.bonus,
      total,
      outcome: success ? 'success' : 'failure',
      applied: { dealt: change?.dealt ?? 0, damageType: step.damageType, condition },
      after: { hp: change?.hp ?? target.hp, max: target.maxHp },
      notes: change?.notes ?? [],
      calls: change?.calls ?? []
    }
  }

  const rolls = [...sequence.rolls, roll]
  const next: Sequence = {
    ...sequence,
    rolls,
    done: ends || rolls.length === sequence.steps.length
  }
  return {
    sequence: next,
    what: stepLabel(sequence, step),
    roll,
    targetState:
      target.kind !== 'character' && roll.after && step.kind !== 'to_hit'
        ? { name: target.name, state: hpState(roll.after.hp, roll.after.max) }
        : null
  }
}

/** Rolls every step at once, for an NPC or Creature acting inside the DM's tool call. */
export function rollAll(
  db: Queryable,
  sequence: Sequence,
  dice: Dice,
  options: { mode?: RollMode; reason?: string | null; at?: number } = {}
): { sequence: Sequence; steps: StepRolled[] } {
  const steps: StepRolled[] = []
  let current = sequence
  while (!current.done) {
    const rolled = rollStep(db, current, dice, options)
    steps.push(rolled)
    current = rolled.sequence
  }
  return { sequence: current, steps }
}

const signed = (n: number) => (n >= 0 ? `+ ${n}` : `- ${-n}`)

/** `d20 15 + 4 = 19`, or with two d20s `d20 3/15 (advantage) kept 15 + 4 = 19`. */
function d20Text(roll: SequenceRoll, mode: RollMode): string {
  const dice =
    roll.dice.length > 1 ? `${roll.dice.join('/')} (${mode}) kept ${roll.kept}` : `${roll.kept}`
  return `d20 ${dice} ${signed(roll.modifier)} = ${roll.total}`
}

/** `5 + 2 = 7`: every die, the modifier and the total. */
function damageText(roll: SequenceRoll): string {
  const parts = roll.dice.join(' + ')
  const modifier = roll.modifier ? ` ${signed(roll.modifier)}` : ''
  return `${parts}${modifier} = ${roll.total}`
}

/**
 * The DM's view of a sequence, with the hidden numbers:
 * `Crossbow, light attack on Grik (npc:grik): d20 15 + 4 = 19 vs AC 15 → hit; damage 1d8+2: 5 + 2 = 7 piercing → Grik 0/7 HP (down)`.
 */
export function sequenceText(sequence: Sequence, mode: RollMode = 'normal'): string {
  const { target } = sequence
  const parts = sequence.rolls.map((roll, i) => {
    const notes = roll.notes?.length ? `; ${roll.notes.join('; ')}` : ''
    return stepText(roll, i) + notes
  })
  function stepText(roll: SequenceRoll, i: number): string {
    const step = sequence.steps[i]
    const after = roll.after
      ? ` → ${target.name} ${roll.after.hp}/${roll.after.max} HP (${hpState(roll.after.hp, roll.after.max)})`
      : ''
    if (step.kind === 'to_hit') return `${d20Text(roll, mode)} vs AC ${step.ac} → ${roll.outcome}`
    if (step.kind === 'damage') {
      const doubled =
        roll.dice.length > Number(/^(\d*)d/.exec(step.dice)?.[1] || 1) ? ' (doubled)' : ''
      return `damage ${step.dice}${doubled}: ${damageText(roll)} ${step.damageType}${after}`
    }
    const effect = [
      roll.applied?.dealt ? `takes ${roll.applied.dealt} ${step.damageType ?? ''}`.trim() : null,
      roll.applied?.condition ? `is ${roll.applied.condition}` : null
    ].filter(Boolean)
    return `${d20Text(roll, mode)} vs DC ${step.dc} → ${roll.outcome}${effect.length ? `; ${effect.join(', ')}` : ''}${roll.applied?.dealt ? after : ''}`
  }
  const on =
    sequence.steps[0].kind === 'save' ? sequence.label : `${sequence.label} on ${target.name}`
  return `${on} (${target.handle}): ${parts.join('; ')}`
}
