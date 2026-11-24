import { SOLO_PLAYER } from '#lib/character/enums.ts'
import type { LiveMessage } from '#lib/live/messages.ts'
import type { Timeline } from '#lib/play/timeline.ts'
import type { ChannelEvent, Channels } from '../bridge/channels'
import type { Sessions } from '../bridge/sessions'
import { CampaignNotFoundError, type CampaignLibrary } from '../campaign/library'
import { campaignDice, type Dice } from '../dice'
import type { DoneOutcome } from '../floor/floor'
import { callResultEvent, type CallResult } from './calls'

export { DmBusyError } from '../floor/floor'

type Options = {
  library: CampaignLibrary
  channels: Channels
  /** Tells every browser tab what changed. */
  publish: (message: LiveMessage) => void
  /** The Campaign's roller. */
  dice?: (campaignId: string) => Dice
}

/**
 * A closed Floor as the DM hears it: one `floor` channel event, one body line per Declaration in
 * send order (`[d1 Wren · player] picks the lock`). An empty body hands the DM the initiative.
 * `withdrawn_call` names the open Call the Declarations withdrew.
 */
export function floorEvent(closed: Extract<DoneOutcome, { closed: true }>): ChannelEvent {
  return {
    content: closed.declarations
      .map((d, i) => `[d${i + 1} ${d.characterName} · ${d.player}] ${d.text}`)
      .join('\n'),
    meta: {
      kind: 'floor',
      floor_id: closed.floor,
      players: closed.players.join(','),
      ...(closed.withdrawnCall ? { withdrawn_call: closed.withdrawnCall } : {})
    }
  }
}

/**
 * The play turn across the server: the Players' Done wakes the DM over its channel, Sessions open
 * as the DM attaches, and the Player's timeline is read from the Event log.
 */
export function createPlay({
  library,
  channels,
  publish,
  dice = (id) => campaignDice.for(id)
}: Options) {
  function folderOf(campaignId: string): string {
    const entry = library.get(campaignId)
    if (!entry) throw new CampaignNotFoundError('Campaign not found')
    return entry.path
  }

  function answered(campaignId: string, result: CallResult | null): { complete: boolean } {
    if (result) channels.send(folderOf(campaignId), callResultEvent(result))
    publish({ type: 'timeline', campaign: campaignId })
    return { complete: result !== null }
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
     * The Player clicks one roll of the open Call; code rolls it. The roll that completes the Call
     * wakes the DM with one call_result event and sets awaiting Narration.
     */
    roll(campaignId: string, callId: string, partId: string, player: string = SOLO_PLAYER) {
      const result = library.calls(campaignId).roll(callId, partId, dice(campaignId), player)
      return answered(campaignId, result)
    },

    /** The Player answers a question Call; the last answer wakes the DM like a roll does. */
    answer(
      campaignId: string,
      callId: string,
      partId: string,
      text: string,
      player: string = SOLO_PLAYER
    ) {
      const result = library.calls(campaignId).answer(callId, partId, text, player)
      return answered(campaignId, result)
    },

    /** Opens the Campaign's Session as a DM attaches; a reattaching DM keeps the open one. */
    openSession(campaignId: string): { id: string; number: number } {
      return library.record(campaignId).openSession()
    },

    /**
     * The Stop hook asks whether the DM may end its turn. It may not while a closed Floor awaits
     * Narration; on the second attempt (`again`) it may, and the Player's timeline shows an error.
     */
    stopCheck(campaignId: string, again: boolean): { block: boolean; reason?: string } {
      const record = library.record(campaignId)
      if (record.timeline().awaitingSince === null) return { block: false }
      if (!again) {
        return {
          block: true,
          reason: 'A closed Floor awaits Narration. Answer it with narrate before ending your turn.'
        }
      }
      record.turnError('The DM ended its turn without a Narration.')
      publish({ type: 'timeline', campaign: campaignId })
      return { block: false }
    },

    /** The DM's core block, for SessionStart and after compaction. */
    coreBlock(campaignId: string): string {
      return library.record(campaignId).coreBlock()
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
