/**
 * The Rolling summary: a separate, stateless, free-text call that runs in the background and
 * merges the Session's previous summary with the events its watermark does not yet cover. It runs
 * only when that uncovered event text outgrows `SUMMARY_THRESHOLD_TOKENS`. Code validates the
 * answer (prose, no digits, capped size); only a valid answer is written, and only then does the
 * summary watermark advance. A failure leaves both untouched, is recorded as a `summary`
 * memory-run row and logged, and never throws into a run. One summary runs per Session at a time.
 */
import { and, asc, desc, eq, gt, lt } from 'drizzle-orm'
import { NO_DIGITS_RULE } from '#lib/memory/prompts.ts'
import { validateSummary } from '#lib/memory/validate.ts'
import { callText, type ChatPort } from '../ai/port.ts'
import type { Database } from '../db/connect'
import { memoryRun, session, sessionEvent } from '../db/schema'

/** Marks the summary call's system prompt; the fake LM Studio server keys its queue on it. */
export const SUMMARY_MARKER = 'ROLLING SUMMARY'

/** Uncovered event text (in tokens, estimated) that triggers a summary. Tunable. */
export const SUMMARY_THRESHOLD_TOKENS = 1200
/** The size the summary is asked to stay within, in tokens. Tunable. */
export const SUMMARY_SIZE_TOKENS = 400
/** Characters of event text one call covers; a longer backlog is covered by following calls. */
export const SUMMARY_EVENT_TEXT_BUDGET = 6000
const MAX_CATCH_UP_CALLS = 3
const TIMEOUT_MS = 90_000
const CHARS_PER_TOKEN = 4
const KINDS_SHOWN = ['declaration', 'narration', 'npc-line'] as const

const SYSTEM = [
  `${SUMMARY_MARKER}. You keep the running summary of a tabletop role-playing game.`,
  `You are given the summary so far (it may be empty) and the newer events. Write the updated summary: one piece of plain prose, past tense, under ${SUMMARY_SIZE_TOKENS} tokens, merging what mattered in the old summary with what the new events established.`,
  'Keep who the player met, what was learned, what was decided and where things stand. Leave out blow-by-blow detail.',
  `${NO_DIGITS_RULE} Never invent anything the events do not show. Reply with the summary text only.`
].join(' ')

const ROLE_LABEL: Record<string, string> = {
  player: 'Player',
  narrator: 'Narrator',
  npc: 'NPC',
  code: 'Game'
}

export type SummaryOutcome = 'success' | 'failure' | 'idle'

export interface RollingSummaryOptions {
  now?: () => number
  /** Where a failed attempt is reported. Defaults to the console. */
  log?: (message: string) => void
}

/** What a new Session's first view recaps: the previous summary, else its last narration. */
export type Recap =
  | { source: 'summary'; sessionId: string; text: string }
  | { source: 'narration'; sessionId: string; text: string }

type EventRow = typeof sessionEvent.$inferSelect

const tokensOf = (chars: number) => Math.ceil(chars / CHARS_PER_TOKEN)

export function createRollingSummary(db: Database, options: RollingSummaryOptions = {}) {
  const now = options.now ?? Date.now
  const log = options.log ?? ((message: string) => console.warn(message))
  const tails = new Map<string, Promise<unknown>>()
  const waiting = new Set<string>()

  function uncovered(sessionId: string, watermark: number): EventRow[] {
    return db
      .select()
      .from(sessionEvent)
      .where(and(eq(sessionEvent.sessionId, sessionId), gt(sessionEvent.seq, watermark)))
      .orderBy(asc(sessionEvent.seq))
      .all()
  }

  const isShown = (e: EventRow) => (KINDS_SHOWN as readonly string[]).includes(e.kind) && !!e.text
  const weight = (e: EventRow) => (isShown(e) ? (e.text ?? '').length + 10 : 0)

  const render = (rows: EventRow[]) =>
    rows
      .filter(isShown)
      .map((e) => `${ROLE_LABEL[e.role] ?? e.role}: ${e.text}`)
      .join('\n')

  function writeRun(
    sessionId: string,
    range: { from: number; to: number },
    outcome: 'success' | 'failure',
    reason: string | undefined,
    startedAt: number
  ) {
    db.insert(memoryRun)
      .values({
        sessionId,
        kind: 'summary',
        fromSeq: range.from,
        toSeq: range.to,
        outcome,
        accepted: outcome === 'success' ? 1 : 0,
        dropped: reason ? 1 : 0,
        droppedItems: reason ? [{ kind: 'summary', reason }] : [],
        durationMs: Math.max(0, now() - startedAt),
        createdAt: now()
      })
      .run()
  }

  /** One attempt over the next slice of uncovered events. Never throws. */
  async function attempt(
    sessionId: string,
    port: ChatPort
  ): Promise<{ outcome: SummaryOutcome; more: boolean }> {
    const startedAt = now()
    let range: { from: number; to: number } | undefined
    let reason: string | undefined
    try {
      const owner = db.select().from(session).where(eq(session.id, sessionId)).get()
      if (!owner) return { outcome: 'idle', more: false }
      const all = uncovered(sessionId, owner.summaryThroughSeq)
      if (tokensOf(all.reduce((n, e) => n + weight(e), 0)) <= SUMMARY_THRESHOLD_TOKENS) {
        return { outcome: 'idle', more: false }
      }

      const taken: EventRow[] = []
      let used = 0
      for (const e of all) {
        used += weight(e)
        if (taken.length && used > SUMMARY_EVENT_TEXT_BUDGET) break
        taken.push(e)
      }
      range = { from: taken[0].seq, to: taken.at(-1)!.seq }
      const prompt = [
        `Summary so far:\n${owner.summary?.trim() || 'none yet'}`,
        `New events:\n${render(taken)}`
      ].join('\n\n')
      const call = await callText(port, {
        systemPrompts: [SYSTEM],
        messages: [{ role: 'user', content: prompt }],
        maxTokens: SUMMARY_SIZE_TOKENS * 2,
        threadId: sessionId,
        signal: AbortSignal.timeout(TIMEOUT_MS)
      })
      if (!call.ok) throw new Error(call.failure?.message ?? 'The summary came back empty')
      const valid = validateSummary(call.text)
      if (!valid.ok) {
        reason = valid.reason
        throw new Error(`The summary was rejected: ${valid.reason}`)
      }
      db.transaction(() => {
        db.update(session)
          .set({ summary: valid.value, summaryThroughSeq: range!.to })
          .where(eq(session.id, sessionId))
          .run()
        writeRun(sessionId, range!, 'success', undefined, startedAt)
      })
      return { outcome: 'success', more: taken.length < all.length }
    } catch (error) {
      log(`Rolling summary failed: ${error instanceof Error ? error.message : String(error)}`)
      try {
        if (range) writeRun(sessionId, range, 'failure', reason ?? 'the call failed', startedAt)
      } catch {
        // Recording the failure must not fail anything either.
      }
      return { outcome: 'failure', more: false }
    }
  }

  function serialize(sessionId: string, port: ChatPort, before?: () => void) {
    const run = async (): Promise<SummaryOutcome> => {
      before?.()
      let outcome: SummaryOutcome = 'idle'
      for (let i = 0; i < MAX_CATCH_UP_CALLS; i++) {
        const step = await attempt(sessionId, port)
        outcome = step.outcome === 'idle' && outcome !== 'idle' ? outcome : step.outcome
        if (!step.more || step.outcome === 'failure') break
      }
      return outcome
    }
    const previous = tails.get(sessionId) ?? Promise.resolve()
    const next = previous.then(run, run)
    const guarded = next.then(
      () => undefined,
      () => undefined
    )
    tails.set(sessionId, guarded)
    void guarded.then(() => tails.get(sessionId) === guarded && tails.delete(sessionId))
    return next
  }

  return {
    /** The Session's summary and the last Event seq it covers; `text` is null before one lands. */
    get(sessionId: string): { text: string | null; throughSeq: number } {
      const row = db.select().from(session).where(eq(session.id, sessionId)).get()
      return { text: row?.summary ?? null, throughSeq: row?.summaryThroughSeq ?? 0 }
    },

    /** Whether a summary is running or queued for the Session (the in-flight status). */
    running: (sessionId: string) => tails.has(sessionId),

    /**
     * Summarizes now (after any summary already running) when the uncovered text is over the
     * threshold, and reports the outcome. Never rejects.
     */
    summarize(sessionId: string, port: ChatPort): Promise<SummaryOutcome> {
      return serialize(sessionId, port)
    },

    /** Fire and forget after a run; calls made while one waits coalesce. Never rejects. */
    trigger(sessionId: string, port: ChatPort): Promise<void> {
      if (waiting.has(sessionId)) return Promise.resolve()
      waiting.add(sessionId)
      return serialize(sessionId, port, () => waiting.delete(sessionId)).then(() => undefined)
    },

    /** Resolves true once nothing is running or queued for the Session, false after `timeoutMs`. */
    async drain(sessionId: string, timeoutMs: number): Promise<boolean> {
      let timer: ReturnType<typeof setTimeout> | undefined
      const timeout = new Promise<false>((resolve) => {
        timer = setTimeout(() => resolve(false), timeoutMs)
      })
      const idle = (async () => {
        while (tails.has(sessionId)) await tails.get(sessionId)
        return true as const
      })()
      try {
        return await Promise.race([idle, timeout])
      } finally {
        clearTimeout(timer)
      }
    },

    /**
     * What a new Session recaps: the most recent Session of the Campaign that started before it
     * (ended or not, the same one the Scene carries over from),
     * as its summary, else its last Narrator event verbatim; undefined when there is nothing to
     * recap (a first Session).
     */
    recap(campaignId: string, beforeSessionId: string): Recap | undefined {
      const current = db.select().from(session).where(eq(session.id, beforeSessionId)).get()
      if (!current) return undefined
      const previous = db
        .select()
        .from(session)
        .where(and(eq(session.campaignId, campaignId), lt(session.startedAt, current.startedAt)))
        .orderBy(desc(session.startedAt))
        .get()
      if (!previous) return undefined
      if (previous.summary?.trim())
        return { source: 'summary', sessionId: previous.id, text: previous.summary }
      const last = db
        .select()
        .from(sessionEvent)
        .where(and(eq(sessionEvent.sessionId, previous.id), eq(sessionEvent.kind, 'narration')))
        .orderBy(desc(sessionEvent.seq))
        .get()
      return last?.text
        ? { source: 'narration', sessionId: previous.id, text: last.text }
        : undefined
    }
  }
}

export type RollingSummary = ReturnType<typeof createRollingSummary>
