/** One line of the creation conversation, as the DM pane shows it. */
export type ConversationMessage = {
  id: number
  /** `dm_write` is a muted line for a field the DM set. */
  author: 'player' | 'dm' | 'dm_write'
  player: string | null
  text: string
  createdAt: number
}
