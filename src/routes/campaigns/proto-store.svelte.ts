// PROTOTYPE (issue #74): throwaway in-memory stub. Wipe me.
export const TONES = ['heroic', 'lighthearted', 'tense', 'dark', 'mysterious', 'epic']
export const LENGTHS = ['one-shot', 'short', 'medium', 'long']

export type ProtoWorld = { id: string; name: string; genre: string; archived: boolean }
export type ProtoCampaign = {
  id: string
  name: string
  premise: string
  tone: string
  length: string
  worldIds: string[]
  archived: boolean
  updated: string
}

export const worlds: ProtoWorld[] = [
  { id: 'w1', name: 'Eldermoor', genre: 'high fantasy', archived: false },
  { id: 'w2', name: 'The Ashen Reach', genre: 'dark fantasy', archived: false },
  { id: 'w3', name: 'Brinewatch', genre: 'seafaring', archived: false },
  { id: 'w4', name: 'Skyhold Isles', genre: 'high fantasy', archived: false },
  { id: 'w5', name: 'Old Karrow', genre: 'low fantasy', archived: true }
]

export const store = $state({
  campaigns: [
    { id: 'c1', name: 'The Crown of Thorns', premise: 'A deposed heir hires the party to retake a haunted keep before winter closes the passes.', tone: 'dark', length: 'long', worldIds: ['w1', 'w2'], archived: false, updated: '2026-10-28' },
    { id: 'c2', name: 'Salt and Lantern', premise: 'Smugglers, a drowned lighthouse and a harbor that forgets its own dead.', tone: 'mysterious', length: 'medium', worldIds: ['w3'], archived: false, updated: '2026-10-20' },
    { id: 'c3', name: 'Goblin Market Heist', premise: 'One night, one vault, one very unreliable fence.', tone: 'lighthearted', length: 'one-shot', worldIds: ['w1'], archived: false, updated: '2026-10-11' },
    { id: 'c4', name: 'Ghosts of Karrow', premise: 'The old capital stirs again. Someone is ringing the bells.', tone: 'tense', length: 'short', worldIds: ['w5', 'w1'], archived: false, updated: '2026-09-30' },
    { id: 'c5', name: 'Storm Over Skyhold', premise: 'A dragon-riders academy faces a rebellion from within.', tone: 'epic', length: 'long', worldIds: ['w4'], archived: true, updated: '2026-08-02' }
  ] as ProtoCampaign[]
})

export const world = (id: string) => worlds.find((w) => w.id === id)!
export const activeWorlds = () => worlds.filter((w) => !w.archived)
/** Derived, never stored: the archived Worlds that make a Campaign read-only. */
export const blockers = (c: ProtoCampaign) => c.worldIds.map(world).filter((w) => w.archived)
export const campaignCount = (worldId: string) =>
  store.campaigns.filter((c) => c.worldIds.includes(worldId)).length
