/** A Character as the rail shows them. */
export type SceneCharacter = { id: string; name: string }

/**
 * The Scene as the Player sees it: the clock, the spotlight's Place and the Party, split into who
 * is present and who is elsewhere (with where they are). Only Characters' own surroundings: no
 * NPCs, no handles.
 */
export type SceneView = {
  clock: { minute: number; day: number; time: string }
  /** Null before the DM first sets the Scene. */
  place: { name: string } | null
  present: SceneCharacter[]
  elsewhere: (SceneCharacter & { whereabouts: string | null })[]
}
