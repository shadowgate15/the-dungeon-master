import { formatClock } from '#lib/play/clock.ts'
import type { Party } from '../character/party'
import type { Queryable } from '../db/connect'
import { eq } from 'drizzle-orm'
import { npcCombat, session } from '../db/schema'
import { currentArc, driftCount } from '../story/arc'
import { lastLint } from '../world/lint'
import { hpState } from '#lib/play/hp-state.ts'
import { initiativeOrder, liveCombat, waitingOnInitiative } from './combat'
import { characterRefs, currentMinute, present } from './scene'
import { playSheets } from './sheets'

/**
 * The core block: the ~300 tokens the DM needs to be oriented, injected whole at SessionStart and
 * after compaction. No Page text and no Facts. One function per part, so each part can be re-sent
 * whole when it changes; later tickets add the clock and open Call and Combat.
 */
export type CoreBlockSource = { party: Party; db: Queryable }

/** The Scene: its Place (handle and name) and the in-fiction time. */
export function scenePart({ db }: CoreBlockSource): string {
  const place = present(db).place
  const time = formatClock(currentMinute(db))
  return place
    ? `Scene: ${place.name} (${place.handle}), ${time}.`
    : `Scene: none set yet, ${time}.`
}

const plural = (n: number, word: string, many: string) => `${n} ${n === 1 ? word : many}`

/** A downed Character's Death saves: `stable`, or `Death saves 1 success, 2 failures`. */
function deathSavesText(saves: { successes: number; failures: number; stable: boolean }) {
  if (saves.stable) return 'stable'
  return `Death saves ${plural(saves.successes, 'success', 'successes')}, ${plural(saves.failures, 'failure', 'failures')}`
}

/**
 * The Party: name, handle, HP/max, conditions, status and whereabouts per Character, then what
 * they concentrate on and, at 0 HP, their Death saves.
 */
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
    const extra = [
      c.concentration && `concentrating on ${c.concentration}`,
      c.deathSaves && deathSavesText(c.deathSaves)
    ].filter(Boolean)
    return [
      `- ${c.name} (${handles.get(c.id)}): ${hp}, conditions ${conditions}, ${status.get(c.id)}, whereabouts ${c.whereabouts ?? 'unknown'}`,
      ...extra
    ].join(', ')
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
 * name, handle), with each Creature's stat block, HP state and conditions, and what each NPC or
 * Creature concentrates on. This lifts the block
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
  const npcConcentration = new Map(
    db
      .select({ handle: npcCombat.handle, concentration: npcCombat.concentration })
      .from(npcCombat)
      .all()
      .map((n) => [n.handle, n.concentration])
  )
  const lines = order.map((c) => {
    const spell = c.kind === 'npc' ? npcConcentration.get(c.handle) : c.concentration
    const detail = [
      ...(c.kind === 'creature'
        ? [c.statBlock, hpState(c.hp!, c.maxHp!), `conditions ${c.conditions.join(', ') || 'none'}`]
        : []),
      ...(c.kind !== 'character' && spell ? [`concentrating on ${spell}`] : [])
    ]
    const shown = detail.length ? `: ${detail.join(', ')}` : ''
    return `- ${c.initiative} ${c.name} (${c.handle})${shown}${c.id === live.current ? ' ← turn' : ''}`
  })
  const waiting = waitingOnInitiative(db, live.id)
  if (waiting.length) {
    lines.push(
      `- waiting on initiative: ${waiting.map((c) => `${c.name} (${c.handle})`).join(', ')}`
    )
  }
  return [head, ...lines].join('\n')
}

/**
 * The Arc line: the current Act (the Act of the first pending Beat) with its purpose, that Act's
 * pending Beats by handle and title, the next Act's name, and the drift count. No descriptions.
 */
export function arcPart({ db }: CoreBlockSource): string {
  const drift = `Declarations since the last Beat change: ${driftCount(db)}.`
  const found = currentArc(db)
  const at = found?.acts.findIndex((a) => a.beats.some((b) => b.state === 'pending')) ?? -1
  if (!found || at === -1) return `Arc: No current Arc. ${drift}`
  const current = found.acts[at]
  const pending = current.beats
    .filter((b) => b.state === 'pending')
    .map((b) => `${b.handle} (${b.title})`)
  const next = found.acts[at + 1]
  return [
    `Arc: Act ${current.number}, ${current.name}: ${current.purpose}`,
    `- Pending: ${pending.join('; ')}`,
    `- Next Act: ${next ? next.name : 'none, this is the final Act'}`,
    `- ${drift}`
  ].join('\n')
}

/** When lint last ran: the Session (if any) and in-fiction time of its last `lint_ran` Event. */
export function lintPart({ db }: CoreBlockSource): string {
  const last = lastLint(db)
  if (!last) return 'Lint last ran: never.'
  const number = last.sessionId
    ? db
        .select({ number: session.number })
        .from(session)
        .where(eq(session.id, last.sessionId))
        .get()?.number
    : undefined
  return `Lint last ran: ${number ? `Session ${number}, ` : ''}${formatClock(last.minute)}.`
}

/** The whole core block. */
export function coreBlock(source: CoreBlockSource): string {
  return [
    '# Core block',
    scenePart(source),
    partyPart(source),
    npcsPart(source),
    combatPart(source),
    arcPart(source),
    lintPart(source)
  ]
    .filter((part) => part !== null)
    .join('\n')
}
