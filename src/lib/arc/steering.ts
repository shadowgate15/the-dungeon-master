/**
 * Arc steering: pure functions over an Arc's Beat state. The current Act is derived (the Act of
 * the first pending Beat), the Narrator gets the full Arc block, and
 * drift (runs since the latest Beat transition) adds an advisory hook. See GLOSSARY.md (Beat
 * state) and the Arc Beat-progress decisions in spec #235.
 */
import type { BeatState } from '#lib/memory/enums.ts'

export interface SteeringBeat {
  id: string
  title: string
  description: string
  state: BeatState
}

export interface SteeringAct {
  name: string
  purpose: string
  beats: SteeringBeat[]
}

/** The Arc in Act and Beat order. */
export interface SteeringArc {
  title: string
  resolution: string
  acts: SteeringAct[]
}

/** Runs since the latest Beat transition at which the Narrator is nudged. Tunable, unproven. */
export const DEFAULT_DRIFT_RUNS = 8

/** The index of the current Act (the first with a pending Beat), or -1 when the Arc is complete. */
export function currentActIndex(arc: SteeringArc): number {
  return arc.acts.findIndex((a) => a.beats.some((b) => b.state === 'pending'))
}

export const isDrifting = (runsSinceTransition: number, threshold = DEFAULT_DRIFT_RUNS) =>
  runsSinceTransition >= threshold

const pending = (act: SteeringAct) => act.beats.filter((b) => b.state === 'pending')

/** The pending Beats of the current and next Act: what the Beat check may move. */
export function checkableBeats(arc: SteeringArc): SteeringBeat[] {
  const current = currentActIndex(arc)
  if (current < 0) return []
  return arc.acts.slice(current, current + 2).flatMap(pending)
}

/** The Narrator's Arc block: current Act and purpose, open Beats, reached titles, what is next. */
export function arcBlock(arc: SteeringArc): string {
  const current = currentActIndex(arc)
  const reached = arc.acts.flatMap((a) => a.beats.filter((b) => b.state === 'reached'))
  const lines = [`Story arc: ${arc.title}`]
  if (current < 0) {
    lines.push(
      `The arc is complete and its resolution is in play: ${arc.resolution}`,
      'Play continues; let the story settle and follow the player.'
    )
  } else {
    const act = arc.acts[current]
    lines.push(`Current act: ${act.name}. ${act.purpose}`)
    lines.push('Open beats (steer toward these):')
    for (const b of pending(act)) lines.push(`- ${b.title}: ${b.description}`)
    const next = arc.acts.at(current + 1)
    const opening = next && pending(next)[0]
    if (next && opening) lines.push(`Next act: ${next.name}, opening with "${opening.title}".`)
    if (current === arc.acts.length - 1) lines.push(`Resolution to build toward: ${arc.resolution}`)
  }
  if (reached.length) lines.push(`Already happened: ${reached.map((b) => b.title).join('; ')}.`)
  lines.push(
    'Steer the story toward the open beats without announcing the plot. Never announce beats, acts or the arc to the player, and let the player stay free to improvise.'
  )
  return lines.join('\n')
}

/** The advisory hook added to the Narrator's Arc block when the story has drifted. */
export const DRIFT_HOOK =
  'The story has drifted from the arc for a while. Gently introduce an opportunity, character or event that nudges toward an open beat, without forcing the player.'
