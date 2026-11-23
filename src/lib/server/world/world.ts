import { and, asc, desc, eq, isNotNull, isNull, like, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import type { EntityType } from '#lib/world/entity-types.ts'
import { entity, entityAlias, fact, pageRevision, worldLink } from '../db/schema'
import { ToolError, expectVersion, type ToolContext } from '../tools/contract'
import { fieldNames, parseFields, placeRefs, type Fields } from './fields'
import { resolveLinks, renderLinks, type Known } from './links'
import { isNearName, normalizeName, slug } from './names'

/**
 * Whether a Fact's claim restates a field's value: it mentions the value's words, or links to the
 * Entity a handle value names.
 */
function restates(rendered: string, stored: string, value: unknown, all: Known[]): boolean {
  const mentions = (v: unknown): boolean => {
    if (typeof v === 'string') {
      const linked = all.find((k) => k.handle === v)
      if (linked && stored.includes(`[[${v}]]`)) return true
      const word = (linked?.name ?? v).trim().toLowerCase()
      return word !== '' && rendered.toLowerCase().includes(word)
    }
    if (Array.isArray(v)) return v.some(mentions)
    if (v && typeof v === 'object') return Object.values(v).some(mentions)
    return false
  }
  return mentions(value)
}

type EntityRow = typeof entity.$inferSelect
type FactRow = typeof fact.$inferSelect

export type NewFact = { claim: string; valid_from?: number | null }

/** The World layer over one Campaign database: the DM-only truth (ADR 0007). */
export function createWorld({ db, stamp }: ToolContext) {
  const read = (handle: string) => `open ${handle}`

  function find(handle: string): EntityRow {
    const found = db.select().from(entity).where(eq(entity.handle, handle)).get()
    if (!found) throw ToolError.unknownHandle(handle)
    return found
  }

  /** An Entity a write may change: it exists, isn't retired, and the DM saw its version. */
  function writable(handle: string, version: number): EntityRow {
    const found = find(handle)
    expectVersion({ handle, version: found.version, read: read(handle) }, version)
    if (found.retiredAt !== null) {
      const where = found.mergedInto ? `; it was merged into ${found.mergedInto}` : ''
      throw new ToolError(
        'retired',
        `${handle} is retired (${found.retiredReason})${where}`,
        found.mergedInto ? `Use ${found.mergedInto} instead` : `Leave ${handle} as it is`
      )
    }
    return found
  }

  function bump(handle: string): number {
    const { version } = db
      .update(entity)
      .set({ version: sql`${entity.version} + 1` })
      .where(eq(entity.handle, handle))
      .returning({ version: entity.version })
      .get()
    return version
  }

  function known(): Known[] {
    const aliases = db.select().from(entityAlias).all()
    return db
      .select()
      .from(entity)
      .all()
      .map((e) => ({
        handle: e.handle,
        name: e.name,
        aliases: aliases.filter((a) => a.handle === e.handle).map((a) => a.alias),
        retired: e.retiredAt !== null,
        mergedInto: e.mergedInto
      }))
  }

  const aliasesOf = (handle: string) =>
    db
      .select()
      .from(entityAlias)
      .where(eq(entityAlias.handle, handle))
      .all()
      .map((a) => a.alias)

  function checkFields(tool: string, type: EntityType, fields: unknown): Fields {
    const parsed = parseFields(type, fields)
    if (!parsed.ok) throw ToolError.invalidInput(tool, parsed.message)
    for (const ref of placeRefs(parsed.fields)) {
      const place = db.select().from(entity).where(eq(entity.handle, ref)).get()
      if (!place || place.retiredAt !== null) {
        throw ToolError.invalidInput(tool, `${ref} is not an established Place`)
      }
    }
    return parsed.fields
  }

  function freeHandle(type: EntityType, name: string): string {
    const base = `${type}:${slug(name)}`
    const taken = new Set(
      db
        .select({ handle: entity.handle })
        .from(entity)
        .where(or(eq(entity.handle, base), like(entity.handle, `${base}-%`)))
        .all()
        .map((e) => e.handle)
    )
    let handle = base
    for (let n = 2; taken.has(handle); n++) handle = `${base}-${n}`
    return handle
  }

  function page(handle: string): string {
    return (
      db
        .select({ text: pageRevision.text })
        .from(pageRevision)
        .where(eq(pageRevision.handle, handle))
        .orderBy(desc(pageRevision.id))
        .get()?.text ?? ''
    )
  }

  /** Stores a new Page revision with its links resolved, and re-indexes the Page's links. */
  function writePage(handle: string, text: string) {
    const resolved = resolveLinks(text, known())
    db.insert(pageRevision)
      .values({
        handle,
        text: resolved.text,
        sessionId: stamp.sessionId,
        eventId: stamp.eventId,
        createdAt: Date.now()
      })
      .run()
    db.delete(worldLink)
      .where(and(eq(worldLink.fromHandle, handle), isNull(worldLink.factId)))
      .run()
    for (const to of resolved.links) {
      db.insert(worldLink).values({ fromHandle: handle, factId: null, toHandle: to }).run()
    }
    return resolved.unresolved
  }

  const isCurrent = (f: FactRow) => f.supersededBy === null && f.retiredAt === null

  function insertFact(subject: string, input: NewFact) {
    const resolved = resolveLinks(input.claim, known())
    const validFrom = input.valid_from === undefined ? stamp.minute : input.valid_from
    const row = db
      .insert(fact)
      .values({
        subject,
        claim: resolved.text,
        validFrom,
        sessionId: stamp.sessionId,
        eventId: stamp.eventId,
        recordedMinute: stamp.minute
      })
      .returning()
      .get()
    for (const to of resolved.links) {
      db.insert(worldLink).values({ fromHandle: subject, factId: row.id, toHandle: to }).run()
    }
    return { row, unresolved: resolved.unresolved }
  }

  function factView(f: FactRow, all: Known[]) {
    return {
      id: f.id,
      claim: renderLinks(f.claim, all),
      valid_from: f.validFrom,
      valid_to: f.supersededBy === null ? null : f.validTo,
      state: f.retiredAt !== null ? 'retired' : f.supersededBy !== null ? 'superseded' : 'current',
      ...(f.supersededBy !== null && { superseded_by: f.supersededBy }),
      ...(f.retiredAt !== null && { retired_reason: f.retiredReason })
    }
  }

  function findFact(id: number): FactRow {
    const found = db.select().from(fact).where(eq(fact.id, id)).get()
    if (!found) {
      throw new ToolError(
        'unknown_fact',
        `No Fact has the id ${id}`,
        'Check the id against a recent open'
      )
    }
    return found
  }

  /** A Fact that a supersession or retirement may still change. */
  function currentFact(id: number): FactRow {
    const found = findFact(id)
    if (!isCurrent(found)) {
      const state =
        found.retiredAt !== null ? 'retired' : `superseded by Fact ${found.supersededBy}`
      throw new ToolError(
        'not_current',
        `Fact ${id} is already ${state}`,
        `Open ${found.subject} with history to see its Facts`
      )
    }
    return found
  }

  /**
   * Closes `old` at the start of `by`. A Fact never begins before the one it supersedes; one that
   * held since before the Campaign may only be superseded by another such Fact or a later one.
   */
  function close(tool: string, old: FactRow, by: { id: number; validFrom: number | null }) {
    if (old.id === by.id) throw ToolError.invalidInput(tool, 'A Fact cannot supersede itself')
    if (old.validFrom !== null && (by.validFrom === null || by.validFrom < old.validFrom)) {
      throw ToolError.invalidInput(
        tool,
        `Fact ${old.id} holds from minute ${old.validFrom}; what supersedes it cannot begin earlier`
      )
    }
    db.update(fact)
      .set({ supersededBy: by.id, validTo: by.validFrom })
      .where(eq(fact.id, old.id))
      .run()
  }

  /** Retires current Facts with one reason, returning them as the DM saw them. */
  function retireFacts(facts: FactRow[], reason: string) {
    const all = known()
    for (const f of facts) {
      db.update(fact)
        .set({ retiredAt: stamp.minute, retiredReason: reason })
        .where(eq(fact.id, f.id))
        .run()
    }
    return facts.map((f) => ({ id: f.id, claim: renderLinks(f.claim, all) }))
  }

  /** Entities whose Page or current Facts link to `handle`. */
  function linkersOf(handle: string): string[] {
    const rows = db.select().from(worldLink).where(eq(worldLink.toHandle, handle)).all()
    return [...new Set(rows.map((l) => l.fromHandle))].filter((h) => h !== handle)
  }

  /** Rebuilds an Entity's full-text rows: name and aliases, Page, current Facts. */
  function reindex(handle: string) {
    db.run(sql`DELETE FROM world_search WHERE handle = ${handle}`)
    const found = find(handle)
    if (found.retiredAt !== null) return
    const all = known()
    const rows: [string, string][] = [
      ['name', [found.name, ...aliasesOf(handle)].join(' · ')],
      ['page', renderLinks(page(handle), all)],
      ...db
        .select()
        .from(fact)
        .where(eq(fact.subject, handle))
        .all()
        .filter(isCurrent)
        .map((f): [string, string] => [`fact:${f.id}`, renderLinks(f.claim, all)])
    ]
    for (const [source, text] of rows) {
      if (text.trim()) {
        db.run(
          sql`INSERT INTO world_search (handle, source, text) VALUES (${handle}, ${source}, ${text})`
        )
      }
    }
  }

  return {
    /** Entities whose name or aliases are close to any of `names`, retired ones aside. */
    nearMatches(names: string[]) {
      return known()
        .filter((k) => !k.retired)
        .filter((k) => [k.name, ...k.aliases].some((n) => names.some((m) => isNearName(n, m))))
        .map((k) => ({ handle: k.handle, name: k.name }))
    },

    establish(input: {
      type: EntityType
      name: string
      aliases: string[]
      fields: unknown
      page?: string
      facts: NewFact[]
      distinct_from: string[]
    }) {
      for (const handle of input.distinct_from) find(handle)
      const matches = this.nearMatches([input.name, ...input.aliases]).filter(
        (m) => !input.distinct_from.includes(m.handle)
      )
      if (matches.length) {
        throw new ToolError(
          'near_duplicate',
          `"${input.name}" is close to ${matches.map((m) => `${m.handle} (${m.name})`).join(', ')}`,
          `Open the match if it is the same Entity; if not, call establish again with distinct_from: ${JSON.stringify(matches.map((m) => m.handle))}`,
          { matches }
        )
      }
      const fields = checkFields('establish', input.type, input.fields)
      const handle = freeHandle(input.type, input.name)
      db.insert(entity)
        .values({ handle, type: input.type, name: input.name, fields, createdAt: Date.now() })
        .run()
      for (const alias of new Set(input.aliases)) {
        db.insert(entityAlias).values({ handle, alias }).run()
      }
      const unresolved = input.page ? writePage(handle, input.page) : []
      const facts = input.facts.map((f) => {
        const made = insertFact(handle, f)
        unresolved.push(...made.unresolved)
        return made.row.id
      })
      reindex(handle)
      return { handle, version: 1, facts, unresolved }
    },

    open(handle: string, history: boolean) {
      const found = find(handle)
      const all = known()
      const facts = db
        .select()
        .from(fact)
        .where(eq(fact.subject, handle))
        .orderBy(asc(fact.id))
        .all()
        .filter((f) => history || isCurrent(f))
      const currentFactIds = new Set(
        db
          .select()
          .from(fact)
          .all()
          .filter(isCurrent)
          .map((f) => f.id)
      )
      const live = (l: typeof worldLink.$inferSelect) =>
        l.factId === null || currentFactIds.has(l.factId)
      const via = (l: typeof worldLink.$inferSelect) => (l.factId === null ? 'page' : l.factId)
      const nameOf = (h: string) => all.find((k) => k.handle === h)?.name ?? h
      const links = db
        .select()
        .from(worldLink)
        .where(eq(worldLink.fromHandle, handle))
        .all()
        .filter(live)
        .map((l) => ({ handle: l.toHandle, name: nameOf(l.toHandle), via: via(l) }))
      const backlinks = db
        .select()
        .from(worldLink)
        .where(eq(worldLink.toHandle, handle))
        .all()
        .filter((l) => live(l) && l.fromHandle !== handle)
        .map((l) => ({ handle: l.fromHandle, name: nameOf(l.fromHandle), via: via(l) }))
      const revisions = history
        ? db
            .select()
            .from(pageRevision)
            .where(eq(pageRevision.handle, handle))
            .orderBy(asc(pageRevision.id))
            .all()
            .map((r) => ({
              revision: r.id,
              text: renderLinks(r.text, all),
              session: r.sessionId,
              event: r.eventId
            }))
        : undefined
      return {
        handle,
        type: found.type,
        name: found.name,
        aliases: aliasesOf(handle),
        version: found.version,
        retired:
          found.retiredAt === null
            ? null
            : { reason: found.retiredReason, merged_into: found.mergedInto },
        fields: found.fields,
        page: renderLinks(page(handle), all),
        facts: facts.map((f) => factView(f, all)),
        links,
        backlinks,
        // Beliefs arrive with the Knowledge layer; until then nothing is believed about anything.
        beliefs: 0,
        ...(revisions && { revisions })
      }
    },

    editPage(
      handle: string,
      version: number,
      change: { text: string } | { patches: { old: string; new: string }[] }
    ) {
      writable(handle, version)
      const all = known()
      const current = renderLinks(page(handle), all)
      let text: string
      if ('text' in change) {
        if (current.trim()) {
          throw new ToolError(
            'page_not_empty',
            `${handle} already has a Page; full text only goes into an empty one`,
            `Call edit_page with patches of old/new text from open ${handle}`
          )
        }
        text = change.text
      } else {
        text = change.patches.reduce((t, p) => {
          const count = t.split(p.old).length - 1
          if (count !== 1) {
            throw new ToolError(
              'patch_mismatch',
              `"${p.old}" appears ${count} times in the Page of ${handle}; it must appear exactly once`,
              `Open ${handle} and quote a longer, unique stretch of its Page`
            )
          }
          return t.replace(p.old, () => p.new)
        }, current)
      }
      const unresolved = writePage(handle, text)
      const next = bump(handle)
      reindex(handle)
      return { handle, version: next, unresolved }
    },

    setField(handle: string, version: number, field: string, value: unknown) {
      const found = writable(handle, version)
      let old: unknown
      if (field === 'name') {
        const parsed = z.string().trim().min(1).safeParse(value)
        if (!parsed.success) throw ToolError.invalidInput('set_field', 'A name must be text')
        old = found.name
        db.update(entity).set({ name: parsed.data }).where(eq(entity.handle, handle)).run()
        value = parsed.data
      } else {
        if (!fieldNames(found.type).includes(field)) {
          throw ToolError.invalidInput(
            'set_field',
            `A ${found.type} has no field ${field}; its fields are name, ${fieldNames(found.type).join(', ')}`
          )
        }
        old = found.fields[field] ?? null
        const next = { ...found.fields }
        if (value === null) delete next[field]
        else next[field] = value
        const fields = checkFields('set_field', found.type, next)
        value = fields[field] ?? null
        db.update(entity).set({ fields }).where(eq(entity.handle, handle)).run()
      }
      const next = bump(handle)
      reindex(handle)
      if (field === 'name') for (const from of linkersOf(handle)) reindex(from)
      const all = known()
      const restating = db
        .select()
        .from(fact)
        .where(eq(fact.subject, handle))
        .all()
        .filter(isCurrent)
        .filter((f) => restates(renderLinks(f.claim, all), f.claim, value, all))
      const warnings = restating.map(
        (f) =>
          `Fact ${f.id} ("${renderLinks(f.claim, all)}") restates ${field}; the field owns it now, so supersede or retire the Fact`
      )
      return { handle, field, old, new: value, version: next, warnings }
    },

    addFact(input: {
      subject: string
      version: number
      claim: string
      valid_from?: number | null
      supersedes: number[]
    }) {
      writable(input.subject, input.version)
      const olds = [...new Set(input.supersedes)].map(currentFact)
      const made = insertFact(input.subject, input)
      for (const old of olds) close('add_fact', old, made.row)
      const version = bump(input.subject)
      const others = [...new Set(olds.map((o) => o.subject))].filter((h) => h !== input.subject)
      for (const other of others) bump(other)
      for (const h of [input.subject, ...others]) reindex(h)
      return {
        fact: made.row.id,
        subject: input.subject,
        version,
        valid_from: made.row.validFrom,
        superseded: olds.map((o) => o.id),
        unresolved: made.unresolved
      }
    },

    supersede(oldId: number, byId: number) {
      const old = currentFact(oldId)
      const by = currentFact(byId)
      close('supersede', old, by)
      const version = bump(old.subject)
      reindex(old.subject)
      return { old: old.id, by: by.id, valid_to: by.validFrom, subject: old.subject, version }
    },

    retireFact(id: number, version: number, reason: string) {
      const found = currentFact(id)
      writable(found.subject, version)
      const facts = retireFacts([found], reason)
      const next = bump(found.subject)
      reindex(found.subject)
      return { handle: found.subject, version: next, retired_facts: facts }
    },

    retireEntity(handle: string, version: number, reason: string) {
      writable(handle, version)
      const current = db.select().from(fact).where(eq(fact.subject, handle)).all().filter(isCurrent)
      const facts = retireFacts(current, reason)
      db.update(entity)
        .set({ retiredAt: stamp.minute, retiredReason: reason })
        .where(eq(entity.handle, handle))
        .run()
      const next = bump(handle)
      reindex(handle)
      return { handle, version: next, retired_facts: facts }
    },

    merge(from: string, into: string, versions: { from: number; into: number }) {
      if (from === into) throw ToolError.invalidInput('merge', 'An Entity cannot merge into itself')
      writable(from, versions.from)
      const survivor = writable(into, versions.into)
      const before = known()
      const fromPage = renderLinks(page(from), before)
      const intoPage = renderLinks(page(into), before)

      const facts = db
        .update(fact)
        .set({ subject: into })
        .where(eq(fact.subject, from))
        .returning({ id: fact.id })
        .all()
      db.update(worldLink)
        .set({ fromHandle: into })
        .where(and(eq(worldLink.fromHandle, from), isNotNull(worldLink.factId)))
        .run()
      const links = db
        .update(worldLink)
        .set({ toHandle: into })
        .where(eq(worldLink.toHandle, from))
        .returning({ id: worldLink.id })
        .all()

      const taken = new Set([survivor.name, ...aliasesOf(into)].map(normalizeName))
      const aliases = [db.select().from(entity).where(eq(entity.handle, from)).get()!.name]
        .concat(aliasesOf(from))
        .filter((a) => !taken.has(normalizeName(a)) && taken.add(normalizeName(a)))
      db.delete(entityAlias).where(eq(entityAlias.handle, from)).run()
      for (const alias of aliases) db.insert(entityAlias).values({ handle: into, alias }).run()

      db.update(entity)
        .set({ retiredAt: stamp.minute, retiredReason: `Merged into ${into}`, mergedInto: into })
        .where(eq(entity.handle, from))
        .run()
      const unresolved = fromPage.trim()
        ? writePage(into, intoPage.trim() ? `${intoPage}\n\n${fromPage}` : fromPage)
        : []
      db.delete(worldLink)
        .where(and(eq(worldLink.fromHandle, from), isNull(worldLink.factId)))
        .run()

      bump(from)
      const version = bump(into)
      for (const h of new Set([from, into, ...linkersOf(into)])) reindex(h)
      return {
        from,
        into,
        version,
        moved: { facts: facts.map((f) => f.id), aliases, links: links.length },
        unresolved
      }
    },

    search(query: string, type?: EntityType) {
      const words = query.match(/[\p{L}\p{N}]+/gu) ?? []
      if (!words.length) return []
      const match = words.map((w) => `"${w}"*`).join(' OR ')
      const rows = db.all<{ handle: string; snippet: string }>(sql`
        SELECT world_search.handle AS handle,
          snippet(world_search, 2, '«', '»', '…', 12) AS snippet
        FROM world_search JOIN ${entity} ON ${entity.handle} = world_search.handle
        WHERE world_search MATCH ${match} AND ${entity.retiredAt} IS NULL
          ${type ? sql`AND ${entity.type} = ${type}` : sql``}
        ORDER BY bm25(world_search)
        LIMIT 100`)
      const seen = new Map<
        string,
        { handle: string; type: string; name: string; snippet: string }
      >()
      const all = db.select().from(entity).all()
      for (const r of rows) {
        if (seen.has(r.handle) || seen.size >= 10) continue
        const e = all.find((x) => x.handle === r.handle)!
        seen.set(r.handle, { handle: r.handle, type: e.type, name: e.name, snippet: r.snippet })
      }
      return [...seen.values()]
    }
  }
}

export type World = ReturnType<typeof createWorld>
