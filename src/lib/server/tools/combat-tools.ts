import { z } from 'zod'
import { formatClock } from '#lib/play/clock.ts'
import {
  addCombatants,
  combatState,
  endCombat,
  nextTurn,
  orderText,
  startCombat,
  type Joined
} from '../play/combat'
import { deathSaveCall } from '../play/death'
import { writeTool, type ToolEvent } from './contract'

/*
 * Combat tools. Code rolls NPC and Creature initiative and keeps the order, the turn pointer and
 * the round; the Party rolls theirs in one initiative Call the closing narrate attaches. Action
 * economy is a reminder in `next_turn`'s result, never a refusal.
 */

const entry = z.union([
  z
    .string()
    .min(1)
    .describe(
      'char:… or npc:… handle (an NPC needs a stat_block), or monster:<slug> for one Creature'
    ),
  z.strictObject({
    monster: z.string().min(1).describe('monster:<slug>: the stat block to spawn Creatures from'),
    count: z.int().min(1).max(20).optional()
  })
])

/** What joining did, for the DM: Creatures spawned, code's rolls, the Party's pending Call. */
function joinedResult(joined: Joined, order: string) {
  return {
    creatures: joined.creatures,
    ...(joined.rolled.length && { rolled: joined.rolled.join('\n') }),
    order,
    ...(joined.pendingCall && {
      pending_call: joined.pendingCall,
      attach: `Attach the initiative Call with your closing narrate(text, call: "${joined.pendingCall}"); its call_result gives the order`
    })
  }
}

/** The dice log of code's initiative rolls, or a DM-only note when only Characters joined. */
function joinedEvent(kind: string, summary: string, joined: Joined): ToolEvent {
  if (!joined.rolls.length) {
    return { kind, summary, data: { call: joined.pendingCall }, dmOnly: true }
  }
  return {
    kind: 'rolls',
    summary: `${summary}: ${joined.rolls.map((r) => `${r.characterName} initiative ${r.total}`).join('; ')}`,
    data: { rolls: joined.rolls, call: joined.pendingCall }
  }
}

export const combatTools = [
  writeTool({
    name: 'start_combat',
    description:
      'Start a Combat in the Scene. Code rolls NPC and Creature initiative now; the Characters get one batched initiative Call (pending_call) for your closing narrate to attach. Creatures are faceless foes spawned from SRD stat blocks for this Combat only (creature:goblin-2); they vanish at end_combat unless you establish a survivor as an NPC. Surprised combatants lose their first turn.',
    input: z.strictObject({
      combatants: z.array(entry).min(1),
      surprised: z.array(z.string().min(1)).optional().describe('Handles of surprised combatants')
    }),
    activity: 'DM starts a Combat',
    run: ({ db, dice, now }, { combatants, surprised }) => {
      const joined = startCombat(db, dice, combatants, { surprised, at: now })
      return {
        result: joinedResult(joined, orderText(db)),
        skill: 'combat',
        event: joinedEvent('combat_started', 'Combat starts', joined)
      }
    }
  }),

  writeTool({
    name: 'add_combatant',
    description:
      'Add a late arrival to the live Combat. An NPC or Creature rolls initiative now; a Character gets an initiative Call (pending_call) for your closing narrate to attach, and joins the order once rolled.',
    input: z.strictObject({ combatants: z.array(entry).min(1) }),
    activity: 'DM adds to the Combat',
    run: ({ db, dice, now }, { combatants }) => {
      const joined = addCombatants(db, dice, combatants, now)
      return {
        result: joinedResult(joined, orderText(db)),
        event: joinedEvent('combatant_added', 'Joins the Combat', joined)
      }
    }
  }),

  writeTool({
    name: 'next_turn',
    description:
      "Move to the next turn in initiative order, into the next round after the last. The new combatant's action, bonus action and reaction are fresh. Run NPC and Creature turns yourself; on a Character's turn the Player's composer is locked to them. A Character at 0 HP rolls a Death save instead: the result carries its pending_call for your closing narrate.",
    input: z.strictObject({}),
    activity: null,
    run: ({ db, dice, now }) => {
      const { round, current, notes } = nextTurn(db, dice)
      const state = combatState(db)
      const deathSave = current && deathSaveCall(db, current.handle, now)
      return {
        result: {
          round,
          turn: current && { handle: current.handle, name: current.name },
          resources:
            'action, bonus action and reaction are fresh (a reminder, not a rule code enforces)',
          order: state.order,
          notes,
          ...(deathSave && {
            pending_call: deathSave,
            death_save: `${current.name} is at 0 HP and rolls a Death save this turn: attach the Call with your closing narrate(text, call: "${deathSave}")`
          })
        },
        event: {
          kind: 'turn',
          summary: current ? `Round ${round}: ${current.name}'s turn` : `Round ${round}`,
          data: { round, combatant: current?.handle ?? null },
          dmOnly: true
        }
      }
    }
  }),

  writeTool({
    name: 'end_combat',
    description:
      'End the live Combat. Its rounds go onto the clock, rounded up to a minute. Creatures vanish: establish any survivor you want to keep as an NPC first.',
    input: z.strictObject({}),
    activity: 'DM ends the Combat',
    run: ({ db, now }) => {
      const ended = endCombat(db, now)
      return {
        result: {
          rounds: ended.rounds,
          minutes: ended.minutes,
          clock: formatClock(ended.clock.to),
          creatures_gone: ended.gone.map((c) => c.handle)
        },
        event: {
          kind: 'combat_ended',
          summary: `Combat ends after ${ended.rounds} rounds (${ended.minutes} min)`,
          data: { rounds: ended.rounds, minutes: ended.minutes }
        }
      }
    }
  })
]
