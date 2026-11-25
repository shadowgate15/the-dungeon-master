/** A Campaign's session attached state changed. */
export type SessionChange = {
  campaign: string
  attached: boolean
  /** The bridge's session id (one per Claude Code session). */
  session: string
}

type Listener = (change: SessionChange) => void

/** Why a second bridge for a Campaign is refused. */
export const SESSION_LIVE_MESSAGE =
  'This Campaign already has a live session: another Claude Code session is the DM at this table'

/**
 * Which Campaigns have a DM at the table: one live session per Campaign, held by the bridge whose
 * channel stream is connected. A bridge may hold several streams at once (a reconnect racing the
 * old one); the session detaches when its last stream goes.
 */
export function createSessions() {
  const live = new Map<string, { session: string; streams: number }>()
  const listeners = new Set<Listener>()
  const emit = (change: SessionChange) => {
    for (const listener of listeners) listener(change)
  }

  return {
    /** Attaches the session to the Campaign; false when another session already holds it. */
    attach(campaign: string, session: string): boolean {
      const held = live.get(campaign)
      if (held && held.session !== session) return false
      if (held) held.streams++
      else {
        live.set(campaign, { session, streams: 1 })
        emit({ campaign, attached: true, session })
      }
      return true
    },

    /** Ends one of the session's streams; the Campaign is free once its last one ends. */
    detach(campaign: string, session: string) {
      const held = live.get(campaign)
      if (!held || held.session !== session) return
      if (--held.streams > 0) return
      live.delete(campaign)
      emit({ campaign, attached: false, session })
    },

    /** Whether a session is attached to the Campaign. */
    attached(campaign: string): boolean {
      return live.has(campaign)
    },

    /** Whether the Campaign is held by a session other than this one. */
    heldByOther(campaign: string, session: string): boolean {
      const held = live.get(campaign)
      return held !== undefined && held.session !== session
    },

    /** The ids of every Campaign with a session attached. */
    list(): string[] {
      return [...live.keys()]
    },

    /** Calls `listener` on every attach and detach; returns the unsubscribe. */
    onChange(listener: Listener): () => void {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }
  }
}

export type Sessions = ReturnType<typeof createSessions>
