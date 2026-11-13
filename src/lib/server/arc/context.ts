/**
 * The Arc block of the DM context. Pure: the caller loads the Arc and the Turns. Only an accepted
 * Arc steers; the DM sees the current Act (the Act of the first pending Beat), never the whole
 * outline. Steering is prompt guidance only.
 */

/** Consecutive DM turns with no Beat progress before the block gains a soft drift hint. */
export const ARC_DRIFT_TURNS = 15

export interface ArcContextBeat {
  title: string
  description: string
  state: 'pending' | 'reached' | 'abandoned'
  sourceSessionId: string | null
  sourceTurnSeq: number | null
}

export interface ArcContextArc {
  status: 'draft' | 'accepted'
  title: string
  premise: string
  stakes: string
  resolution: string
  acts: { name: string; purpose: string; beats: ArcContextBeat[] }[]
}

const GUIDANCE = [
  'This is a private plan to steer by gently, not a script. Beats are outcomes, not scenes: do not force them, and weave one in only when a natural opening arises.',
  'Never announce a Beat or mention this plan, an arc or its structure in narration. The player is free to ignore it entirely; follow their lead.'
].join('\n')

const DRIFT_HINT =
  'Advisory: the story has drifted from the plan for a long while. If it fits, you may gently offer the player a hook toward an open Beat, but do not railroad.'

export function buildArcBlock(arc: ArcContextArc | null | undefined, quietTurns: number) {
  if (!arc || arc.status !== 'accepted') return null
  const currentIndex = arc.acts.findIndex((a) => a.beats.some((b) => b.state === 'pending'))
  const complete = currentIndex === -1
  const lines = [
    'The story plan (the Campaign Arc), for your eyes only:',
    GUIDANCE,
    `Title: ${arc.title}`,
    `Premise: ${arc.premise}`,
    `Stakes: ${arc.stakes}`
  ]
  if (complete) {
    lines.push(
      `The planned resolution is now in play; bring the story toward it: ${arc.resolution}`
    )
    return lines.join('\n')
  }
  const current = arc.acts[currentIndex]
  lines.push(`Current Act: ${current.name}: ${current.purpose}`)
  lines.push('Open Beats:')
  for (const b of current.beats)
    if (b.state === 'pending') lines.push(`- ${b.title}: ${b.description}`)
  const reached = arc.acts.flatMap((a) => a.beats).filter((b) => b.state === 'reached')
  if (reached.length) lines.push(`Already happened: ${reached.map((b) => b.title).join('; ')}`)
  const next = arc.acts[currentIndex + 1]
  if (next?.beats[0]) lines.push(`Next Act begins with: ${next.beats[0].title}`)
  if (currentIndex === arc.acts.length - 1) {
    lines.push(`The planned resolution (the intended ending, not a Beat): ${arc.resolution}`)
  }
  if (quietTurns >= ARC_DRIFT_TURNS) lines.push(DRIFT_HINT)
  return lines.join('\n')
}

/**
 * Consecutive DM turns since the Arc's latest Beat progress, across the Campaign's Sessions in
 * order. With no progress yet, every DM turn counts.
 */
export function countQuietTurns(
  arc: ArcContextArc,
  sessions: readonly { id: string; turns: readonly { seq: number; author: string }[] }[]
): number {
  const marks = arc.acts
    .flatMap((a) => a.beats)
    .filter((b) => b.state !== 'pending' && b.sourceSessionId !== null)
  const at = (id: string | null) => sessions.findIndex((s) => s.id === id)
  let latest: { index: number; seq: number } | null = null
  for (const b of marks) {
    const index = at(b.sourceSessionId)
    if (index === -1) continue
    const seq = b.sourceTurnSeq ?? 0
    if (!latest || index > latest.index || (index === latest.index && seq > latest.seq)) {
      latest = { index, seq }
    }
  }
  let count = 0
  sessions.forEach((s, index) => {
    for (const t of s.turns) {
      if (t.author !== 'dm') continue
      if (latest && (index < latest.index || (index === latest.index && t.seq <= latest.seq))) {
        continue
      }
      count++
    }
  })
  return count
}
