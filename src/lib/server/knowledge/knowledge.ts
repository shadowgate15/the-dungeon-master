import { handleKind } from '#lib/world/entity-types.ts'
import { and, asc, eq, inArray, isNull, or } from 'drizzle-orm'
import { isDeepStrictEqual } from 'node:util'
import { belief, entity, fact } from '../db/schema'
import { ToolError, type ToolContext } from '../tools/contract'
import { fieldNames } from '../world/fields'
import { renderLinks, resolveLinks, type Known } from '../world/links'
import { createWorld } from '../world/world'
import { characterHolders, type CharacterHolder } from './holders'
import { present } from '../play/scene'

type BeliefRow = typeof belief.$inferSelect
type FactRow = typeof fact.$inferSelect

/** What a Reveal teaches: a Fact, an Entity's existence or field (`of`), or a claim about an Entity. */
export type RevealTarget = { of: number | string } | { claim: string; about: string }

export type RevealInput = RevealTarget & {
  holders?: string[]
  source?: string
  replaces?: number[]
}

/** A Holder resolved from its handle: a Character (by id) or an NPC (by handle). */
type Holder = { handle: string; character: string | null; npc: string | null }

/** A target resolved against the live World, ready to become a Belief. */
type Target = {
  kind: BeliefRow['kind']
  factId: number | null
  about: string
  aboutName: string
  field: string | null
  value: unknown
  claim: string | null
  text: string
  /** Fact ids on the same supersession chain, whose Beliefs a new one replaces. */
  chain: number[]
}

const isCurrentBelief = (b: BeliefRow) => b.replacedBy === null && b.retiredAt === null
const isCurrentFact = (f: FactRow) => f.supersededBy === null && f.retiredAt === null

/** A field value in words: handles shown by name, lists joined, objects by their name. */
function formatValue(value: unknown, all: Known[]): string {
  if (value === null || value === undefined) return 'none'
  if (typeof value === 'string') return all.find((k) => k.handle === value)?.name ?? value
  if (Array.isArray(value)) return value.map((v) => formatValue(v, all)).join(', ') || 'none'
  if (typeof value === 'object') {
    const named = value as { name?: unknown }
    return typeof named.name === 'string' ? named.name : JSON.stringify(value)
  }
  return String(value)
}

/** The Knowledge layer over one Campaign database: who believes what (ADR 0007). */
export function createKnowledge(ctx: ToolContext) {
  const { db, stamp } = ctx
  const world = createWorld(ctx)

  function findEntity(handle: string) {
    const found = db.select().from(entity).where(eq(entity.handle, handle)).get()
    if (!found) throw ToolError.unknownHandle(handle)
    return found
  }

  function liveEntity(handle: string, tool: string) {
    const found = findEntity(handle)
    if (found.retiredAt !== null) {
      const instead = found.mergedInto ? `; use ${found.mergedInto}` : ''
      throw ToolError.invalidInput(tool, `${handle} is retired${instead}`)
    }
    return found
  }

  function findFact(id: number): FactRow {
    const found = db.select().from(fact).where(eq(fact.id, id)).get()
    if (!found) {
      throw new ToolError('unknown_fact', `No Fact has the id ${id}`, 'Check the id against open')
    }
    return found
  }

  /** Every Fact connected to `id` through supersession, both ways. */
  function chainOf(id: number): number[] {
    const all = db.select().from(fact).all()
    const seen = new Set([id])
    for (let grew = true; grew;) {
      grew = false
      for (const f of all) {
        const linked = seen.has(f.id) || (f.supersededBy !== null && seen.has(f.supersededBy))
        if (!linked) continue
        for (const n of [f.id, f.supersededBy]) {
          if (n !== null && !seen.has(n)) {
            seen.add(n)
            grew = true
          }
        }
      }
    }
    return [...seen]
  }

  /** The Facts that now stand where `id` stood: the current ends of its supersession chain. */
  function currentSuccessors(id: number): FactRow[] {
    const chain = new Set(chainOf(id))
    return db
      .select()
      .from(fact)
      .all()
      .filter((f) => chain.has(f.id) && isCurrentFact(f) && f.id !== id)
  }

  function fieldValue(row: typeof entity.$inferSelect, field: string): unknown {
    return field === 'name' ? row.name : (row.fields[field] ?? null)
  }

  function target(input: RevealTarget, tool: string): Target {
    const all = world.known()
    if ('claim' in input) {
      const about = liveEntity(input.about, tool)
      const resolved = resolveLinks(input.claim, all)
      return {
        kind: 'claim',
        factId: null,
        about: about.handle,
        aboutName: about.name,
        field: null,
        value: null,
        claim: resolved.text,
        text: renderLinks(resolved.text, all),
        chain: []
      }
    }
    const { of } = input
    if (typeof of === 'number') {
      const found = findFact(of)
      if (found.retiredAt !== null) {
        throw ToolError.invalidInput(tool, `Fact ${of} is retired (${found.retiredReason})`)
      }
      const subject = findEntity(found.subject)
      return {
        kind: 'fact',
        factId: found.id,
        about: subject.handle,
        aboutName: subject.name,
        field: null,
        value: null,
        claim: null,
        text: renderLinks(found.claim, all),
        chain: chainOf(found.id)
      }
    }
    const dot = of.lastIndexOf('.')
    const handle = dot === -1 ? of : of.slice(0, dot)
    const found = liveEntity(handle, tool)
    if (dot === -1) {
      return {
        kind: 'entity',
        factId: null,
        about: found.handle,
        aboutName: found.name,
        field: null,
        value: null,
        claim: null,
        text: found.name,
        chain: []
      }
    }
    const field = of.slice(dot + 1)
    if (field !== 'name' && !fieldNames(found.type).includes(field)) {
      throw ToolError.invalidInput(
        tool,
        `A ${found.type} has no field ${field}; its fields are name, ${fieldNames(found.type).join(', ')}`
      )
    }
    const value = fieldValue(found, field)
    return {
      kind: 'field',
      factId: null,
      about: found.handle,
      aboutName: found.name,
      field,
      value,
      claim: null,
      text: `${found.name}'s ${field.replaceAll('_', ' ')}: ${formatValue(value, all)}`,
      chain: []
    }
  }

  function holderFor(handle: string, characters: CharacterHolder[], tool: string): Holder {
    if (handleKind(handle) === 'char') {
      const found = characters.find((c) => c.handle === handle)
      if (!found) throw ToolError.unknownHandle(handle)
      return { handle, character: found.id, npc: null }
    }
    const found = findEntity(handle)
    if (found.type !== 'npc') {
      throw ToolError.invalidInput(
        tool,
        `${handle} is a ${found.type}; only Characters and NPCs hold Beliefs`
      )
    }
    return { handle, character: null, npc: found.handle }
  }

  const heldBy = (h: Holder) =>
    h.character !== null
      ? eq(belief.holderCharacter, h.character)
      : eq(belief.holderNpc, h.npc as string)

  function currentBeliefsOf(h: Holder): BeliefRow[] {
    return db
      .select()
      .from(belief)
      .where(and(heldBy(h), isNull(belief.replacedBy), isNull(belief.retiredAt)))
      .orderBy(asc(belief.id))
      .all()
  }

  /** Whether a held Belief already says what `t` says. */
  function matches(b: BeliefRow, t: Target): boolean {
    if (b.kind !== t.kind || b.about !== t.about) return false
    switch (t.kind) {
      case 'fact':
        return b.factId === t.factId
      case 'entity':
        return true
      case 'field':
        return b.field === t.field && isDeepStrictEqual(b.value ?? null, t.value ?? null)
      case 'claim':
        return b.claim === t.claim
    }
  }

  /** Whether a held Belief is about the same thing as `t`, so a new one replaces it. */
  function sameTarget(b: BeliefRow, t: Target): boolean {
    if (t.kind === 'fact') return b.kind === 'fact' && t.chain.includes(b.factId ?? -1)
    if (t.kind === 'field') return b.kind === 'field' && b.about === t.about && b.field === t.field
    return false
  }

  function holderHandleOf(b: BeliefRow, characters: CharacterHolder[]): string {
    if (b.holderNpc !== null) return b.holderNpc
    return characters.find((c) => c.id === b.holderCharacter)?.handle ?? 'char:unknown'
  }

  function view(b: BeliefRow, characters: CharacterHolder[], all: Known[]) {
    const truth = truthOf(b, all)
    return {
      id: b.id,
      holder: holderHandleOf(b, characters),
      kind: b.kind,
      about: b.about,
      ...(b.field !== null && { field: b.field }),
      claim: b.text,
      source: b.source,
      learned: { session: b.sessionId, minute: b.learnedMinute },
      outdated: truth !== null,
      ...(truth !== null && { truth }),
      ...(b.replacedBy !== null && { replaced_by: b.replacedBy }),
      ...(b.retiredAt !== null && { retired_reason: b.retiredReason })
    }
  }

  /** The current truth beside an outdated Belief, or null when the Belief still matches the World. */
  function truthOf(b: BeliefRow, all: Known[]): string | null {
    if (b.kind === 'fact' && b.factId !== null) {
      const found = db.select().from(fact).where(eq(fact.id, b.factId)).get()
      if (!found || isCurrentFact(found)) return null
      if (found.retiredAt !== null) return `Fact ${found.id} was retired: ${found.retiredReason}`
      const now = currentSuccessors(found.id)
      return now.length
        ? now.map((f) => renderLinks(f.claim, all)).join('; ')
        : `Fact ${found.id} no longer holds`
    }
    if (b.kind === 'field' && b.about !== null && b.field !== null) {
      const found = db.select().from(entity).where(eq(entity.handle, b.about)).get()
      if (!found) return null
      const current = fieldValue(found, b.field)
      if (isDeepStrictEqual(current ?? null, b.value ?? null)) return null
      return `${found.name}'s ${b.field.replaceAll('_', ' ')}: ${formatValue(current, all)}`
    }
    return null
  }

  return {
    /**
     * Makes Holders learn something. Holders default to the Characters in the Scene. A Holder who
     * already believes it is skipped; a new Belief replaces the Holder's older one on the same
     * Fact chain or field, and any named in `replaces`.
     */
    reveal(input: RevealInput, tool = 'reveal') {
      const t = target(input, tool)
      const characters = characterHolders(db)
      const handles = input.holders?.length
        ? [...new Set(input.holders)]
        : present(db).characters.map((c) => c.handle)
      if (!handles.length) {
        throw new ToolError(
          'no_holders',
          'No Characters are in the Scene to learn this',
          'Name the holders explicitly'
        )
      }
      const holders = handles.map((h) => holderFor(h, characters, tool))

      const named = [...new Set(input.replaces ?? [])].map((id) => {
        const found = db.select().from(belief).where(eq(belief.id, id)).get()
        if (!found) {
          throw new ToolError(
            'unknown_belief',
            `No Belief has the id ${id}`,
            'Check the id against beliefs_of'
          )
        }
        if (!isCurrentBelief(found)) {
          throw ToolError.invalidInput(tool, `Belief ${id} is already replaced or retired`)
        }
        const owner = holderHandleOf(found, characters)
        if (!handles.includes(owner)) {
          throw ToolError.invalidInput(
            tool,
            `Belief ${id} is held by ${owner}, who is not among the holders`
          )
        }
        return { ...found, owner }
      })

      const beliefs: { id: number; holder: string; claim: string; replaced: number[] }[] = []
      const skipped: { holder: string; belief: number }[] = []
      for (const h of holders) {
        const held = currentBeliefsOf(h)
        const already = held.find((b) => matches(b, t))
        if (already) {
          skipped.push({ holder: h.handle, belief: already.id })
          continue
        }
        const row = db
          .insert(belief)
          .values({
            holderCharacter: h.character,
            holderNpc: h.npc,
            kind: t.kind,
            factId: t.factId,
            about: t.about,
            field: t.field,
            value: t.kind === 'field' ? (t.value ?? null) : null,
            claim: t.claim,
            text: t.text,
            aboutName: t.aboutName,
            source: input.source ?? null,
            sessionId: stamp.sessionId,
            eventId: stamp.eventId,
            learnedMinute: stamp.minute
          })
          .returning()
          .get()
        const replaced = [
          ...held.filter((b) => sameTarget(b, t)).map((b) => b.id),
          ...named.filter((b) => b.owner === h.handle).map((b) => b.id)
        ]
        const unique = [...new Set(replaced)]
        if (unique.length) {
          db.update(belief).set({ replacedBy: row.id }).where(inArray(belief.id, unique)).run()
        }
        beliefs.push({ id: row.id, holder: h.handle, claim: t.text, replaced: unique })
      }
      return { beliefs, skipped }
    },

    /** A Holder's current Beliefs (every one with `history`), with outdatedness and the truth. */
    beliefsOf(holder: string, about?: string, history = false) {
      const characters = characterHolders(db)
      const h = holderFor(holder, characters, 'beliefs_of')
      if (about !== undefined) findEntity(about)
      const all = world.known()
      const rows = db
        .select()
        .from(belief)
        .where(heldBy(h))
        .orderBy(asc(belief.id))
        .all()
        .filter((b) => history || isCurrentBelief(b))
        .filter((b) => about === undefined || b.about === about)
      return { holder, beliefs: rows.map((b) => view(b, characters, all)) }
    },

    /** How many current Beliefs are about an Entity. */
    countAbout(handle: string): number {
      return db.select().from(belief).where(eq(belief.about, handle)).all().filter(isCurrentBelief)
        .length
    },

    /** Retires every current Belief about an Entity (or held by it), returning their ids. */
    retireAbout(handle: string, reason: string): number[] {
      const rows = db
        .select()
        .from(belief)
        .where(or(eq(belief.about, handle), eq(belief.holderNpc, handle)))
        .all()
        .filter(isCurrentBelief)
      if (rows.length) {
        db.update(belief)
          .set({ retiredAt: stamp.minute, retiredReason: reason })
          .where(
            inArray(
              belief.id,
              rows.map((b) => b.id)
            )
          )
          .run()
      }
      return rows.map((b) => b.id)
    },

    /** Moves Beliefs about, and held by, `from` onto `into`; returns how many moved. */
    move(from: string, into: string): number {
      const about = db
        .update(belief)
        .set({ about: into })
        .where(eq(belief.about, from))
        .returning({ id: belief.id })
        .all()
      const held = db
        .update(belief)
        .set({ holderNpc: into })
        .where(eq(belief.holderNpc, from))
        .returning({ id: belief.id })
        .all()
      return new Set([...about, ...held].map((b) => b.id)).size
    }
  }
}

export type Knowledge = ReturnType<typeof createKnowledge>
