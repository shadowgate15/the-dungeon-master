import { ENTITY_TYPES } from '#lib/world/entity-types.ts'
import { isNearName, normalizeName } from './names'

/** `[[Name]]`, `[[alias]]` or `[[npc:handle]]`; text after a `|` is a label and ignored. */
const LINK = /\[\[([^[\]]+?)\]\]/g
const HANDLE = new RegExp(`^(${ENTITY_TYPES.join('|')}):[a-z0-9-]+$`)

/** What link resolution needs to know about one Entity. */
export type Known = {
  handle: string
  name: string
  aliases: string[]
  retired: boolean
  mergedInto: string | null
}

export type Unresolved = { link: string; near: { handle: string; name: string }[] }

const target = (inner: string) => inner.split('|')[0].trim()

/** The Entity a merged handle now lives in. */
function follow(handle: string, known: Map<string, Known>): Known | undefined {
  let found = known.get(handle)
  for (let hops = 0; found?.mergedInto && hops < 10; hops++) found = known.get(found.mergedInto)
  return found
}

function byName(name: string, known: Known[]): Known[] {
  const wanted = normalizeName(name)
  return known.filter(
    (k) => !k.retired && [k.name, ...k.aliases].some((n) => normalizeName(n) === wanted)
  )
}

/**
 * Rewrites `[[Name]]` links to `[[handle]]` so renames never break them. A link that names no
 * Entity, or several, stays as written and is reported with near-matches. Nothing is stubbed.
 */
export function resolveLinks(text: string, all: Known[]) {
  const known = new Map(all.map((k) => [k.handle, k]))
  const links = new Set<string>()
  const unresolved: Unresolved[] = []
  const resolved = text.replace(LINK, (whole, inner: string) => {
    const name = target(inner)
    if (HANDLE.test(name) && known.has(name)) {
      links.add(follow(name, known)?.handle ?? name)
      return `[[${name}]]`
    }
    const found = byName(name, all)
    if (found.length === 1) {
      links.add(found[0].handle)
      return `[[${found[0].handle}]]`
    }
    const near = found.length
      ? found
      : all.filter((k) => !k.retired && [k.name, ...k.aliases].some((n) => isNearName(n, name)))
    if (!unresolved.some((u) => u.link === name)) {
      unresolved.push({ link: name, near: near.map((k) => ({ handle: k.handle, name: k.name })) })
    }
    return whole
  })
  return { text: resolved, links: [...links], unresolved }
}

/** Every `[[link]]` target in a text, as written (a handle once stored, or an unresolved name). */
export function linkTargets(text: string): string[] {
  return [...text.matchAll(LINK)].map((m) => target(m[1]))
}

/** The handles a stored text links to, following merges. */
export function linkedHandles(text: string, all: Known[]): string[] {
  return resolveLinks(text, all).links
}

/**
 * Shows stored `[[handle]]` links by the Entity's current name (following merges), or by handle
 * when that name would not lead back to it.
 */
export function renderLinks(text: string, all: Known[]): string {
  const known = new Map(all.map((k) => [k.handle, k]))
  return text.replace(LINK, (whole, inner: string) => {
    const handle = target(inner)
    if (!HANDLE.test(handle)) return whole
    const found = follow(handle, known)
    if (!found) return whole
    const named = byName(found.name, all)
    return named.length === 1 && named[0].handle === found.handle
      ? `[[${found.name}]]`
      : `[[${found.handle}]]`
  })
}
