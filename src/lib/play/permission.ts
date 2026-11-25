/**
 * A permission prompt the DM's Claude Code session is waiting on, as the Player's console shows
 * it. Claude Code sanitizes and credential-masks `description` and `inputPreview`.
 */
export type PendingPermission = {
  /** Claude Code's five-letter id for the prompt. */
  requestId: string
  toolName: string
  description: string
  inputPreview: string
}

/** The Player's answer to a permission prompt. */
export type PermissionBehavior = 'allow' | 'deny'
