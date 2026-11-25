import type { LiveMessage } from '#lib/live/messages.ts'
import type { PendingPermission, PermissionBehavior } from '#lib/play/permission.ts'
import type { Channels } from './channels'
import type { Sessions } from './sessions'

type Options = {
  channels: Channels
  sessions: Sessions
  /** Tells every browser tab what changed. */
  publish: (message: LiveMessage) => void
}

/**
 * The permission prompts the DM's session is waiting on, one per Campaign, held in memory: they
 * die with the session. The terminal's dialog stays open beside the browser's card and the first
 * answer wins, but Claude Code never tells a channel server the terminal answered. So the server
 * infers it, clearing the card when:
 * - the session moves on: its next tool call for the Campaign;
 * - a newer prompt arrives (only the newest shows);
 * - the session leaves.
 */
export function createPermissions({ channels, sessions, publish }: Options) {
  const pending = new Map<string, { folder: string; request: PendingPermission }>()

  function clear(campaign: string) {
    if (pending.delete(campaign)) publish({ type: 'permission', campaign })
  }

  sessions.onChange(({ campaign, attached }) => {
    if (!attached) clear(campaign)
  })

  return {
    /** The session raised a prompt: the Player's console shows it, replacing any older one. */
    request(campaign: string, folder: string, request: PendingPermission) {
      pending.set(campaign, { folder, request })
      publish({ type: 'permission', campaign })
    },

    /** The prompt the Campaign's session is waiting on, or null. */
    pending(campaign: string): PendingPermission | null {
      return pending.get(campaign)?.request ?? null
    },

    /**
     * The Player answers in the browser: the verdict goes to the session and the card clears.
     * False when the prompt is no longer waiting (answered in the terminal, or replaced).
     */
    answer(campaign: string, requestId: string, behavior: PermissionBehavior): boolean {
      const held = pending.get(campaign)
      if (!held || held.request.requestId !== requestId) return false
      channels.sendVerdict(held.folder, { request_id: requestId, behavior })
      clear(campaign)
      return true
    },

    /** The session moved on (it called a tool), so any prompt was answered in the terminal. */
    movedOn(campaign: string) {
      clear(campaign)
    }
  }
}

export type Permissions = ReturnType<typeof createPermissions>
