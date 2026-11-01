// PROTOTYPE (wipe me): stubbed seed shape and fake AI for the World creation flow question.
export const OPTIONS = {
  genre: ['high fantasy', 'dark fantasy', 'sword and sorcery', 'mythic', 'gothic horror', 'science fantasy', 'science fiction', 'post-apocalyptic'],
  scale: ['single region', 'continent', 'multiple continents', 'planar'],
  magic: ['none', 'low', 'moderate', 'high', 'ubiquitous'],
  tech: ['stone age', 'ancient', 'medieval', 'renaissance', 'industrial', 'modern', 'futuristic']
} as const

export type Seed = { name: string; premise: string; genre: string; scale: string; magic: string; tech: string }
export type Field = keyof Seed
export const FIELDS: Field[] = ['name', 'premise', 'genre', 'scale', 'magic', 'tech']
export const LABELS: Record<Field, string> = { name: 'Name', premise: 'Premise', genre: 'Genre flavor', scale: 'Scale', magic: 'Magic level', tech: 'Tech level' }
export const emptySeed = (): Seed => ({ name: '', premise: '', genre: '', scale: '', magic: '', tech: '' })

const POOL: Seed[] = [
  { name: 'Veyra of the Drowned Crowns', premise: "A sunken empire's kings still rule from beneath the tide, and the surface lords pay tribute in salt and silence.", genre: 'dark fantasy', scale: 'continent', magic: 'moderate', tech: 'medieval' },
  { name: 'Ashfall Reach', premise: 'Centuries after the sky-forges failed, scavenger clans roam glass deserts hunting working relics.', genre: 'post-apocalyptic', scale: 'single region', magic: 'low', tech: 'industrial' },
  { name: 'The Lantern Spiral', premise: 'A tower of floating cities, each lit by a captured star, drifting between planes.', genre: 'science fantasy', scale: 'planar', magic: 'ubiquitous', tech: 'futuristic' }
]
let n = 0
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Fake per-field suggestion. */
export async function suggestField(field: Field, _current: Seed): Promise<string> {
  await sleep(700)
  return POOL[n++ % POOL.length][field]
}

/** Fake one-prompt full draft. */
export async function draftSeed(_prompt: string): Promise<Seed> {
  await sleep(1500)
  return { ...POOL[n++ % POOL.length] }
}
