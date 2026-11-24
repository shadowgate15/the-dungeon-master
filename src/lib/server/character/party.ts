import { asc, eq, sql } from 'drizzle-orm'
import { emptyDraft, type CharacterDraft } from '#lib/character/draft.ts'
import { detailToDraft } from '#lib/character/edit.ts'
import { SOLO_PLAYER, type CharacterStatus } from '#lib/character/enums.ts'
import { tryDraftToCharacterInput } from '#lib/character/save.ts'
import { STEPS, type StepId } from '#lib/character/steps.ts'
import type { Database } from '../db/connect'
import { campaign, character, characterDraft } from '../db/schema'
import { characterHandle } from '../play/core-block'
import { logChange } from '../play/notices'
import {
  CharacterNotFoundError,
  CharacterValidationError,
  createCharacterService,
  type Character,
  type CharacterDetail
} from './service'
import { loadWizardRules } from './wizard-rules'

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
  controllingPlayer: string
  draft: CharacterDraft
  step: StepId
}

/** What the wizard writes back: the whole draft and the step it is on. */
export type DraftWrite = { draft: CharacterDraft; step: StepId }

const stepLabel = (step: StepId) => STEPS.find((s) => s.id === step)?.label ?? step

/**
 * A Campaign's Characters and Character drafts, over its database. Drafts are stored with the
 * Campaign so a reload loses nothing (and the DM's tools can write into them later); a draft joins
 * the Party only when it is saved, which needs every wizard step to be valid.
 */
export function createParty(db: Database, now: () => number = Date.now) {
  const rules = loadWizardRules()
  const characters = createCharacterService(db, now)

  function row(id: string) {
    const found = db.select().from(characterDraft).where(eq(characterDraft.id, id)).get()
    if (!found) throw new DraftNotFoundError('Character draft not found')
    return found
  }

  function write(id: string, { draft, step }: DraftWrite) {
    row(id)
    db.update(characterDraft)
      .set({ data: draft, step, updatedAt: now() })
      .where(eq(characterDraft.id, id))
      .run()
  }

  /** Logs a Player edit to a Character, so the DM hears of it on the next channel event. */
  function noteChange(id: string, summary: string) {
    const row = db.select().from(character).where(eq(character.id, id)).get()!
    const handle = characterHandle(row.name)
    logChange(db, { handle, version: row.version, summary }, { at: now() })
  }

  /** The draft as the service's input; refused while any step is not valid. */
  function input(draft: CharacterDraft) {
    const mapped = tryDraftToCharacterInput(rules, draft)
    if (!mapped) throw new CharacterValidationError('Finish every step before saving')
    return mapped
  }

  return {
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
        step: found.step
      }
    },

    /** Replaces the stored draft. Incomplete is fine: a draft is unsaved by definition. */
    writeDraft(id: string, value: DraftWrite): void {
      write(id, value)
    },

    discardDraft(id: string): void {
      const deleted = db.delete(characterDraft).where(eq(characterDraft.id, id)).returning().get()
      if (!deleted) throw new DraftNotFoundError('Character draft not found')
    },

    /**
     * Writes the draft, then saves it into the Party and removes it, in one transaction. Refused,
     * keeping the draft, unless every step is valid.
     */
    saveDraft(id: string, value: DraftWrite): Character {
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

    /** Replaces a saved Character's choices from the edit wizard's draft. */
    updateCharacter(id: string, draft: CharacterDraft): Character {
      return db.transaction(() => {
        const updated = characters.update(id, input(draft))
        db.update(character)
          .set({ version: sql`${character.version} + 1` })
          .where(eq(character.id, id))
          .run()
        noteChange(id, `the Player edited ${updated.name}`)
        return updated
      })
    }
  }
}

export type Party = ReturnType<typeof createParty>
