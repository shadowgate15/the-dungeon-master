/**
 * Post-run memory extraction (ADR 0002's shape, rebuilt for scenes). After a run that ends in a
 * yield or roll request, a silent, stateless structured call reads the Event log past the
 * Session's watermark and proposes NPCs, Facts, dispositions and knowledge links. The model only
 * proposes; code validates each item on its own, drops what is invalid (recording kind and
 * reason, never text) and writes the rest. A call that fails leaves the watermark, three failures
 * in a row pause extraction for the Session until `resume`, and nothing here ever throws into a
 * run. One extraction runs per Session at a time, and the next action never waits on it.
 *
 * Code, not the model, puts a newcomer into the Scene (`placeNpc`) and writes a place when a move
 * lands somewhere World memory does not know.
 */
import { and, asc, eq, gt, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { MEMORY_MAX, NPC_STATUSES, type DroppedItem, type NpcStatus } from '#lib/memory/enums.ts'
import {
  normalizeName,
  validateDisposition,
  validateFact,
  validateNpc,
  validateNpcStatusChange
} from '#lib/memory/validate.ts'
import { callModel, type ChatPort } from '../ai/port.ts'
import type { Database } from '../db/connect'
import {
  disposition,
  fact,
  memoryRun,
  npc,
  npcFact,
  place,
  placeExit,
  session,
  sessionEvent,
  worldCampaign
} from '../db/schema'
import type { SessionService } from '../session/service.ts'

/** Marks the extraction call's system prompt; the fake LM Studio server keys its queue on it. */
export const EXTRACTION_MARKER = 'MEMORY EXTRACTION'

/** Per-call caps on accepted items of each kind. Tunable. */
export const EXTRACTION_CAPS = { npcs: 5, facts: 5, dispositions: 5, knowledge: 8 } as const
/** Consecutive failures that pause extraction for a Session. */
export const MAX_FAILURES = 3
/** Characters of event text one call covers; a longer backlog is covered by following calls. */
export const EVENT_TEXT_BUDGET = 6000
const MAX_CATCH_UP_CALLS = 5
const MAX_TOKENS = 1200
const TIMEOUT_MS = 90_000
const KNOWN_LISTED = 40
const KINDS_SHOWN = [
  'player-action',
  'narration',
  'npc-line',
  'roll-requested',
  'roll-resolved',
  'scene-changed'
] as const

const text = z.string().optional()
const proposalSchema = z.object({
  npcs: z.array(
    z.object({
      ref: text,
      name: text,
      description: text,
      role: text,
      status: text,
      present: z.boolean().optional(),
      seq: z.number().optional()
    })
  ),
  facts: z.array(
    z.object({
      title: text,
      detail: text,
      worldChanging: z.boolean().optional(),
      seq: z.number().optional()
    })
  ),
  dispositions: z.array(
    z.object({ npc: text, stance: text, note: text, seq: z.number().optional() })
  ),
  knowledge: z.array(z.object({ npc: text, fact: text }))
})
type Proposal = z.infer<typeof proposalSchema>

const SYSTEM = [
  `${EXTRACTION_MARKER}. You keep the record of a tabletop role-playing game. You are given the known NPCs and facts and the latest events; propose only what the events establish.`,
  'npcs: a new NPC needs name, description and role (new NPCs the narration introduced). To update a known NPC give its ref and a status (alive, dead, missing or departed).',
  'Set present to true only when narration put the new NPC at the current place, and give the seq of the event that introduced them.',
  'facts: lasting claims the story established, each with a title and a detail. Set worldChanging only when it changes the world for everyone.',
  'dispositions: how an NPC (a ref or a name) now regards the player character: stance (hostile, wary, neutral, friendly or allied) and a short note.',
  'knowledge: which NPC (a ref or a name) knows which fact (a ref or a title).',
  'Never write digits or numbers. Never invent anything the events do not show. Propose nothing when nothing new was established; empty lists are fine.'
].join(' ')

const ROLE_LABEL: Record<string, string> = {
  player: 'Player',
  narrator: 'Narrator',
  director: 'Director',
  code: 'Game'
}

export type ExtractionOutcome = 'success' | 'failure' | 'idle' | 'paused'

export interface MemoryExtractionOptions {
  now?: () => number
  /** Where a failed attempt is reported. Defaults to the console. */
  log?: (message: string) => void
}

type EventRow = typeof sessionEvent.$inferSelect

export function createMemoryExtraction(
  db: Database,
  sessions: SessionService,
  options: MemoryExtractionOptions = {}
) {
  const now = options.now ?? Date.now
  const log = options.log ?? ((message: string) => console.warn(message))
  // In-process state, reset on restart: consecutive failures per Session, and the serial queue.
  const failures = new Map<string, number>()
  const tails = new Map<string, Promise<unknown>>()
  const waiting = new Set<string>()

  const isPaused = (sessionId: string) => (failures.get(sessionId) ?? 0) >= MAX_FAILURES

  function render(rows: EventRow[], names: Map<string, string>): string {
    return rows
      .map((e) => {
        const who =
          e.kind === 'npc-line'
            ? `NPC ${names.get(e.npcId ?? '') ?? 'unknown'}`
            : (ROLE_LABEL[e.role] ?? e.role)
        return `#${e.seq} ${who}: ${e.text ?? e.kind}`
      })
      .join('\n')
  }

  /** The next slice of events past the watermark, within the text budget (at least one). */
  function pending(sessionId: string, watermark: number) {
    const all = db
      .select()
      .from(sessionEvent)
      .where(and(eq(sessionEvent.sessionId, sessionId), gt(sessionEvent.seq, watermark)))
      .orderBy(asc(sessionEvent.seq))
      .all()
    const taken: EventRow[] = []
    let used = 0
    for (const e of all) {
      used += (e.text ?? '').length + 24
      if (taken.length && used > EVENT_TEXT_BUDGET) break
      taken.push(e)
    }
    return { taken, more: taken.length < all.length }
  }

  function writeRun(
    sessionId: string,
    from: number,
    to: number,
    outcome: 'success' | 'failure',
    counts: { accepted: number; dropped: DroppedItem[] },
    startedAt: number
  ) {
    db.insert(memoryRun)
      .values({
        sessionId,
        kind: 'extraction',
        fromSeq: from,
        toSeq: to,
        outcome,
        accepted: counts.accepted,
        dropped: counts.dropped.length,
        droppedItems: counts.dropped,
        durationMs: Math.max(0, now() - startedAt),
        createdAt: now()
      })
      .run()
  }

  /** The Campaign's first World hosts any place code writes. */
  const hostWorld = (campaignId: string) =>
    db
      .select({ id: worldCampaign.worldId })
      .from(worldCampaign)
      .where(eq(worldCampaign.campaignId, campaignId))
      .get()?.id

  const livePlace = (campaignId: string, name: string) => {
    const key = normalizeName(name)
    return db
      .select()
      .from(place)
      .where(and(eq(place.campaignId, campaignId), isNull(place.retiredAt)))
      .all()
      .find((p) => normalizeName(p.name) === key)
  }

  /**
   * The place rule: a `move` that landed somewhere World memory does not know gets a place,
   * written by code from the Scene (the move step generates the destination first; this only
   * covers a landing that was never stored). Only the Scene as it stands now describes a place.
   */
  function writePlaces(
    sessionId: string,
    campaignId: string,
    events: EventRow[],
    last: number
  ): void {
    const scene = sessions.scene(sessionId)
    const world = hostWorld(campaignId)
    if (!world) return
    for (const e of events) {
      if (e.kind !== 'scene-changed') continue
      const to = (e.data as { to?: unknown } | null)?.to
      if (typeof to !== 'string' || !to.trim() || livePlace(campaignId, to)) continue
      const current = normalizeName(scene.location.name) === normalizeName(to)
      const row = db
        .insert(place)
        .values({
          campaignId,
          worldId: world,
          name: to.trim().slice(0, MEMORY_MAX.placeName),
          description: (current && scene.location.description.trim()
            ? scene.location.description
            : 'A place the party reached.'
          ).slice(0, MEMORY_MAX.placeDescription),
          createdSessionId: sessionId,
          createdSeq: e.seq,
          changedSessionId: sessionId,
          changedSeq: last
        })
        .returning()
        .get()
      if (!current) continue
      const seen = new Set<string>()
      for (const exit of scene.exits) {
        const name = exit.name.trim().slice(0, MEMORY_MAX.exitName)
        if (!name || seen.has(name)) continue
        seen.add(name)
        db.insert(placeExit).values({ placeId: row.id, name }).run()
      }
    }
  }

  /** Validates and writes one proposal; returns what was accepted, dropped and to be placed. */
  function apply(
    sessionId: string,
    owner: { campaignId: string; characterId: string },
    proposal: Proposal,
    range: { from: number; to: number; sceneChangedAt: number }
  ) {
    const dropped: DroppedItem[] = []
    const drop = (kind: string, reason: string) => void dropped.push({ kind, reason })
    let accepted = 0
    const placements: string[] = []
    const stamp = (seq: number | undefined) => ({
      changedSessionId: sessionId,
      changedSeq: seq ?? range.to
    })
    const inRange = (seq: number | undefined) =>
      seq === undefined || (Number.isInteger(seq) && seq >= range.from && seq <= range.to)

    const npcs = db.select().from(npc).where(eq(npc.campaignId, owner.campaignId)).all()
    const takenKeys = new Set(npcs.map((n) => n.nameKey))
    const facts = db
      .select()
      .from(fact)
      .where(
        and(
          eq(fact.campaignId, owner.campaignId),
          isNull(fact.retiredAt),
          isNull(fact.supersededById)
        )
      )
      .all()
    const npcByHandle = handles(known(npcs), 'n')
    const factByHandle = handles(facts.slice(-KNOWN_LISTED), 'f')
    const npcByName = new Map<string, string>(npcs.map((n) => [n.nameKey, n.id]))
    const factByTitle = new Map<string, string>(facts.map((f) => [normalizeName(f.title), f.id]))
    const statusOf = new Map<string, NpcStatus>(npcs.map((n) => [n.id, n.status]))

    const resolveNpc = (ref: string | undefined) =>
      ref ? (npcByHandle.get(ref.trim()) ?? npcByName.get(normalizeName(ref))) : undefined
    const resolveFact = (ref: string | undefined) =>
      ref ? (factByHandle.get(ref.trim()) ?? factByTitle.get(normalizeName(ref))) : undefined
    const capped = <T>(kind: string, items: T[], cap: number) => {
      for (let i = cap; i < items.length; i++) drop(kind, 'over the per-call cap')
      return items.slice(0, cap)
    }

    for (const item of capped('npc', proposal.npcs, EXTRACTION_CAPS.npcs)) {
      if (!inRange(item.seq)) {
        drop('npc', 'cites an event outside the covered range')
        continue
      }
      if (item.ref) {
        const id = npcByHandle.get(item.ref.trim())
        const existing = npcs.find((n) => n.id === id)
        if (!existing) {
          drop('npc', 'unknown NPC ref')
          continue
        }
        const to = (item.status ?? existing.status) as NpcStatus
        const changed = validateNpcStatusChange(existing.status, to)
        if (!changed.ok) drop('npc', changed.reason)
        else if (changed.value === existing.status) drop('npc', 'nothing to change')
        else {
          db.update(npc)
            .set({ status: changed.value, ...stamp(item.seq) })
            .where(eq(npc.id, existing.id))
            .run()
          statusOf.set(existing.id, changed.value)
          accepted++
        }
        continue
      }
      const valid = validateNpc(
        { name: item.name ?? '', description: item.description ?? '', role: item.role ?? '' },
        { takenKeys }
      )
      if (!valid.ok) {
        drop('npc', valid.reason)
        continue
      }
      const status: NpcStatus = NPC_STATUSES.includes(item.status as NpcStatus)
        ? (item.status as NpcStatus)
        : 'alive'
      const seq = item.seq ?? range.to
      const row = db
        .insert(npc)
        .values({
          campaignId: owner.campaignId,
          name: valid.value.name,
          nameKey: valid.value.nameKey,
          description: valid.value.description,
          role: valid.value.role,
          status,
          createdSessionId: sessionId,
          createdSeq: seq,
          ...stamp(seq)
        })
        .returning()
        .get()
      takenKeys.add(valid.value.nameKey)
      npcByName.set(valid.value.nameKey, row.id)
      statusOf.set(row.id, status)
      accepted++
      // Only narration that put them here, after the last move this call covers, counts.
      if (item.present === true && status === 'alive' && seq >= range.sceneChangedAt) {
        placements.push(row.id)
      }
    }

    for (const item of capped('fact', proposal.facts, EXTRACTION_CAPS.facts)) {
      if (!inRange(item.seq)) {
        drop('fact', 'cites an event outside the covered range')
        continue
      }
      const valid = validateFact({
        title: item.title ?? '',
        detail: item.detail ?? '',
        worldChanging: item.worldChanging
      })
      if (!valid.ok) {
        drop('fact', valid.reason)
        continue
      }
      const key = normalizeName(valid.value.title)
      if (factByTitle.has(key)) {
        drop('fact', 'a live fact already has this title')
        continue
      }
      const seq = item.seq ?? range.to
      const row = db
        .insert(fact)
        .values({
          campaignId: owner.campaignId,
          ...valid.value,
          createdSessionId: sessionId,
          createdSeq: seq,
          ...stamp(seq)
        })
        .returning()
        .get()
      factByTitle.set(key, row.id)
      accepted++
    }

    for (const item of capped('disposition', proposal.dispositions, EXTRACTION_CAPS.dispositions)) {
      const id = resolveNpc(item.npc)
      if (!id) {
        drop('disposition', 'unknown NPC')
        continue
      }
      const valid = validateDisposition({ stance: item.stance ?? '', note: item.note ?? '' })
      if (!valid.ok) {
        drop('disposition', valid.reason)
        continue
      }
      if (!inRange(item.seq)) {
        drop('disposition', 'cites an event outside the covered range')
        continue
      }
      const values = { ...valid.value, ...stamp(item.seq) }
      db.insert(disposition)
        .values({ npcId: id, characterId: owner.characterId, ...values })
        .onConflictDoUpdate({ target: [disposition.npcId, disposition.characterId], set: values })
        .run()
      accepted++
    }

    for (const item of capped('knowledge', proposal.knowledge, EXTRACTION_CAPS.knowledge)) {
      const npcId = resolveNpc(item.npc)
      const factId = resolveFact(item.fact)
      if (!npcId || !factId) {
        drop('knowledge', npcId ? 'unknown fact' : 'unknown NPC')
        continue
      }
      db.insert(npcFact).values({ npcId, factId }).onConflictDoNothing().run()
      accepted++
    }

    return { accepted, dropped, placements }
  }

  /** Live NPCs (not retired) listed to the model, most recently changed last. */
  function known<T extends { retiredAt: number | null }>(rows: T[]): T[] {
    return rows.filter((r) => r.retiredAt === null).slice(-KNOWN_LISTED)
  }

  function handles<T extends { id: string }>(rows: T[], prefix: string): Map<string, string> {
    return new Map(rows.map((r, i) => [`${prefix}${i + 1}`, r.id]))
  }

  /** The "known records" part of the prompt, using the same handles `apply` resolves. */
  function knownBlock(campaignId: string): string {
    const npcs = known(db.select().from(npc).where(eq(npc.campaignId, campaignId)).all())
    const facts = db
      .select()
      .from(fact)
      .where(
        and(eq(fact.campaignId, campaignId), isNull(fact.retiredAt), isNull(fact.supersededById))
      )
      .all()
      .slice(-KNOWN_LISTED)
    return [
      `Known NPCs:\n${npcs.length ? npcs.map((n, i) => `n${i + 1}: ${n.name} (${n.role}, ${n.status})`).join('\n') : 'none'}`,
      `Known facts:\n${facts.length ? facts.map((f, i) => `f${i + 1}: ${f.title}`).join('\n') : 'none'}`
    ].join('\n\n')
  }

  /** One attempt over the next slice of the log. Never throws. */
  async function attempt(
    sessionId: string,
    port: ChatPort
  ): Promise<{ outcome: ExtractionOutcome; more: boolean }> {
    const startedAt = now()
    let range: { from: number; to: number } | undefined
    try {
      const owner = db.select().from(session).where(eq(session.id, sessionId)).get()
      if (!owner) return { outcome: 'idle', more: false }
      const { taken, more } = pending(sessionId, owner.memoryThroughSeq)
      if (!taken.length) return { outcome: 'idle', more: false }
      range = { from: taken[0].seq, to: taken.at(-1)!.seq }
      const shown = taken.filter((e) => (KINDS_SHOWN as readonly string[]).includes(e.kind))
      if (!shown.length) {
        // Nothing to read (only mode changes): the range is covered without a call.
        db.update(session)
          .set({ memoryThroughSeq: range.to })
          .where(eq(session.id, sessionId))
          .run()
        return { outcome: 'idle', more }
      }

      const names = new Map(
        db
          .select({ id: npc.id, name: npc.name })
          .from(npc)
          .where(eq(npc.campaignId, owner.campaignId))
          .all()
          .map((n) => [n.id, n.name])
      )
      const scene = sessions.scene(sessionId)
      const prompt = [
        knownBlock(owner.campaignId),
        `Current place: ${scene.location.name}`,
        `Events:\n${render(shown, names)}`
      ].join('\n\n')
      const call = await callModel(port, {
        systemPrompts: [SYSTEM],
        messages: [{ role: 'user', content: prompt }],
        maxTokens: MAX_TOKENS,
        threadId: sessionId,
        outputSchema: proposalSchema,
        signal: AbortSignal.timeout(TIMEOUT_MS)
      })
      const parsed = call.ok ? proposalSchema.safeParse(call.object) : undefined
      if (!call.ok || !parsed?.success) {
        throw new Error(
          call.ok ? 'The extraction returned an unusable answer' : call.failure.message
        )
      }

      const sceneChangedAt = Math.max(
        0,
        ...taken.filter((e) => e.kind === 'scene-changed').map((e) => e.seq)
      )
      const startLocation = scene.location.name
      const result = db.transaction(() => {
        const done = apply(sessionId, owner, parsed.data, { ...range!, sceneChangedAt })
        writePlaces(sessionId, owner.campaignId, taken, range!.to)
        db.update(session)
          .set({ memoryThroughSeq: range!.to })
          .where(eq(session.id, sessionId))
          .run()
        writeRun(sessionId, range!.from, range!.to, 'success', done, startedAt)
        return done
      })
      // Placement is code's call, and only while the Scene is still where narration put them.
      if (sessions.scene(sessionId).location.name === startLocation) {
        for (const id of result.placements) {
          if (!sessions.placeNpc(sessionId, id)) continue
          const here = livePlace(owner.campaignId, startLocation)
          if (here) db.update(npc).set({ placeId: here.id }).where(eq(npc.id, id)).run()
        }
      }
      failures.delete(sessionId)
      return { outcome: 'success', more }
    } catch (error) {
      const count = (failures.get(sessionId) ?? 0) + 1
      failures.set(sessionId, count)
      const message = error instanceof Error ? error.message : String(error)
      log(
        `Memory extraction failed (${count} in a row${count >= MAX_FAILURES ? ', paused until the Session ends' : ''}): ${message}`
      )
      try {
        if (range)
          writeRun(
            sessionId,
            range.from,
            range.to,
            'failure',
            { accepted: 0, dropped: [] },
            startedAt
          )
      } catch {
        // Recording the failure must not fail anything either.
      }
      return { outcome: 'failure', more: false }
    }
  }

  /** Runs after whatever is already running for the Session; covers a long backlog in slices. */
  function serialize(
    sessionId: string,
    port: ChatPort,
    force: boolean,
    before?: () => void
  ): Promise<ExtractionOutcome> {
    const run = async (): Promise<ExtractionOutcome> => {
      before?.()
      let outcome: ExtractionOutcome = 'idle'
      for (let i = 0; i < MAX_CATCH_UP_CALLS; i++) {
        if (!force && isPaused(sessionId)) return 'paused'
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
    /** The last Event seq extraction covers for the Session; 0 before the first success. */
    watermark(sessionId: string): number {
      return (
        db
          .select({ n: session.memoryThroughSeq })
          .from(session)
          .where(eq(session.id, sessionId))
          .get()?.n ?? 0
      )
    },

    /** Whether three failures in a row paused extraction for the Session. */
    paused: isPaused,

    /** Whether an extraction is running or queued for the Session. */
    running: (sessionId: string) => tails.has(sessionId),

    /**
     * Fire and forget: extracts in the background after a run. Calls made while one is running
     * coalesce into one follow-up, so an extraction never waits on the next action or piles up.
     * Never rejects.
     */
    trigger(sessionId: string, port: ChatPort): Promise<void> {
      if (isPaused(sessionId) || waiting.has(sessionId)) return Promise.resolve()
      waiting.add(sessionId)
      return serialize(sessionId, port, false, () => waiting.delete(sessionId)).then(
        () => undefined
      )
    },

    /**
     * Extracts now (after any running extraction) and reports the outcome; `force` ignores a
     * pause. For the Session-end final extraction. Never rejects.
     */
    extract(
      sessionId: string,
      port: ChatPort,
      options: { force?: boolean } = {}
    ): Promise<ExtractionOutcome> {
      return serialize(sessionId, port, options.force === true)
    },

    /** Lifts a pause and clears the failure count; call when the Session ends. */
    resume(sessionId: string): void {
      failures.delete(sessionId)
    },

    /**
     * Resolves true once nothing is running or queued for the Session, or false after
     * `timeoutMs` (the extraction keeps running).
     */
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
    }
  }
}

export type MemoryExtraction = ReturnType<typeof createMemoryExtraction>
