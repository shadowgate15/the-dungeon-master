import type { Party } from '../character/party'
import { slug } from '../world/names'
import { playSheets } from './sheets'

/**
 * The core block: the ~300 tokens the DM needs to be oriented, injected whole at SessionStart and
 * after compaction. No Page text and no Facts. One function per part, so each part can be re-sent
 * whole when it changes; later tickets add the clock and open Call, the Arc line and Combat.
 */
export type CoreBlockSource = { party: Party }

/** A Character's handle, from its name. */
export const characterHandle = (name: string) => `char:${slug(name)}`

/** The Scene: its Place and the in-fiction time. No Scene exists until the clock and Scene do. */
export function scenePart(): string {
  return 'Scene: none set yet.'
}

/** The Party: name, handle, HP/max, conditions, status and whereabouts per Character. */
export function partyPart({ party }: CoreBlockSource): string {
  const status = new Map(
    party.list().flatMap((m) => (m.kind === 'character' ? [[m.id, m.status] as const] : []))
  )
  const sheets = playSheets(party)
  if (sheets.length === 0) return 'Party: no Characters yet.'
  const lines = sheets.map((c) => {
    const hp = `HP ${c.hp.current}/${c.hp.max ?? '?'}${c.hp.temp ? ` (+${c.hp.temp} temp)` : ''}`
    const conditions = c.conditions.length ? c.conditions.join(', ') : 'none'
    return `- ${c.name} (${characterHandle(c.name)}): ${hp}, conditions ${conditions}, ${status.get(c.id)}, whereabouts ${c.whereabouts ?? 'unknown'}`
  })
  return ['Party:', ...lines].join('\n')
}

/** The NPCs at the Scene's Place. Presence needs a Scene, so none are present yet. */
export function npcsPart(): string {
  return 'NPCs present: none.'
}

/** When lint last ran. */
export function lintPart(): string {
  return 'Lint last ran: never.'
}

/** The whole core block. */
export function coreBlock(source: CoreBlockSource): string {
  return ['# Core block', scenePart(), partyPart(source), npcsPart(), lintPart()].join('\n')
}
