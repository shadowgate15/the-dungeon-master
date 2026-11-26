/* eslint-disable -- PROTOTYPE, throwaway */
// PROTOTYPE (wipe me): in-memory "server" for the multiplayer play console prototype (#376).
// Every browser in the "Viewing as" bar reads and writes this one object, so a Claim, a Release
// or a Done made as one browser is visible as soon as you switch to another. Nothing persists.
import { sheets as fixtureSheets } from '#lib/play/play-fixtures.ts'
import type { PlaySheet } from '#lib/play/sheet.ts'

export type BrowserId = 'player' | 'phone' | 'tablet' | 'new'

export const browsers: { id: BrowserId; key: string; label: string; host: boolean }[] = [
  { id: 'player', key: 'host', label: "Host's laptop (localhost)", host: true },
  { id: 'phone', key: 'phone', label: 'Phone on the LAN', host: false },
  { id: 'tablet', key: 'tablet', label: 'Tablet on the LAN', host: false },
  { id: 'new', key: 'new', label: 'A new browser on the LAN', host: false }
]

const [wren, bram, osric] = fixtureSheets
export const party: PlaySheet[] = [
  wren,
  { ...bram, whereabouts: null },
  { ...bram, id: 'kael', name: 'Kael', headline: 'Half-Elf Bard 1', whereabouts: null },
  osric,
  { ...bram, id: 'tamsin', name: 'Tamsin', headline: 'Tiefling Warlock 1', whereabouts: null }
]
export const nameOf = (id: string) => party.find((c) => c.id === id)?.name ?? id

export type Entry =
  | { type: 'narration'; id: string; text: string; voice: string | null; audience: string[] }
  | { type: 'declaration'; id: string; character: string; text: string; audience: string[] }
  | { type: 'activity'; id: string; text: string; audience: string[] }

type Pending = { id: string; character: string; player: BrowserId; text: string }

const everyone = ['wren', 'bram', 'kael', 'osric', 'tamsin']
let seq = 100

export const table = $state({
  /** controllingPlayer per Character: a browser id, or null for unclaimed. */
  claims: {
    wren: 'player',
    bram: 'phone',
    kael: 'phone',
    osric: 'tablet',
    tamsin: null
  } as Record<string, BrowserId | null>,
  /** Characters in the Scene (all of them here; nobody is split off). */
  inScene: ['wren', 'bram', 'kael', 'osric', 'tamsin'],
  /** Browsers that have pressed Done on the open Floor. */
  done: ['tablet'] as BrowserId[],
  declarations: [
    { id: 'd1', character: 'bram', player: 'phone', text: 'I bar the door with the bench.' },
    { id: 'd2', character: 'wren', player: 'player', text: 'I keep my bow on the stairs.' }
  ] as Pending[],
  entries: [
    {
      type: 'narration',
      id: 'n1',
      voice: null,
      audience: everyone,
      text: 'Rain hammers the shutters of the Gilded Stag. The common room empties as the bell tolls midnight.'
    },
    {
      type: 'declaration',
      id: 'x1',
      character: 'osric',
      audience: everyone,
      text: 'I read the letter aloud.'
    },
    {
      type: 'narration',
      id: 'n2',
      voice: 'Mira Voss',
      audience: everyone,
      text: '"Harrowmere chapel. Two hundred gold for what lies under it," she says, and leaves.'
    },
    {
      type: 'narration',
      id: 'n3',
      voice: null,
      audience: ['wren'],
      text: 'Only you notice: the wax seal is still warm. Whoever sealed it is close.'
    },
    {
      type: 'narration',
      id: 'n4',
      voice: null,
      audience: ['bram', 'kael'],
      text: 'Bram and Kael hear boots on the stair, slow and deliberate.'
    },
    { type: 'activity', id: 'a1', audience: everyone, text: 'DM checks their notes' }
  ] as Entry[],
  /** Floors closed in this prototype, so you can see a close happen. */
  closed: 0
})

export const isHost = (b: BrowserId) => b === 'player'
export const claimedBy = (b: BrowserId) =>
  Object.keys(table.claims).filter((c) => table.claims[c] === b)
/** Browsers with a Claimed Character in the Scene: the ones the Floor waits on. */
export const floorBrowsers = () => [
  ...new Set(table.inScene.map((c) => table.claims[c]).filter((b): b is BrowserId => b !== null))
]
/** A browser as other Players know it: by its Characters in the Scene. */
export const browserName = (b: BrowserId) =>
  claimedBy(b)
    .filter((c) => table.inScene.includes(c))
    .map(nameOf)
    .join(' & ')
export const visibleTo = (b: BrowserId) => {
  const mine = claimedBy(b)
  return table.entries.filter((e) => e.audience.some((c) => mine.includes(c)))
}
/** The audience as a reader sees it: "everyone in the Scene" or the names. */
export const audienceLabel = (e: Entry) =>
  e.audience.length >= table.inScene.length ? null : e.audience.map(nameOf).join(', ')

export function claim(b: BrowserId, c: string) {
  if (table.claims[c] !== null) return
  table.claims[c] = b
}

function drop(c: string) {
  const owner = table.claims[c]
  table.claims[c] = null
  table.declarations = table.declarations.filter((d) => d.character !== c)
  if (owner && claimedBy(owner).length === 0) table.done = table.done.filter((d) => d !== owner)
  maybeClose()
}
export const letGo = (b: BrowserId, c: string) => table.claims[c] === b && drop(c)
export const release = (c: string) => drop(c)

export function send(b: BrowserId, c: string, text: string) {
  if (!text.trim() || table.claims[c] !== b) return
  table.declarations.push({ id: `d${seq++}`, character: c, player: b, text })
}
export const withdraw = (id: string) =>
  (table.declarations = table.declarations.filter((d) => d.id !== id))
export function done(b: BrowserId) {
  if (!table.done.includes(b)) table.done.push(b)
  maybeClose()
}
export const undone = (b: BrowserId) => (table.done = table.done.filter((d) => d !== b))

function maybeClose() {
  const waiting = floorBrowsers()
  if (waiting.length === 0 || !waiting.every((b) => table.done.includes(b))) return
  const audience = table.inScene.filter((c) => table.claims[c] !== null)
  for (const d of table.declarations)
    table.entries.push({
      type: 'declaration',
      id: `x${seq++}`,
      character: d.character,
      text: d.text,
      audience
    })
  table.entries.push({
    type: 'narration',
    id: `n${seq++}`,
    voice: null,
    audience,
    text: `(Floor ${++table.closed} closed: the DM narrates what happens next.)`
  })
  table.declarations = []
  table.done = []
}

/** The sheets a browser can act with: its own Claimed Characters in the Scene. */
export const ownSheets = (b: BrowserId) => party.filter((s) => table.claims[s.id] === b)
