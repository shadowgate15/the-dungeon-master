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

/** The open Floor: the Declarations on it in send order. */
export type OpenFloor = { declarations: PendingDeclaration[] }
