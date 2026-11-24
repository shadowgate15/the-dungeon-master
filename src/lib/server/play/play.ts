import { SOLO_PLAYER } from '#lib/character/enums.ts'
import type { LiveMessage } from '#lib/live/messages.ts'
import type { SceneView } from '#lib/play/scene.ts'
import type { Timeline } from '#lib/play/timeline.ts'
import type { ChannelEvent, Channels } from '../bridge/channels'
import type { Sessions } from '../bridge/sessions'
import { CampaignNotFoundError, type CampaignLibrary } from '../campaign/library'
import { campaignDice, type Dice } from '../dice'
import type { DoneOutcome, Floor } from '../floor/floor'
import { callResultEvent, type CallResult } from './calls'

export { DmBusyError } from '../floor/floor'
export { SpotlightRefusedError } from './scene'

/** Play input (and a creation conversation message) needs a DM at the table to hear it. */
export class DmAwayError extends Error {}

/** What every refused play input says while no session is attached. */
export const DM_AWAY_MESSAGE =
  'The DM is away. Run dm in the Campaign folder to start a sitting; your drafts wait here.'

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

  /**
   * The Campaign's folder, refusing play input while no DM is at the table. Open Calls and waiting
   * Floors stay as they are for the next opening.
   */
  function atTable(campaignId: string): string {
    const folder = folderOf(campaignId)
    if (!channels.listening(folder)) throw new DmAwayError(DM_AWAY_MESSAGE)
    return folder
  }

  function answered(campaignId: string, result: CallResult | null): { complete: boolean } {
    if (result) channels.send(folderOf(campaignId), callResultEvent(result))
    publish({ type: 'timeline', campaign: campaignId })
    return { complete: result !== null }
  }

  return {
    /** Whether a DM is at the table for the Campaign. */
    attended(campaignId: string): boolean {
      return channels.listening(folderOf(campaignId))
    },

    /** The open Floor, to send, edit or withdraw Declarations; refused while the DM is away. */
    floor(campaignId: string): Floor {
      atTable(campaignId)
      return library.floor(campaignId)
    },

    /**
     * The Player presses Done. When it closes the Floor, the DM gets exactly one floor event and
     * the Campaign awaits Narration.
     */
    done(campaignId: string, player: string = SOLO_PLAYER): DoneOutcome {
      atTable(campaignId)
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
      atTable(campaignId)
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
      atTable(campaignId)
      const result = library.calls(campaignId).answer(callId, partId, text, player)
      return answered(campaignId, result)
    },

    /**
     * A Player's "Cut to <Name>": one spotlight channel event to the DM. Doesn't await Narration.
     * Refused (`SpotlightRefusedError`) for a Character who is already in the Scene.
     */
    spotlight(campaignId: string, character: string, player: string = SOLO_PLAYER): void {
      const folder = atTable(campaignId)
      const request = library.record(campaignId).spotlight(character, player)
      channels.send(folder, request)
    },

    /** The Scene as the Player's rail shows it. */
    scene(campaignId: string): SceneView {
      return library.record(campaignId).scene()
    },

    /**
     * The Player writes in the DM pane: the message is kept for the pane and reaches the DM as one
     * conversation event. It is out of fiction, so it never touches the Floor or the Event log.
     */
    converse(campaignId: string, text: string, player: string = SOLO_PLAYER) {
      const folder = folderOf(campaignId)
      if (!channels.listening(folder)) {
        throw new DmAwayError('The DM is away. Run dm in the Campaign folder to ask for help.')
      }
      const message = library.conversation(campaignId).add({ text, player })
      channels.send(folder, { content: text, meta: { kind: 'conversation', player } })
      publish({ type: 'conversation', campaign: campaignId })
      return message
    },

    /**
     * The Player presses End Session: the DM gets one `end_session` event and closes the sitting
     * (closing beat, summary, Arc review, lint) with the ending-a-sitting skill.
     */
    endSession(campaignId: string) {
      channels.send(atTable(campaignId), {
        content: 'The Player pressed End Session. Close the sitting.',
        meta: { kind: 'end_session' }
      })
    },

    /**
     * Opens the Campaign's Session as a DM attaches through `bridge`; a reconnecting bridge keeps
     * its own Session.
     */
    openSession(campaignId: string, bridge?: string): { id: string; number: number } {
      return library.record(campaignId).openSession(bridge)
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
  return sessions.onChange(({ campaign, attached, session }) => {
    if (attached) play.openSession(campaign, session)
  })
}
