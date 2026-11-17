import { makeOptionId, parseOptionId } from '../option-id.ts'
import type { MenuOption } from '../types.ts'

/**
 * The checks the Director may request, and their DCs. The model only picks a check; code owns the
 * difficulty. Keys are skill slugs, so the Character's modifier derives from the same key.
 */
export const ROLL_CHECKS: Record<string, { dc: number; hint: string; reason: string }> = {
  perception: {
    dc: 12,
    hint: 'The player tries to notice something hidden or distant.',
    reason: 'Noticing what is hidden here'
  },
  stealth: {
    dc: 12,
    hint: 'The player tries to move unseen or unheard.',
    reason: 'Staying unseen and unheard'
  },
  investigation: {
    dc: 13,
    hint: 'The player searches or deduces from clues.',
    reason: 'Piecing the clues together'
  },
  persuasion: {
    dc: 13,
    hint: 'The player tries to win someone over.',
    reason: 'Winning someone over'
  },
  athletics: {
    dc: 14,
    hint: 'The player climbs, jumps, swims or forces something.',
    reason: 'Pushing past a physical obstacle'
  }
}

/**
 * Requests a roll: code sets the DC from `ROLL_CHECKS`, saves the pending roll, logs a
 * `roll-requested` event and forces a yield. Offered only right after a player action, and not
 * while a roll is already pending.
 */
export const rollOption: MenuOption = {
  verb: 'roll',
  offer: ({ scene, events }) =>
    scene.pendingRoll || events.at(-1)?.kind !== 'player-action'
      ? []
      : Object.entries(ROLL_CHECKS).map(([check, { hint }]) => ({
          id: makeOptionId('roll', check),
          hint: `Ask the player for a ${check} check. ${hint}`
        })),
  async *run(ctx, optionId) {
    const check = parseOptionId(optionId).arg
    const entry = ROLL_CHECKS[check]
    if (!entry) throw new Error(`Unknown check: ${check}`)
    const pendingRoll = { check, dc: entry.dc, reason: entry.reason }
    ctx.sessions.saveScene(ctx.sessionId, { ...ctx.sessions.scene(ctx.sessionId), pendingRoll })
    const event = ctx.sessions.appendEvent(ctx.sessionId, {
      role: 'code',
      kind: 'roll-requested',
      text: `${entry.reason}: ${check} check, DC ${entry.dc}`,
      data: { ...pendingRoll }
    })
    yield { type: 'event', event }
    return { type: 'done', reason: 'roll' }
  }
}
