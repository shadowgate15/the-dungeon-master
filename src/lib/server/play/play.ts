import { SOLO_PLAYER } from '#lib/character/enums.ts'
import type { LiveMessage } from '#lib/live/messages.ts'
import type { SceneView } from '#lib/play/scene.ts'
import type { Timeline } from '#lib/play/timeline.ts'
import type { ChannelEvent, Channels } from '../bridge/channels'
import type { Sessions } from '../bridge/sessions'
import { CampaignNotFoundError, type CampaignLibrary } from '../campaign/library'
import type { DoneOutcome } from '../floor/floor'

export { DmBusyError } from '../floor/floor'
export { SpotlightRefusedError } from './scene'

type Options = {
  library: CampaignLibrary
  channels: Channels
  /** Tells every browser tab what changed. */
  publish: (message: LiveMessage) => void
}

/**
 * A closed Floor as the DM hears it: one `floor` channel event, one body line per Declaration in
 * send order (`[d1 Wren · player] picks the lock`). An empty body hands the DM the initiative.
 */
export function floorEvent(closed: Extract<DoneOutcome, { closed: true }>): ChannelEvent {
  return {
    content: closed.declarations
      .map((d, i) => `[d${i + 1} ${d.characterName} · ${d.player}] ${d.text}`)
      .join('\n'),
    meta: { kind: 'floor', floor_id: closed.floor, players: closed.players.join(',') }
  }
}

/**
 * The play turn across the server: the Players' Done wakes the DM over its channel, Sessions open
 * as the DM attaches, and the Player's timeline is read from the Event log.
 */
export function createPlay({ library, channels, publish }: Options) {
  function folderOf(campaignId: string): string {
    const entry = library.get(campaignId)
    if (!entry) throw new CampaignNotFoundError('Campaign not found')
    return entry.path
  }

  return {
    /**
     * The Player presses Done. When it closes the Floor, the DM gets exactly one floor event and
     * the Campaign awaits Narration.
     */
    done(campaignId: string, player: string = SOLO_PLAYER): DoneOutcome {
      const outcome = library.floor(campaignId).done(player)
      if (outcome.closed) channels.send(folderOf(campaignId), floorEvent(outcome))
      publish({ type: 'floor', campaign: campaignId })
      if (outcome.closed) publish({ type: 'timeline', campaign: campaignId })
      return outcome
    },

    /**
     * A Player's "Cut to <Name>": one spotlight channel event to the DM. Doesn't await Narration.
     * Refused (`SpotlightRefusedError`) for a Character who is already in the Scene.
     */
    spotlight(campaignId: string, character: string, player: string = SOLO_PLAYER): void {
      const request = library.record(campaignId).spotlight(character, player)
      channels.send(folderOf(campaignId), request)
    },

    /** The Scene as the Player's rail shows it. */
    scene(campaignId: string): SceneView {
      return library.record(campaignId).scene()
    },

    /** Opens the Campaign's Session as a DM attaches; a reattaching DM keeps the open one. */
    openSession(campaignId: string): { id: string; number: number } {
      return library.record(campaignId).openSession()
    },

    /** The Player's timeline and whether the DM is working on a turn. */
    timeline(campaignId: string): Timeline {
      return library.record(campaignId).timeline()
    }
  }
}

export type Play = ReturnType<typeof createPlay>

/** Opens a Campaign's Session whenever a DM attaches to it; returns the unsubscribe. */
export function openSessionsOnAttach(sessions: Sessions, play: Play): () => void {
  return sessions.onChange(({ campaign, attached }) => {
    if (attached) play.openSession(campaign)
  })
}
