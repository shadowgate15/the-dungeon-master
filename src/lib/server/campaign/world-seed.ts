import type { World } from '../world/service'
import type { WorldWithSeed } from '#lib/campaign/seed.ts'

/** An active World with its Seed text, so the chat's context meter can count it. */
export function worldWithSeed(w: World): WorldWithSeed {
  return {
    id: w.id,
    name: w.name,
    premise: w.premise ?? '',
    genreFlavor: w.genreFlavor ?? '',
    scale: w.scale ?? '',
    magicLevel: w.magicLevel ?? '',
    techLevel: w.techLevel ?? ''
  }
}
