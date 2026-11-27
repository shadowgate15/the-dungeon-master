import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { changedDraftFields, emptyDraft, type CharacterDraft } from '#lib/character/draft.ts'
import { detailToDraft } from '#lib/character/edit.ts'
import { BACKSTORY_MAX, SOLO_PLAYER, TEXT_MAX, type CharacterStatus } from '#lib/character/enums.ts'
import {
  levelUpIssue,
  levelUpOffer,
  MAX_LEVEL,
  type LevelUpOffer
} from '#lib/character/level-up.ts'
import type { ClaimRow } from '#lib/play/claims.ts'
import { tryDraftToCharacterInput } from '#lib/character/save.ts'
import { buildSummary, detailToSummaryData } from '#lib/character/summary.ts'
import { STEPS, type StepId } from '#lib/character/steps.ts'
import type { Database } from '../db/connect'
import { campaign, character, characterDraft, characterSpell, spell } from '../db/schema'
import { characterHandleOf } from '../knowledge/holders'
import { logChange } from '../play/notices'
import {
  CharacterNotFoundError,
  CharacterValidationError,
  createCharacterService,
  type Character,
  type CharacterDetail
} from './service'
import { loadWizardRules } from './wizard-rules'

/** An edit only the DM may make while no DM is at the table to make it. */
export class DmOnlyEditError extends Error {}

/** The Character details a Player may edit at any time, in or out of a Session. */
export type CharacterDetails = {
  notes?: string | null
  personality?: string | null
  appearance?: string | null
  /** Only before Begin, or with the DM at the table. */
  backstory?: string | null
}

const DETAIL_LIMITS = {
  notes: BACKSTORY_MAX,
  personality: TEXT_MAX,
  appearance: TEXT_MAX,
  backstory: BACKSTORY_MAX
} as const

/** "notes, personality and appearance". */
const listed = (words: string[]) =>
  words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`

/** A Claim the browser may not make or give up: the Character is taken, or not the browser's. */
export class ClaimRefusedError extends Error {}

/** The Campaign has no draft with this id. */
export class DraftNotFoundError extends Error {}

/** A row of the Party step: a saved Character or a draft with the step it is on. */
export type PartyMember =
  | {
      kind: 'character'
      id: string
      name: string
      status: CharacterStatus
      /** "Human Fighter, Acolyte". */
      description: string
    }
  | { kind: 'draft'; id: string; name: string; step: StepId; stepLabel: string }

/** A stored Character draft. */
export type StoredDraft = {
  id: string
  /** The browser that Claims the draft; null while it is unclaimed. */
  controllingPlayer: string | null
  draft: CharacterDraft
  step: StepId
  /** Bumped by every write that changes the draft; the DM's writes must pass it. */
  version: number
  /** The fields the DM set and the Player has not edited since: the wizard's "✎ DM" marks. */
  dmFields: string[]
}

/** What the wizard writes back: the whole draft and the step it is on. */
export type DraftWrite = { draft: CharacterDraft; step: StepId }

const stepLabel = (step: StepId) => STEPS.find((s) => s.id === step)?.label ?? step

/**
 * A Campaign's Characters and Character drafts, over its database. Drafts are stored with the
 * Campaign so a reload loses nothing (and the DM's tools can write into them later); a draft joins
 * the Party only when it is saved, which needs every wizard step to be valid.
 *
 * `attended` says whether a DM is at the table. Without one, a Player edit belongs to no Session
 * and, after Begin, is limited to what moves no clock and sets no number code didn't compute.
 */
export function createParty(
  db: Database,
  now: () => number = Date.now,
  { attended = () => true }: { attended?: () => boolean } = {}
) {
  const rules = loadWizardRules()
  const characters = createCharacterService(db, now)

  const begun = () => db.select({ at: campaign.begunAt }).from(campaign).get()?.at != null

  /** Refuses an edit the DM must make, while the Campaign has begun and the DM is away. */
  function dmOnly(what: string) {
    if (begun() && !attended()) {
      throw new DmOnlyEditError(
        `${what} is the DM’s to change once the Campaign has begun. Run dm in the Campaign folder and ask at the table.`
      )
    }
  }

  function row(id: string) {
    const found = db.select().from(characterDraft).where(eq(characterDraft.id, id)).get()
    if (!found) throw new DraftNotFoundError('Character draft not found')
    return found
  }

  /**
   * The Player's write. A write that changes nothing (the open wizard echoing a DM write back)
   * keeps the version; a field the Player changed loses its "✎ DM" mark.
   */
  function write(id: string, { draft, step }: DraftWrite) {
    const found = row(id)
    const before = { ...emptyDraft(), ...(found.data as CharacterDraft) }
    const edited = new Set<string>(changedDraftFields(before, draft))
    db.update(characterDraft)
      .set({
        data: draft,
        step,
        version: edited.size > 0 ? found.version + 1 : found.version,
        dmFields: found.dmFields.filter((f) => !edited.has(f)),
        updatedAt: now()
      })
      .where(eq(characterDraft.id, id))
      .run()
  }

  /** Logs a Player edit to a Character, so the DM hears of it on the next channel event. */
  function noteChange(id: string, summary: string) {
    const row = db.select().from(character).where(eq(character.id, id)).get()!
    const handle = characterHandleOf(db, id)!
    logChange(db, { handle, version: row.version, summary }, { at: now(), offline: !attended() })
  }

  function detail(id: string) {
    const found = characters.get(id)
    if (!found) throw new CharacterNotFoundError('Character not found')
    return found
  }

  function maxHp(c: CharacterDetail): number {
    const { stats } = buildSummary(rules, { ...detailToSummaryData(c), equipment: c.inventory })
    return stats.hitPoints.status === 'ok' ? stats.hitPoints.value : c.currentHp
  }

  /** The level-up the DM awarded and the Character has not taken, or null. */
  function offerFor(c: CharacterDetail): LevelUpOffer | null {
    if (c.levelsAwarded <= 0 || c.level >= MAX_LEVEL) return null
    return levelUpOffer(
      rules,
      c.classSlug,
      c.level + 1,
      c.spells.map((s) => s.spell)
    )
  }

  /** The draft as the service's input; refused while any step is not valid. */
  function input(draft: CharacterDraft) {
    const mapped = tryDraftToCharacterInput(rules, draft)
    if (!mapped) throw new CharacterValidationError('Finish every step before saving')
    return mapped
  }

  const claimOf = (holder: string | null, browser: string): ClaimRow['claim'] =>
    holder === null ? 'free' : holder === browser ? 'yours' : 'taken'

  /** The Character or draft with this id, as the table to write its Claim to. */
  function claimable(id: string) {
    const saved = db.select().from(character).where(eq(character.id, id)).get()
    if (saved) return { table: character, holder: saved.controllingPlayer, name: saved.name }
    const draft = db.select().from(characterDraft).where(eq(characterDraft.id, id)).get()
    if (draft) {
      const name = (draft.data as CharacterDraft).name.trim()
      return { table: characterDraft, holder: draft.controllingPlayer, name }
    }
    throw new CharacterNotFoundError('Character not found')
  }

  /**
   * Refuses a write from a browser that does not hold the Claim, the Host included. Without a
   * `browser` the write is the DM's own (its tools), which no Claim gates.
   */
  function requireClaim(id: string, browser: string | undefined) {
    if (browser === undefined) return
    const target = claimable(id)
    if (target.holder !== browser) {
      throw new ClaimRefusedError(`${target.name || 'This Character'} is not yours: Claim it first`)
    }
  }

  return {
    /**
     * Every Party Character with its Claim as `browser` sees it: yours, taken (never by whom) or
     * free. Saved Characters oldest first.
     */
    claims(browser: string): ClaimRow[] {
      const saved = characters.list().map((c) => ({
        kind: 'character' as const,
        id: c.id,
        name: c.name,
        claim: claimOf(c.controllingPlayer, browser),
        ...(browser === SOLO_PLAYER && claimOf(c.controllingPlayer, browser) === 'taken'
          ? { releasable: true as const }
          : {})
      }))
      const drafts = db
        .select()
        .from(characterDraft)
        .orderBy(asc(characterDraft.createdAt), asc(sql`${characterDraft}.rowid`))
        .all()
        .map((d) => ({
          kind: 'draft' as const,
          id: d.id,
          name: (d.data as CharacterDraft).name.trim(),
          claim: claimOf(d.controllingPlayer, browser)
        }))
      return [...saved, ...drafts]
    },

    /** Whether `browser` holds a Claim on any Party Character. */
    holdsClaim(browser: string): boolean {
      return this.claims(browser).some((row) => row.kind === 'character' && row.claim === 'yours')
    },

    /** The browser Claims a Character nobody holds. A taken Character is refused for every browser. */
    claim(id: string, browser: string): void {
      const target = claimable(id)
      if (target.holder !== null) {
        throw new ClaimRefusedError(`${target.name} is taken`)
      }
      db.update(target.table)
        .set({ controllingPlayer: browser })
        .where(and(eq(target.table.id, id), isNull(target.table.controllingPlayer)))
        .run()
    },

    /** The browser gives up a Claim it holds. */
    letGo(id: string, browser: string): void {
      const target = claimable(id)
      if (target.holder !== browser) throw new ClaimRefusedError(`${target.name} is not yours`)
      db.update(target.table)
        .set({ controllingPlayer: null })
        .where(and(eq(target.table.id, id), eq(target.table.controllingPlayer, browser)))
        .run()
    },

    /** The Host frees a Character another browser holds. Refused for any other browser. */
    release(id: string, browser: string): void {
      if (browser !== SOLO_PLAYER)
        throw new ClaimRefusedError('Only the Host can Release a Character')
      const target = claimable(id)
      db.update(target.table).set({ controllingPlayer: null }).where(eq(target.table.id, id)).run()
    },

    /** Saved Characters oldest first, then drafts oldest first. */
    list(): PartyMember[] {
      const saved = characters.list().map((c): PartyMember => ({
        kind: 'character',
        id: c.id,
        name: c.name,
        status: c.status,
        description: `${c.subraceName ?? c.raceName} ${c.className}, ${c.backgroundName}`
      }))
      const drafts = db
        .select()
        .from(characterDraft)
        .orderBy(asc(characterDraft.createdAt), asc(sql`${characterDraft}.rowid`))
        .all()
        .map((d): PartyMember => ({
          kind: 'draft',
          id: d.id,
          name: (d.data as CharacterDraft).name.trim(),
          step: d.step,
          stepLabel: stepLabel(d.step)
        }))
      return [...saved, ...drafts]
    },

    /** Starts an empty draft on the first step, controlled by `player`. */
    startDraft({ player = SOLO_PLAYER }: { player?: string } = {}): StoredDraft {
      const owner = db.select({ id: campaign.id }).from(campaign).get()
      if (!owner) throw new Error('This database holds no Campaign')
      const at = now()
      const created = db
        .insert(characterDraft)
        .values({
          campaignId: owner.id,
          controllingPlayer: player,
          data: emptyDraft(),
          step: 'concept',
          createdAt: at,
          updatedAt: at
        })
        .returning()
        .get()
      return this.draft(created.id)
    },

    draft(id: string): StoredDraft {
      const found = row(id)
      return {
        id: found.id,
        controllingPlayer: found.controllingPlayer,
        // Stored drafts may predate fields added to the draft since.
        draft: { ...emptyDraft(), ...(found.data as CharacterDraft) },
        step: found.step,
        version: found.version,
        dmFields: found.dmFields
      }
    },

    /** Replaces the stored draft. Incomplete is fine: a draft is unsaved by definition. */
    writeDraft(id: string, value: DraftWrite, browser?: string): void {
      requireClaim(id, browser)
      write(id, value)
    },

    discardDraft(id: string, browser?: string): void {
      requireClaim(id, browser)
      const deleted = db.delete(characterDraft).where(eq(characterDraft.id, id)).returning().get()
      if (!deleted) throw new DraftNotFoundError('Character draft not found')
    },

    /**
     * Writes the draft, then saves it into the Party and removes it, in one transaction. Refused,
     * keeping the draft, unless every step is valid.
     */
    saveDraft(id: string, value: DraftWrite, browser?: string): Character {
      requireClaim(id, browser)
      return db.transaction(() => {
        write(id, value)
        const { controllingPlayer } = row(id)
        const created = characters.create(input(value.draft), { player: controllingPlayer })
        db.delete(characterDraft).where(eq(characterDraft.id, id)).run()
        noteChange(created.id, `the Player added ${created.name}`)
        return created
      })
    },

    /** A saved Character with its wizard draft, for the edit wizard. */
    character(id: string): { character: CharacterDetail; draft: CharacterDraft } {
      const found = characters.get(id)
      if (!found) throw new CharacterNotFoundError('Character not found')
      return { character: found, draft: detailToDraft(rules, found) }
    },

    /**
     * Replaces a saved Character's choices from the edit wizard's draft. It resets play state (HP,
     * slots, coin, inventory), so once the Campaign has begun it is refused: play state changes only
     * through the DM's tools.
     */
    updateCharacter(id: string, draft: CharacterDraft, browser?: string): Character {
      requireClaim(id, browser)
      if (begun()) {
        throw new DmOnlyEditError(
          'Rewriting a Character in the wizard resets their play state, so once the Campaign has begun only their notes, personality and appearance can be edited. Ask the DM at the table for anything else.'
        )
      }
      return db.transaction(() => {
        const updated = characters.update(id, input(draft))
        db.update(character)
          .set({ version: sql`${character.version} + 1` })
          .where(eq(character.id, id))
          .run()
        noteChange(id, `the Player edited ${updated.name}`)
        return updated
      })
    },

    /** The level-up waiting for the Player: what one more level asks them to pick, or null. */
    levelUpOffer(id: string): LevelUpOffer | null {
      return offerFor(detail(id))
    },

    /**
     * Takes one level the DM awarded (`award_level`): the level rises, HP rises with the new
     * maximum, and the picked cantrips and spells are learned. Play state is kept. Refused without
     * an awarded level, or when the picks do not fit the offer.
     */
    levelUp(
      id: string,
      picks: { cantrips?: string[]; spells?: string[] },
      browser?: string
    ): Character {
      requireClaim(id, browser)
      return db.transaction(() => {
        const before = detail(id)
        const offer = offerFor(before)
        if (!offer) {
          throw new CharacterValidationError('No level to take: the DM awards levels')
        }
        const issue = levelUpIssue(offer, picks)
        if (issue) throw new CharacterValidationError(issue)
        db.update(character)
          .set({
            level: offer.level,
            levelsAwarded: before.levelsAwarded - 1,
            version: sql`${character.version} + 1`,
            updatedAt: now()
          })
          .where(eq(character.id, id))
          .run()
        const learned = [...(picks.cantrips ?? []), ...(picks.spells ?? [])]
        if (learned.length > 0) {
          const ids = db
            .select({ id: spell.id })
            .from(spell)
            .where(inArray(spell.slug, learned))
            .all()
          db.insert(characterSpell)
            .values(ids.map((s) => ({ characterId: id, spellId: s.id, source: 'class' as const })))
            .run()
        }
        const after = detail(id)
        const gained = Math.max(0, maxHp(after) - maxHp(before))
        const updated = db
          .update(character)
          .set({ currentHp: before.currentHp > 0 ? before.currentHp + gained : 0 })
          .where(eq(character.id, id))
          .returning()
          .get()
        noteChange(id, `the Player levelled ${updated.name} up to level ${offer.level}`)
        return updated
      })
    },

    /**
     * Edits a Character's notes, personality, appearance or backstory, leaving play state alone.
     * Backstory after Begin is the DM's while the DM is away.
     */
    updateDetails(id: string, details: CharacterDetails, browser?: string): Character {
      requireClaim(id, browser)
      const fields = (Object.keys(DETAIL_LIMITS) as (keyof CharacterDetails)[]).filter(
        (f) => details[f] !== undefined
      )
      if (fields.includes('backstory')) dmOnly('Backstory')
      const values: CharacterDetails = {}
      for (const f of fields) {
        const value: unknown = details[f]
        if (value !== null && typeof value !== 'string') {
          throw new CharacterValidationError(`${f} must be text`)
        }
        const trimmed = value?.trim() || null
        if (trimmed && trimmed.length > DETAIL_LIMITS[f]) {
          throw new CharacterValidationError(`${f} must be at most ${DETAIL_LIMITS[f]} characters`)
        }
        values[f] = trimmed
      }
      if (fields.length === 0) throw new CharacterValidationError('Nothing to change')
      return db.transaction(() => {
        const updated = db
          .update(character)
          .set({ ...values, version: sql`${character.version} + 1`, updatedAt: now() })
          .where(eq(character.id, id))
          .returning()
          .get()
        if (!updated) throw new CharacterNotFoundError('Character not found')
        noteChange(id, `the Player edited ${updated.name}’s ${listed(fields)}`)
        return updated
      })
    }
  }
}

export type Party = ReturnType<typeof createParty>
