import { streamText, type ChatMessage, type ChatPort } from '../ai/port.ts'
import { estimateTokens, turnMessage, type ContextInput } from './context.ts'

/**
 * The rolling summary: a separate, stateless model call that folds the previous summary and the
 * Turns it does not yet cover into a new summary. Housekeeping only: it never blocks play and
 * every failure is swallowed by the caller (see `writeSummary`).
 */

/** A summary is due once unsummarized Turns pass this share of the Turn budget. */
export const SUMMARY_THRESHOLD = 0.5

/** The most tokens a summary may take. */
export const SUMMARY_MAX_TOKENS = 512

/** A summary call that outlives this is abandoned. */
export const SUMMARY_TIMEOUT_MS = 60_000

export const SUMMARY_INSTRUCTIONS = `You keep the running notes of a solo Dungeons & Dragons game for its Dungeon Master.
Merge the earlier notes (if any) with the new transcript into one updated summary of the story so far: where the player's Character is, what has happened, who they met, what was promised or left unresolved.
Write plain prose in the past tense, under 250 words, with no headings or lists.
Never include numbers or digits of any kind: no dice results, hit points, gold, distances, dates or counts. Say "a few", "badly wounded" or "a handful of coins" instead.
Reply with the summary text only.`

type SummaryTurn = ContextInput['turns'][number]

/** Tokens the Turns take in a prompt, by the same estimate context assembly uses. */
export const turnsTokens = (turns: readonly SummaryTurn[]) =>
  turns.reduce((n, t) => n + estimateTokens(turnMessage(t).content), 0)

/** Whether the Turns not yet summarized are enough to warrant a new summary. */
export const summaryDue = (unsummarized: readonly SummaryTurn[], turnBudget: number) =>
  unsummarized.length > 0 && turnsTokens(unsummarized) > turnBudget * SUMMARY_THRESHOLD

function summaryMessages(previous: string | null, turns: readonly SummaryTurn[]): ChatMessage[] {
  const transcript = turns
    .map((t) => `${t.author === 'dm' ? 'DM' : 'Player'}: ${turnMessage(t).content}`)
    .join('\n\n')
  const notes = previous?.trim() ? `Earlier notes:\n${previous.trim()}` : 'Earlier notes: none.'
  return [{ role: 'user', content: `${notes}\n\nNew transcript:\n${transcript}` }]
}

/**
 * Writes the next summary, or returns `undefined` on any failure: a model error, an abort or
 * timeout, an empty answer, or an answer containing a digit (summaries carry no numbers).
 */
export async function writeSummary(
  port: ChatPort,
  input: { threadId: string; previous: string | null; turns: readonly SummaryTurn[] }
): Promise<string | undefined> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SUMMARY_TIMEOUT_MS)
  try {
    let text = ''
    let done = false
    for await (const event of streamText(port, {
      systemPrompts: [SUMMARY_INSTRUCTIONS],
      messages: summaryMessages(input.previous, input.turns),
      maxTokens: SUMMARY_MAX_TOKENS,
      threadId: input.threadId,
      signal: controller.signal
    })) {
      if (event.type === 'delta') text += event.text
      else if (event.type === 'error') return undefined
      else done = true
    }
    const summary = text.trim()
    if (!done || !summary || /\d/.test(summary)) return undefined
    return summary
  } catch {
    return undefined
  } finally {
    clearTimeout(timer)
  }
}
