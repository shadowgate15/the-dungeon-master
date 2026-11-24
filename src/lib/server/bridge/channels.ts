import { canonicalFolder } from '../campaign/paths'

/**
 * One channel event for the DM, relayed by the bridge as `notifications/claude/channel`. `meta`
 * holds flat strings only (`kind` names the event); lists go in `content`.
 */
export type ChannelEvent = { content: string; meta: Record<string, string> }

type Listener = (event: ChannelEvent) => void

/** The Player's answer to a permission prompt, relayed as `notifications/claude/channel/permission`. */
export type PermissionVerdict = { request_id: string; behavior: 'allow' | 'deny' }

type VerdictListener = (verdict: PermissionVerdict) => void

/** Channel events per Campaign folder, delivered to the bridges listening for it. */
export function createChannels() {
  const listeners = new Map<string, Set<Listener>>()
  const verdictListeners = new Map<string, Set<VerdictListener>>()
  const key = canonicalFolder

  return {
    /** Starts listening for a Campaign's events; returns the unsubscribe. */
    listen(folder: string, listener: Listener): () => void {
      const set = listeners.get(key(folder)) ?? new Set()
      listeners.set(key(folder), set)
      set.add(listener)
      return () => set.delete(listener)
    },

    /** Whether any bridge is listening for the Campaign. */
    listening(folder: string): boolean {
      return (listeners.get(key(folder))?.size ?? 0) > 0
    },

    send(folder: string, event: ChannelEvent) {
      for (const listener of listeners.get(key(folder)) ?? []) listener(event)
    },

    /** Starts listening for the verdicts the Player gives the Campaign's session; returns the unsubscribe. */
    listenVerdicts(folder: string, listener: VerdictListener): () => void {
      const set = verdictListeners.get(key(folder)) ?? new Set()
      verdictListeners.set(key(folder), set)
      set.add(listener)
      return () => set.delete(listener)
    },

    /** Relays a permission verdict to the Campaign's session. */
    sendVerdict(folder: string, verdict: PermissionVerdict) {
      for (const listener of verdictListeners.get(key(folder)) ?? []) listener(verdict)
    }
  }
}

export type Channels = ReturnType<typeof createChannels>
