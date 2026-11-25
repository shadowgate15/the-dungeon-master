import { and, asc, desc, eq, gt, isNull } from 'drizzle-orm'
import { belief, entity, event, fact, pageRevision } from '../db/schema'
import { characterHolders } from '../knowledge/holders'
import type { ToolContext } from '../tools/contract'
import { linkTargets, renderLinks } from './links'
import { isNearName } from './names'
import { createWorld, restates } from './world'

type Named = { handle: string; name: string }

/** One problem lint found in the World. Lint only reports; the DM fixes through ordinary tools. */
export type LintFinding =
  | { kind: 'near_duplicate'; entities: Named[] }
  /** A `[[link]]` that names no Entity; `in` is `page` or the Fact's id. */
  | { kind: 'broken_link'; handle: string; in: 'page' | number; link: string }
  /** A current Fact restating a typed field, which owns that value alone (ADR 0007). */
  | { kind: 'restated_field'; handle: string; fact: number; claim: string; field: string }
  /** A current Belief on a retired Fact: re-point it with reveal, or retire it. */
  | {
      kind: 'retired_fact_belief'
      belief: number
      holder: string
      fact: number
      reason: string | null
    }
  /** A Page linking to an Entity that is retired (not merged: merged links follow the survivor). */
  | { kind: 'retired_link'; handle: string; retired: Named & { reason: string | null } }

/** Where an Entity's links live: its Page and its current Facts. */
type Text = { handle: string; in: 'page' | number; text: string }

const pairKey = (a: string, b: string) => [a, b].sort().join(' ')

/** Every pair of handles the DM declared distinct with establish's distinct_from. */
function distinctPairs(ctx: ToolContext): Set<string> {
  const pairs = new Set<string>()
  const rows = ctx.db.select().from(event).where(eq(event.kind, 'entity_established')).all()
  for (const row of rows) {
    const from = row.data?.handle
    const others = row.data?.distinct_from
    if (typeof from !== 'string' || !Array.isArray(others)) continue
    for (const other of others) pairs.add(pairKey(from, String(other)))
  }
  return pairs
}

/**
 * Checks the World for what code can detect (ADR 0007): near-duplicate names, broken links, Facts
 * restating a field, Beliefs on retired Facts and Pages linking to retired Entities. Reads only.
 */
export function lintWorld(ctx: ToolContext) {
  const world = createWorld(ctx)
  const live = world
    .known()
    .filter((k) => !k.retired)
    .sort((a, b) => a.handle.localeCompare(b.handle))
  const findings: LintFinding[] = []

  const distinct = distinctPairs(ctx)
  for (const [i, a] of live.entries()) {
    for (const b of live.slice(i + 1)) {
      if (distinct.has(pairKey(a.handle, b.handle))) continue
      const near = [a.name, ...a.aliases].some((x) =>
        [b.name, ...b.aliases].some((y) => isNearName(x, y))
      )
      if (near) {
        findings.push({
          kind: 'near_duplicate',
          entities: [a, b].map((e) => ({ handle: e.handle, name: e.name }))
        })
      }
    }
  }
  const known = new Map(world.known().map((k) => [k.handle, k]))
  const reasons = new Map(
    ctx.db
      .select({ handle: entity.handle, reason: entity.retiredReason })
      .from(entity)
      .all()
      .map((e) => [e.handle, e.reason])
  )
  const all = [...known.values()]
  const fields = new Map(
    ctx.db
      .select({ handle: entity.handle, fields: entity.fields })
      .from(entity)
      .all()
      .map((e) => [e.handle, e.fields])
  )
  for (const t of texts(ctx, live)) {
    if (t.in === 'page') continue
    const rendered = renderLinks(t.text, all)
    for (const [field, value] of Object.entries(fields.get(t.handle) ?? {})) {
      if (restates(rendered, t.text, value, all)) {
        findings.push({
          kind: 'restated_field',
          handle: t.handle,
          fact: t.in,
          claim: rendered,
          field
        })
      }
    }
  }

  for (const t of texts(ctx, live)) {
    const retired = new Set<string>()
    for (const link of linkTargets(t.text)) {
      let found = known.get(link)
      if (!found) {
        findings.push({ kind: 'broken_link', handle: t.handle, in: t.in, link })
        continue
      }
      for (let hops = 0; found.mergedInto && hops < 10; hops++) {
        found = known.get(found.mergedInto) ?? found
      }
      if (t.in === 'page' && found.retired && !retired.has(found.handle)) {
        retired.add(found.handle)
        findings.push({
          kind: 'retired_link',
          handle: t.handle,
          retired: {
            handle: found.handle,
            name: found.name,
            reason: reasons.get(found.handle) ?? null
          }
        })
      }
    }
  }
  findings.push(...retiredFactBeliefs(ctx))
  return { findings, pages: changedPages(ctx, live, all) }
}

/** The Event keys that name the Entities a World write touched. */
const TOUCHED = ['handle', 'subject', 'from', 'into'] as const

/** The last `lint_ran` Event, or undefined if lint never ran. */
export function lastLint(db: ToolContext['db']) {
  return db.select().from(event).where(eq(event.kind, 'lint_ran')).orderBy(desc(event.id)).get()
}

/**
 * The Pages of live Entities changed since the last lint (every Page before the first), beside
 * their fields, so the DM can judge where a Page contradicts a field.
 */
function changedPages(
  ctx: ToolContext,
  live: Named[],
  all: ReturnType<ReturnType<typeof createWorld>['known']>
) {
  const { db } = ctx
  const since = lastLint(db)?.id ?? 0
  const touched = new Set(
    db
      .select({ data: event.data })
      .from(event)
      .where(gt(event.id, since))
      .all()
      .flatMap((e) => TOUCHED.map((k) => e.data?.[k]))
      .filter((h): h is string => typeof h === 'string')
  )
  return live
    .filter((e) => touched.has(e.handle))
    .flatMap((e) => {
      const row = db.select().from(entity).where(eq(entity.handle, e.handle)).get()!
      const page = pageText(ctx, e.handle)
      if (!page?.trim()) return []
      return [
        {
          handle: row.handle,
          type: row.type,
          name: row.name,
          version: row.version,
          fields: row.fields,
          page: renderLinks(page, all)
        }
      ]
    })
}

function pageText({ db }: ToolContext, handle: string): string | undefined {
  return db
    .select({ text: pageRevision.text })
    .from(pageRevision)
    .where(eq(pageRevision.handle, handle))
    .orderBy(desc(pageRevision.id))
    .get()?.text
}

function retiredFactBeliefs({ db }: ToolContext): LintFinding[] {
  const characters = new Map(characterHolders(db).map((c) => [c.id, c.handle]))
  return db
    .select({ belief, fact })
    .from(belief)
    .innerJoin(fact, eq(fact.id, belief.factId))
    .where(and(eq(belief.kind, 'fact'), isNull(belief.replacedBy), isNull(belief.retiredAt)))
    .orderBy(asc(belief.id))
    .all()
    .filter((r) => r.fact.retiredAt !== null)
    .map((r) => ({
      kind: 'retired_fact_belief' as const,
      belief: r.belief.id,
      holder: r.belief.holderNpc ?? characters.get(r.belief.holderCharacter!) ?? '?',
      fact: r.fact.id,
      reason: r.fact.retiredReason
    }))
}

/** The current Page and current Facts of each live Entity, as stored. */
function texts({ db }: ToolContext, live: Named[]): Text[] {
  return live.flatMap((e): Text[] => {
    const page = pageText({ db } as ToolContext, e.handle)
    const facts = db
      .select()
      .from(fact)
      .where(eq(fact.subject, e.handle))
      .orderBy(asc(fact.id))
      .all()
      .filter((f) => f.supersededBy === null && f.retiredAt === null)
    return [
      ...(page ? [{ handle: e.handle, in: 'page' as const, text: page }] : []),
      ...facts.map((f) => ({ handle: e.handle, in: f.id, text: f.claim }))
    ]
  })
}
