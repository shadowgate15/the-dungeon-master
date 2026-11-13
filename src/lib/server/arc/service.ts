import { and, asc, eq, inArray } from 'drizzle-orm'
import { arcProblems, type ArcDraft } from '#lib/arc/arc.ts'
import type { Length } from '#lib/campaign/enums.ts'
import type { Database } from '../db/connect'
import { arc, arcAct, arcBeat, campaign, session } from '../db/schema'
import { createWorldService } from '../world/service'

/** The input breaks an Arc rule (size ranges, blank or over-long text, no Arc to edit). */
export class ArcValidationError extends Error {}

/** The Campaign cannot change its Arc right now: read-only, or a Session has started. */
export class ArcLockedError extends Error {}

/** A pending Beat extraction may move, with the name of its Act. */
export interface OpenBeat {
  id: string
  title: string
  description: string
  act: string
}

export type ArcBeatView = typeof arcBeat.$inferSelect
export interface ArcActView {
  id: string
  name: string
  purpose: string
  beats: ArcBeatView[]
}
export interface ArcView {
  id: string
  status: 'draft' | 'accepted'
  title: string
  premise: string
  stakes: string
  resolution: string
  acts: ArcActView[]
}

/** What the player edits: the Arc's text and structure. Ids keep existing rows (and their state). */
export interface ArcEdit {
  title: string
  premise: string
  stakes: string
  resolution: string
  acts: {
    id?: string
    name: string
    purpose: string
    beats: { id?: string; title: string; description: string }[]
  }[]
}

export function createArcService(db: Database, now: () => number = Date.now) {
  const worlds = createWorldService(db, now)

  function context(campaignId: string) {
    const camp = db.select().from(campaign).where(eq(campaign.id, campaignId)).get()
    if (!camp) throw new ArcValidationError('Campaign not found')
    const readOnly = camp.archivedAt !== null || worlds.isCampaignReadOnly(campaignId)
    const started =
      db
        .select({ id: session.id })
        .from(session)
        .where(eq(session.campaignId, campaignId))
        .limit(1)
        .get() !== undefined
    return { length: camp.length as Length, readOnly, started }
  }

  function load(campaignId: string): ArcView | null {
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
    return {
      id: row.id,
      status: row.status,
      title: row.title,
      premise: row.premise,
      stakes: row.stakes,
      resolution: row.resolution,
      acts: acts.map((a) => ({
        id: a.id,
        name: a.name,
        purpose: a.purpose,
        beats: beats.filter((b) => b.actId === a.id)
      }))
    }
  }

  const trimmed = (edit: ArcEdit): ArcEdit => ({
    title: edit.title?.trim() ?? '',
    premise: edit.premise?.trim() ?? '',
    stakes: edit.stakes?.trim() ?? '',
    resolution: edit.resolution?.trim() ?? '',
    acts: (edit.acts ?? []).map((a) => ({
      id: a.id,
      name: a.name?.trim() ?? '',
      purpose: a.purpose?.trim() ?? '',
      beats: (a.beats ?? []).map((b) => ({
        id: b.id,
        title: b.title?.trim() ?? '',
        description: b.description?.trim() ?? ''
      }))
    }))
  })

  return {
    /** The Campaign's Arc with Acts and Beats in order, or null. */
    get: load,

    /**
     * What the Campaign page may offer: Generate and Regenerate only before the first Session and
     * on an editable Campaign; structure edits only before the first Session.
     */
    availability(campaignId: string) {
      const { readOnly, started } = context(campaignId)
      return { canGenerate: !readOnly && !started, structureLocked: started }
    },

    /**
     * The Beats extraction may move now: the pending Beats of the current Act (the Act of the
     * first pending Beat) and of the next Act. Empty without an accepted Arc, or once complete.
     */
    openBeats(campaignId: string): OpenBeat[] {
      const found = load(campaignId)
      if (!found || found.status !== 'accepted') return []
      const current = found.acts.findIndex((a) => a.beats.some((b) => b.state === 'pending'))
      if (current === -1) return []
      return found.acts
        .slice(current, current + 2)
        .flatMap((a) =>
          a.beats
            .filter((b) => b.state === 'pending')
            .map((b) => ({ id: b.id, title: b.title, description: b.description, act: a.name }))
        )
    },

    /**
     * Moves a pending Beat to `reached` or `abandoned` for good, stamping the source Session and
     * Turn. False (and no change) when the Beat is not pending.
     */
    transitionBeat(
      beatId: string,
      state: 'reached' | 'abandoned',
      at: { sessionId: string; seq: number }
    ): boolean {
      const changed = db
        .update(arcBeat)
        .set({ state, sourceSessionId: at.sessionId, sourceTurnSeq: at.seq })
        .where(and(eq(arcBeat.id, beatId), eq(arcBeat.state, 'pending')))
        .run().changes
      return changed > 0
    },

    /** Replaces the whole Arc (if any) with a freshly generated draft. */
    replaceWithDraft(campaignId: string, generated: ArcDraft): ArcView {
      const { length, readOnly, started } = context(campaignId)
      if (readOnly) throw new ArcLockedError('This Campaign is read-only')
      if (started) throw new ArcLockedError('The Arc is locked once a Session has started')
      const problems = arcProblems(generated, length, { generated: true })
      if (problems.length) throw new ArcValidationError(problems.join('; '))
      db.transaction((tx) => {
        tx.delete(arc).where(eq(arc.campaignId, campaignId)).run()
        const at = now()
        const row = tx
          .insert(arc)
          .values({
            campaignId,
            status: 'draft',
            title: generated.title.trim(),
            premise: generated.premise.trim(),
            stakes: generated.stakes.trim(),
            resolution: generated.resolution.trim(),
            createdAt: at,
            updatedAt: at
          })
          .returning()
          .get()
        generated.acts.forEach((a, i) => {
          const act = tx
            .insert(arcAct)
            .values({ arcId: row.id, position: i, name: a.name.trim(), purpose: a.purpose.trim() })
            .returning()
            .get()
          tx.insert(arcBeat)
            .values(
              a.beats.map((b, j) => ({
                actId: act.id,
                position: j,
                title: b.title.trim(),
                description: b.description.trim()
              }))
            )
            .run()
        })
      })
      return load(campaignId)!
    },

    /**
     * Saves the player's edits. Before the first Session, Acts and Beats may be added, deleted and
     * reordered within the Length ranges; afterwards only text changes, and Beat state is kept.
     * `accept` marks the Arc accepted; saving never turns an accepted Arc back into a draft.
     */
    save(campaignId: string, input: ArcEdit, options: { accept?: boolean } = {}): ArcView {
      const { length, readOnly, started } = context(campaignId)
      if (readOnly) throw new ArcLockedError('This Campaign is read-only')
      const current = load(campaignId)
      if (!current) throw new ArcValidationError('There is no Arc to edit')
      const edit = trimmed(input)

      if (started) {
        const sameShape =
          edit.acts.length === current.acts.length &&
          edit.acts.every(
            (a, i) =>
              a.id === current.acts[i].id &&
              a.beats.length === current.acts[i].beats.length &&
              a.beats.every((b, j) => b.id === current.acts[i].beats[j].id)
          )
        if (!sameShape) {
          throw new ArcLockedError('The Arc structure is locked once a Session has started')
        }
      }
      const problems = arcProblems(edit, length)
      if (problems.length) throw new ArcValidationError(problems.join('; '))

      const ownActs = new Set(current.acts.map((a) => a.id))
      const ownBeats = new Set(current.acts.flatMap((a) => a.beats.map((b) => b.id)))
      db.transaction((tx) => {
        const keptActs: string[] = []
        const keptBeats: string[] = []
        edit.acts.forEach((a, i) => {
          let actId = a.id && ownActs.has(a.id) ? a.id : undefined
          if (actId) {
            tx.update(arcAct)
              .set({ position: i, name: a.name, purpose: a.purpose })
              .where(eq(arcAct.id, actId))
              .run()
          } else {
            actId = tx
              .insert(arcAct)
              .values({ arcId: current.id, position: i, name: a.name, purpose: a.purpose })
              .returning()
              .get().id
          }
          keptActs.push(actId)
          a.beats.forEach((b, j) => {
            if (b.id && ownBeats.has(b.id) && !keptBeats.includes(b.id)) {
              tx.update(arcBeat)
                .set({ actId, position: j, title: b.title, description: b.description })
                .where(eq(arcBeat.id, b.id))
                .run()
              keptBeats.push(b.id)
            } else {
              keptBeats.push(
                tx
                  .insert(arcBeat)
                  .values({ actId, position: j, title: b.title, description: b.description })
                  .returning()
                  .get().id
              )
            }
          })
        })
        for (const a of current.acts) {
          for (const b of a.beats) {
            if (!keptBeats.includes(b.id)) tx.delete(arcBeat).where(eq(arcBeat.id, b.id)).run()
          }
        }
        for (const a of current.acts) {
          if (!keptActs.includes(a.id)) tx.delete(arcAct).where(eq(arcAct.id, a.id)).run()
        }
        tx.update(arc)
          .set({
            title: edit.title,
            premise: edit.premise,
            stakes: edit.stakes,
            resolution: edit.resolution,
            status: options.accept ? 'accepted' : current.status,
            updatedAt: now()
          })
          .where(eq(arc.id, current.id))
          .run()
      })
      return load(campaignId)!
    }
  }
}

export type ArcService = ReturnType<typeof createArcService>
