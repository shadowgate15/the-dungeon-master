/**
 * Arc Beat-progress: reads Beat state for steering, runs the silent per-run Beat check, and applies
 * the transitions code accepts. The model only proposes; code validates ids and transitions, stamps
 * each one with the Session and the last Event id it covered, and abandons pending Beats of earlier
 * Acts when a later-Act Beat is reached. Nothing here is player-editable: the Arc is read-only
 * once the first Session exists (see the Arc service).
 */
import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { z } from 'zod'
import {
  arcBlock,
  checkableBeats,
  currentActIndex,
  DEFAULT_DRIFT_RUNS,
  DRIFT_HOOK,
  isDrifting,
  type SteeringArc
} from '#lib/arc/steering.ts'
import { validateBeatTransition } from '#lib/memory/validate.ts'
import { callModel, type ChatPort } from '../ai/port.ts'
import type { Database } from '../db/connect'
import { arc, arcAct, arcBeat, session, sessionEvent } from '../db/schema'

/** The most transitions one check may propose. */
export const MAX_TRANSITIONS = 3
const CHECK_MAX_TOKENS = 300
const CHECK_TIMEOUT_MS = 60_000
/** Events that start an Exchange: the player's Declaration. */
const RUN_START_KINDS = ['declaration'] as const

const proposalSchema = z.object({
  transitions: z.array(z.object({ beatId: z.string(), to: z.enum(['reached', 'abandoned']) }))
})

const CHECK_SYSTEM = [
  'You watch a tabletop role-playing game and track which story beats have happened.',
  'You are given pending beats and the latest events. Propose a transition only when the events settle it.',
  'Use "reached" only when the beat was clearly established in the events.',
  'Use "abandoned" only when the events made the beat impossible or irrelevant.',
  `Propose at most ${MAX_TRANSITIONS} transitions, using only the beat ids listed. Propose none when nothing is settled.`
].join(' ')

/** What the Narrator is given for a Session. */
export interface Steering {
  /** The Narrator's full Arc block, with the drift hook appended when the story has drifted. */
  arcBlock: string
}

export interface BeatProgressOptions {
  /** Runs since the latest Beat transition that count as drift. */
  driftRuns?: number
  now?: () => number
  /** Where a dropped check failure is reported. Defaults to the console. */
  log?: (message: string) => void
}

export function createBeatProgress(db: Database, options: BeatProgressOptions = {}) {
  const driftRuns = options.driftRuns ?? DEFAULT_DRIFT_RUNS
  const now = options.now ?? Date.now
  const log = options.log ?? ((message: string) => console.warn(message))

  function campaignOf(sessionId: string): string | undefined {
    return db
      .select({ id: session.campaignId })
      .from(session)
      .where(eq(session.id, sessionId))
      .get()?.id
  }

  /** The Campaign's Arc with Beat ids, Acts and Beats in order; null when it has none. */
  function load(
    campaignId: string
  ): { arc: SteeringArc; actPositions: Map<string, number> } | null {
    const row = db.select().from(arc).where(eq(arc.campaignId, campaignId)).get()
    if (!row) return null
    const acts = db
      .select()
      .from(arcAct)
      .where(eq(arcAct.arcId, row.id))
      .orderBy(asc(arcAct.position))
      .all()
    const beats = acts.length
      ? db
          .select()
          .from(arcBeat)
          .where(
            inArray(
              arcBeat.actId,
              acts.map((a) => a.id)
            )
          )
          .orderBy(asc(arcBeat.position))
          .all()
      : []
    const actPositions = new Map(acts.map((a, i) => [a.id, i]))
    return {
      actPositions,
      arc: {
        title: row.title,
        resolution: row.resolution,
        acts: acts.map((a) => ({
          name: a.name,
          purpose: a.purpose,
          beats: beats
            .filter((b) => b.actId === a.id)
            .map((b) => ({
              id: b.id,
              title: b.title,
              description: b.description,
              state: b.state
            }))
        }))
      }
    }
  }

  /**
   * Exchanges since the latest Beat transition, across the Campaign's Sessions. One starts with a
   * Declaration or a resolved roll; every one after the transition's last covered event counts.
   */
  function runsSinceTransition(campaignId: string, beatIds: string[]): number {
    const stamped = beatIds.length
      ? db
          .select({ id: arcBeat.stateEventId })
          .from(arcBeat)
          .where(and(inArray(arcBeat.id, beatIds), sql`${arcBeat.stateEventId} IS NOT NULL`))
          .all()
          .map((r) => r.id as string)
      : []
    const last = stamped.length
      ? (db
          .select({ rowid: sql<number>`max(rowid)` })
          .from(sessionEvent)
          .where(inArray(sessionEvent.id, stamped))
          .get()?.rowid ?? 0)
      : 0
    return (
      db
        .select({ n: sql<number>`count(*)` })
        .from(sessionEvent)
        .innerJoin(session, eq(sessionEvent.sessionId, session.id))
        .where(
          and(
            eq(session.campaignId, campaignId),
            inArray(sessionEvent.kind, [...RUN_START_KINDS]),
            sql`${sessionEvent}.rowid > ${last}`
          )
        )
        .get()?.n ?? 0
    )
  }

  /** The prompts' Arc steering for a Session; null when its Campaign has no Arc. */
  function steering(sessionId: string): Steering | null {
    const campaignId = campaignOf(sessionId)
    const loaded = campaignId ? load(campaignId) : null
    if (!campaignId || !loaded) return null
    const changed = loaded.arc.acts.flatMap((a) => a.beats.filter((b) => b.state !== 'pending'))
    const drifting =
      currentActIndex(loaded.arc) >= 0 &&
      isDrifting(
        runsSinceTransition(
          campaignId,
          changed.map((b) => b.id)
        ),
        driftRuns
      )
    const block = arcBlock(loaded.arc)
    return {
      arcBlock: drifting ? `${block}\n${DRIFT_HOOK}` : block
    }
  }

  /**
   * Applies validated transitions in one transaction, then abandons pending Beats of Acts before
   * the latest reached Beat's Act. Each Beat changes once; the stamps name the Session and the
   * last Event id the check covered.
   */
  function apply(
    sessionId: string,
    eventId: string,
    proposals: { beatId: string; to: 'reached' | 'abandoned' }[],
    actPositions: Map<string, number>
  ) {
    const stamp = (to: 'reached' | 'abandoned') => ({
      state: to,
      stateSessionId: sessionId,
      stateEventId: eventId,
      stateChangedAt: now()
    })
    db.transaction((tx) => {
      let reachedAct = -1
      for (const { beatId, to } of proposals) {
        const beat = tx.select().from(arcBeat).where(eq(arcBeat.id, beatId)).get()
        if (!beat || !validateBeatTransition(beat.state, to).ok) continue
        tx.update(arcBeat).set(stamp(to)).where(eq(arcBeat.id, beatId)).run()
        if (to === 'reached') reachedAct = Math.max(reachedAct, actPositions.get(beat.actId) ?? -1)
      }
      const earlier = [...actPositions].filter(([, i]) => i < reachedAct).map(([id]) => id)
      if (earlier.length) {
        tx.update(arcBeat)
          .set(stamp('abandoned'))
          .where(and(inArray(arcBeat.actId, earlier), eq(arcBeat.state, 'pending')))
          .run()
      }
    })
  }

  async function runCheck(sessionId: string, fromSeq: number, port: ChatPort) {
    const campaignId = campaignOf(sessionId)
    const loaded = campaignId ? load(campaignId) : null
    if (!loaded) return
    const offered = checkableBeats(loaded.arc)
    if (!offered.length) return
    const events = db
      .select()
      .from(sessionEvent)
      .where(and(eq(sessionEvent.sessionId, sessionId), sql`${sessionEvent.seq} >= ${fromSeq}`))
      .orderBy(asc(sessionEvent.seq))
      .all()
    const last = events.at(-1)
    if (!last) return

    const prompt = [
      `Pending beats:\n${offered.map((b) => `${b.id}: ${b.title} - ${b.description}`).join('\n')}`,
      `Events of this run:\n${events
        .map((e) => (e.kind === 'declaration' ? `Player: ${e.text}` : `${e.role}: ${e.text ?? ''}`))
        .join('\n')}`
    ].join('\n\n')
    const call = await callModel(port, {
      systemPrompts: [CHECK_SYSTEM],
      messages: [{ role: 'user', content: prompt }],
      maxTokens: CHECK_MAX_TOKENS,
      threadId: sessionId,
      outputSchema: proposalSchema,
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS)
    })
    if (!call.ok) throw new Error(call.failure.message)
    const parsed = proposalSchema.safeParse(call.object)
    if (!parsed.success) throw new Error('The Beat check returned an unusable answer')

    const allowed = new Set(offered.map((b) => b.id))
    const seen = new Set<string>()
    const accepted = parsed.data.transitions
      .slice(0, MAX_TRANSITIONS)
      .filter((t) => allowed.has(t.beatId) && !seen.has(t.beatId) && !!seen.add(t.beatId))
    if (accepted.length) apply(sessionId, last.id, accepted, loaded.actPositions)
  }

  return {
    steering,
    /**
     * The silent Beat check over one run's events (those from `fromSeq` on). A failure is logged
     * and dropped: it never throws and is never retried.
     */
    async check(sessionId: string, fromSeq: number, port: ChatPort): Promise<void> {
      try {
        await runCheck(sessionId, fromSeq, port)
      } catch (error) {
        log(`Beat check dropped: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }
}

export type BeatProgress = ReturnType<typeof createBeatProgress>
