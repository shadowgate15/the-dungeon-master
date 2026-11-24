import { formatClock } from '#lib/play/clock.ts'
import type { Party } from '../character/party'
import type { Queryable } from '../db/connect'
import { slug } from '../world/names'
import { hpState } from '#lib/play/hp-state.ts'
import { initiativeOrder, liveCombat, waitingOnInitiative } from './combat'
import { characterRefs, currentMinute, present } from './scene'
import { playSheets } from './sheets'

/**
 * The core block: the ~300 tokens the DM needs to be oriented, injected whole at SessionStart and
 * after compaction. No Page text and no Facts. One function per part, so each part can be re-sent
 * whole when it changes; later tickets add the clock and open Call, the Arc line and Combat.
 */
export type CoreBlockSource = { party: Party; db: Queryable }

/** A Character's handle, from its name. */
export const characterHandle = (name: string) => `char:${slug(name)}`

/** The Scene: its Place (handle and name) and the in-fiction time. */
export function scenePart({ db }: CoreBlockSource): string {
  const place = present(db).place
  const time = formatClock(currentMinute(db))
  return place
    ? `Scene: ${place.name} (${place.handle}), ${time}.`
    : `Scene: none set yet, ${time}.`
}

/** The Party: name, handle, HP/max, conditions, status and whereabouts per Character. */
export function partyPart({ party, db }: CoreBlockSource): string {
  const status = new Map(
    party.list().flatMap((m) => (m.kind === 'character' ? [[m.id, m.status] as const] : []))
  )
  const handles = new Map(characterRefs(db).map((c) => [c.row.id, c.handle]))
  const sheets = playSheets(party)
  if (sheets.length === 0) return 'Party: no Characters yet.'
  const lines = sheets.map((c) => {
    const hp = `HP ${c.hp.current}/${c.hp.max ?? '?'}${c.hp.temp ? ` (+${c.hp.temp} temp)` : ''}`
    const conditions = c.conditions.length ? c.conditions.join(', ') : 'none'
    return `- ${c.name} (${handles.get(c.id) ?? characterHandle(c.name)}): ${hp}, conditions ${conditions}, ${status.get(c.id)}, whereabouts ${c.whereabouts ?? 'unknown'}`
  })
  return ['Party:', ...lines].join('\n')
}

/** The NPCs at the Scene's Place: handle, name, role and one-line description. */
export function npcsPart({ db }: CoreBlockSource): string {
  const npcs = present(db).npcs
  if (npcs.length === 0) return 'NPCs present: none.'
  const lines = npcs.map((n) => {
    const detail = [n.fields.role, n.fields.description].filter(Boolean).join(', ')
    return `- ${n.name} (${n.handle})${detail ? `: ${detail}` : ''}`
  })
  return ['NPCs present:', ...lines].join('\n')
}

/**
 * The live Combat, or null outside one: the round and whose turn, then the order (initiative,
 * name, handle), with each Creature's stat block, HP state and conditions. This lifts the block
 * from ~300 to ~500 tokens while it lasts.
 */
export function combatPart({ db }: CoreBlockSource): string | null {
  const live = liveCombat(db)
  if (!live) return null
  const order = initiativeOrder(db, live.id)
  const current = order.find((c) => c.id === live.current)
  const head = current
    ? `Combat: round ${live.round}, turn: ${current.name} (${current.handle}).`
    : 'Combat: waiting on initiative.'
  const lines = order.map((c) => {
    const creature =
      c.kind === 'creature'
        ? `: ${c.statBlock}, ${hpState(c.hp!, c.maxHp!)}, conditions ${c.conditions.join(', ') || 'none'}`
        : ''
    return `- ${c.initiative} ${c.name} (${c.handle})${creature}${c.id === live.current ? ' ← turn' : ''}`
  })
  const waiting = waitingOnInitiative(db, live.id)
  if (waiting.length) {
    lines.push(
      `- waiting on initiative: ${waiting.map((c) => `${c.name} (${c.handle})`).join(', ')}`
    )
  }
  return [head, ...lines].join('\n')
}

/** When lint last ran. */
export function lintPart(): string {
  return 'Lint last ran: never.'
}

/** The whole core block. */
export function coreBlock(source: CoreBlockSource): string {
  return [
    '# Core block',
    scenePart(source),
    partyPart(source),
    npcsPart(source),
    combatPart(source),
    lintPart()
  ]
    .filter((part) => part !== null)
    .join('\n')
}
