/** A Declaration on the open Floor, as the Player sees it in the pending tray. */
export type PendingDeclaration = {
  id: string
  /** The one Character it names. */
  character: string
  characterName: string
  /** The Player who declared it. */
  player: string
  text: string
}

/**
 * A Declaration sent back to its Player's composer as unsent text, because the spotlight cut away
 * from its Character before the Floor closed.
 */
export type ReturnedDraft = { id: string; character: string; characterName: string; text: string }

/** An open Declaration as one browser sees it: `own` when that browser sent it (only its own can be changed). */
export type FloorDeclaration = PendingDeclaration & { own: boolean }

/** A Character in the Scene, as the table strip names it. */
export type TableCharacter = { id: string; name: string }

/** One browser with a Character in the Scene: named by those Characters, deciding or Done. */
export type TableBrowser = {
  /** This is the viewing browser. */
  own: boolean
  /** Its in-Scene Characters, which also name it ("You (Wren)", "Bram & Kael"). */
  characters: TableCharacter[]
  done: boolean
}

/**
 * The open Floor for one browser: every open Declaration in the Scene in send order (marked own or
 * not), each browser at the table with its deciding/Done state, the unclaimed Characters in the
 * Scene (who sit out), plus this browser's drafts returned by a cut, for the composer to load.
 */
export type OpenFloor = {
  declarations: FloorDeclaration[]
  browsers: TableBrowser[]
  unclaimed: TableCharacter[]
  returned: ReturnedDraft[]
}
