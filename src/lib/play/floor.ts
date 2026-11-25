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

/**
 * The open Floor: the Declarations on it in send order, plus this Player's drafts returned by a
 * cut, for the composer to load.
 */
export type OpenFloor = { declarations: PendingDeclaration[]; returned: ReturnedDraft[] }
