// PROTOTYPE: throwaway. In-memory stand-in for the World service so variants can
// archive / restore / delete / edit without touching the database.
import type { World } from '#lib/server/world/service.ts'

export type ProtoWorld = World & { campaigns: number }

const DAY = 86_400_000
const t = (daysAgo: number) => Date.now() - daysAgo * DAY

// Used only when the dev database has no Worlds, so the layouts are judged with density.
const SAMPLE: Omit<ProtoWorld, 'campaigns'>[] = [
  [
    'Ashfall Reach',
    'A volcanic frontier where ash-choked baronies war over the last fertile valleys.',
    'dark fantasy',
    'single region',
    'low',
    'medieval',
    1,
    null
  ],
  [
    'The Gilded Spire',
    'A city-state stacked on a single tower, where each floor is its own kingdom and altitude is rank.',
    'high fantasy',
    'single region',
    'high',
    'renaissance',
    3,
    null
  ],
  [
    'Saltmarrow',
    'Drowned coastlines, smuggler lords and a tide that keeps something old buried.',
    'gothic horror',
    'single region',
    'moderate',
    'medieval',
    6,
    null
  ],
  [
    'Kharn Dominion',
    'An empire of iron roads and steam-bound legions pressing on the last free tribes.',
    'sword and sorcery',
    'continent',
    'low',
    'industrial',
    9,
    null
  ],
  [
    'Lantern Verge',
    'The sky is a ceiling of dead gods; travelers navigate by their lingering light.',
    'mythic',
    'planar',
    'ubiquitous',
    'ancient',
    14,
    null
  ],
  [
    'Cinder Cradle',
    'After the long winter, vaults reopen and the old machines still obey.',
    'post-apocalyptic',
    'multiple continents',
    'none',
    'futuristic',
    20,
    null
  ],
  ['Old Hollow', 'A prototype world that was never finished.', null, null, null, null, 40, t(12)]
].map(([name, premise, genreFlavor, scale, magicLevel, techLevel, age, archivedAt], i) => ({
  id: `sample-${i}`,
  name,
  premise,
  genreFlavor,
  scale,
  magicLevel,
  techLevel,
  createdAt: t((age as number) + 30),
  updatedAt: t(age as number),
  archivedAt
})) as Omit<ProtoWorld, 'campaigns'>[]

// Fake "used by N Campaigns" so the delete-refused path is reachable: 0, 1 or 2.
const campaignsFor = (id: string) => [...id].reduce((n, c) => n + c.charCodeAt(0), 0) % 3

export type Toast = { message: string; undo?: () => void }

export function createProtoStore(active: World[], archived: World[]) {
  const seeded = active.length + archived.length === 0
  const initial = seeded ? (SAMPLE as World[]) : [...active, ...archived]
  let worlds = $state<ProtoWorld[]>(initial.map((w) => ({ ...w, campaigns: campaignsFor(w.id) })))
  let toast = $state<Toast | null>(null)
  let timer: ReturnType<typeof setTimeout> | undefined

  function say(message: string, undo?: () => void) {
    clearTimeout(timer)
    toast = { message, undo }
    timer = setTimeout(() => (toast = null), 6000)
  }
  const find = (id: string) => worlds.find((w) => w.id === id)

  function archive(ids: string[]) {
    const hit = ids.map(find).filter((w): w is ProtoWorld => !!w && w.archivedAt === null)
    for (const w of hit) w.archivedAt = Date.now()
    say(hit.length === 1 ? `Archived ${hit[0].name}` : `Archived ${hit.length} Worlds`, () =>
      restore(
        hit.map((w) => w.id),
        true
      )
    )
  }
  function restore(ids: string[], quiet = false) {
    const hit = ids.map(find).filter((w): w is ProtoWorld => !!w && w.archivedAt !== null)
    for (const w of hit) w.archivedAt = null
    if (quiet) toast = null
    else
      say(hit.length === 1 ? `Restored ${hit[0].name}` : `Restored ${hit.length} Worlds`, () =>
        archive(hit.map((w) => w.id))
      )
  }
  /** Mirrors the real service: refused (false) while a Campaign uses the World. */
  function remove(id: string): boolean {
    const w = find(id)
    if (!w || w.campaigns > 0) return false
    worlds = worlds.filter((x) => x.id !== id)
    say(`Deleted ${w.name}`)
    return true
  }
  function update(id: string, values: Partial<ProtoWorld>) {
    const w = find(id)
    if (w) Object.assign(w, values, { updatedAt: Date.now() })
    say('Saved')
  }

  return {
    seeded,
    get worlds() {
      return worlds
    },
    get active() {
      return worlds.filter((w) => w.archivedAt === null)
    },
    get archived() {
      return worlds.filter((w) => w.archivedAt !== null)
    },
    get toast() {
      return toast
    },
    dismissToast: () => (toast = null),
    archive,
    restore,
    remove,
    update
  }
}

export const ago = (ms: number) => {
  const days = Math.max(0, Math.round((Date.now() - ms) / DAY))
  return days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days}d ago`
}
