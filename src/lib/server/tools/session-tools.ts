import { z } from 'zod'
import { closeSession, history, sessionsView } from '../play/sessions'
import { readTool, writeTool } from './contract'

/** The most words a Session summary may have (the target is about 250). */
const SUMMARY_WORDS = 300

/** Continuity between Sessions: Session summaries and the Event log. */
export const sessionTools = [
  writeTool({
    name: 'close_session',
    description:
      'Close a Session with its summary: about 250 words or fewer of Player-safe past-tense prose about what the Characters did and learned (only what they know), plus open threads (unresolved hooks the Characters know about). Closes the current Session; pass session (a number) for the catch-up close of an older unclosed one. A Session with no Narration closes with no summary.',
    input: z.object({
      summary: z
        .string()
        .trim()
        .min(1)
        .refine((s) => s.split(/\s+/).length <= SUMMARY_WORDS, {
          message: `Keep the summary to about 250 words (at most ${SUMMARY_WORDS})`
        }),
      threads: z.array(z.string().trim().min(1)).max(12),
      session: z.number().int().positive().optional().describe('Session number, for a catch-up')
    }),
    activity: 'DM writes the Session summary',
    run: (ctx, input) => {
      const closed = closeSession(ctx.db, { ...input, at: ctx.now })
      return {
        result: closed,
        event: {
          kind: 'session_closed',
          summary: `Session ${closed.session} closed`,
          data: closed
        }
      }
    }
  }),

  readTool({
    name: 'sessions',
    description:
      'Session summaries and open threads, newest first (last limits how many). Also says which Session is current, which older ones are unclosed (catch-up close them first) and whether a recap is due this Session.',
    input: z.object({ last: z.number().int().positive().optional() }),
    activity: 'DM remembers earlier Sessions',
    run: ({ db }, { last }) => sessionsView(db, last)
  }),

  readTool({
    name: 'history',
    description:
      'The Event log, newest first. Filter by about (a handle the Event mentions), session (number), since (only Events after this Event id) and query (full-text over Narration). Includes DM-only Events, so never show them to the Players as they are. Recaps are left out.',
    input: z.object({
      about: z.string().min(1).optional(),
      session: z.number().int().positive().optional(),
      since: z.number().int().nonnegative().optional(),
      query: z.string().trim().min(1).optional(),
      limit: z.number().int().positive().max(200).optional()
    }),
    activity: 'DM looks back over the story',
    run: ({ db }, input) => ({ events: history(db, input) })
  })
]
