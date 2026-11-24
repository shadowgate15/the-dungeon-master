import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { entity } from '../db/schema'
import { callInput, openCall } from '../play/calls'
import { setAwaitingNarration } from '../play/log'
import { ToolError, writeTool, type ToolContext } from './contract'

/** The NPC a Narration is voiced by; refused unless the handle names a live NPC. */
function speaker({ db }: ToolContext, handle: string) {
  const found = db.select().from(entity).where(eq(entity.handle, handle)).get()
  if (!found || found.type !== 'npc' || found.retiredAt !== null) {
    throw ToolError.unknownHandle(handle)
  }
  return found
}

/** Telling the Players what happens. */
export const narrationTools = [
  writeTool({
    name: 'narrate',
    description:
      'Narrate to the Players: the Narration shows in their timeline. Pass voice (an NPC handle) when an NPC speaks. The first Narration after a closed Floor answers it; later ones in the same turn are fine.',
    input: z.object({
      text: z.string().trim().min(1),
      voice: z.string().min(1).optional().describe('NPC handle, when an NPC speaks'),
      call: callInput
        .optional()
        .describe(
          'Ask the Players: inline {kind: "check", character, skill | save, tier, adv?, reason} (or a list of them, one roll per Character) or {kind: "question", text, choices?}. A Call ends your turn; its call_result wakes you.'
        )
    }),
    activity: null,
    run: (ctx, { text, voice, call }) => {
      const npc = voice === undefined ? undefined : speaker(ctx, voice)
      setAwaitingNarration(ctx.db, null)
      const callId =
        call === undefined
          ? null
          : openCall(ctx.db, call, { at: ctx.now, openedBy: ctx.stamp.eventId })
      return {
        result: callId
          ? { narrated: true, call: callId, next: 'End your turn: the Players answer the Call' }
          : { narrated: true },
        event: {
          kind: 'narration',
          summary: npc ? `${npc.name}: ${text}` : text,
          data: { text, voice: npc?.handle ?? null, voiceName: npc?.name ?? null, call: callId }
        }
      }
    }
  })
]
