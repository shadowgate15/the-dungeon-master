import type { ChatMessage } from '../ai/port.ts'
import type { Turn } from './service.ts'

/**
 * DM context assembly: the prompt for one DM call, rebuilt from the database every time. Pure;
 * the caller loads the rows. Order: the static DM instruction block, the Campaign Seed, every
 * linked World, the derived Character sheet, the rolling summary (when there is one), then the
 * newest Turns that fit the Turn budget. History is plain text.
 */

export const DM_INSTRUCTIONS = `You are the Dungeon Master of a solo Dungeons & Dragons 5th edition game (SRD 5.1 rules only).
Narrate the world, voice its characters and react to what the player does. Stay consistent with the Campaign Seed, the Worlds and the player's Character below.
Write vivid, concise narration in the second person, a short paragraph or two. Never write the player's actions or decisions for them, and end by leaving them room to act.
Never invent dice results, hit points, spell slots, inventory or any other number or game state; the game's code owns those. Do not announce mechanics you cannot resolve.
When an action has an uncertain outcome that matters, call the request_roll tool (an ability or skill check, a DC from 5 to 30, and the reason) instead of deciding it yourself, after narrating the moment before the check. The player's roll then arrives as their next message; narrate its consequence, treating a total at or above the DC as success.`

/** Asked when the transcript is empty: the DM speaks first. */
export const OPENING_PROMPT =
  'Begin the session. Open with the opening scene, introducing where my Character is and what is happening, then let me act.'

export interface ContextInput {
  campaign: { name: string; premise: string; tone: string; length: string }
  worlds: { name: string; premise: string | null; genreFlavor: string | null }[]
  /** The rolling summary of earlier play; absent or null before one is written. */
  summary?: string | null
  /** The derived Character sheet as text. */
  sheet: string
  turns: readonly Pick<Turn, 'seq' | 'author' | 'kind' | 'text' | 'rollRequest' | 'rollResult'>[]
  /** The model's context window, in tokens. */
  contextLimit: number
  /** Tokens kept free for the model's reply. */
  replyReserve: number
}

export interface AssembledContext {
  systemPrompts: string[]
  messages: ChatMessage[]
  /** Tokens left for history after the fixed prompts and the reply reserve. */
  turnBudget: number
  /** How many of the oldest Turns did not fit and were left out. */
  droppedTurns: number
}

/** A deliberately pessimistic estimate (three characters a token), so a prompt never overruns. */
export const estimateTokens = (text: string) => Math.ceil(text.length / 3)

function campaignBlock(c: ContextInput['campaign']) {
  return `Campaign Seed:\n- Name: ${c.name}\n- Premise: ${c.premise}\n- Tone: ${c.tone}\n- Length: ${c.length}`
}

function worldsBlock(worlds: ContextInput['worlds']) {
  if (worlds.length === 0) return 'Worlds: none.'
  const blocks = worlds.map(
    (w) =>
      `- ${w.name}${w.genreFlavor ? ` (${w.genreFlavor})` : ''}${w.premise ? `: ${w.premise}` : ''}`
  )
  return `Worlds this Campaign is set in (stay consistent with them):\n${blocks.join('\n')}`
}

/** A Turn as plain text for the model. */
export function turnMessage(t: ContextInput['turns'][number]): ChatMessage {
  if (t.author === 'dm') {
    const ask = t.rollRequest
      ? `\n[The DM asked for a ${t.rollRequest.key} ${t.rollRequest.check} check, DC ${t.rollRequest.dc}: ${t.rollRequest.reason}]`
      : ''
    return { role: 'assistant', content: `${t.text ?? ''}${ask}` }
  }
  if (t.kind === 'roll_result' && t.rollResult) {
    const { d20, modifier, total } = t.rollResult
    return {
      role: 'user',
      content: `I rolled ${d20} ${modifier < 0 ? '-' : '+'} ${Math.abs(modifier)} = ${total}.`
    }
  }
  return { role: 'user', content: t.text ?? '' }
}

export function assembleContext(input: ContextInput): AssembledContext {
  const systemPrompts = [
    DM_INSTRUCTIONS,
    campaignBlock(input.campaign),
    worldsBlock(input.worlds),
    `The player's Character (derived from the game's rules; do not change these numbers):\n${input.sheet}`
  ]
  if (input.summary?.trim()) {
    systemPrompts.push(`The story so far (a summary of earlier play):\n${input.summary.trim()}`)
  }
  const fixed = systemPrompts.reduce((n, p) => n + estimateTokens(p), 0)
  const turnBudget = Math.max(0, input.contextLimit - input.replyReserve - fixed)

  if (input.turns.length === 0) {
    return {
      systemPrompts,
      messages: [{ role: 'user', content: OPENING_PROMPT }],
      turnBudget,
      droppedTurns: 0
    }
  }

  // Walk from the newest Turn back; the newest is always kept so the model has something to answer.
  const kept: ChatMessage[] = []
  let used = 0
  for (const t of [...input.turns].reverse()) {
    const message = turnMessage(t)
    const cost = estimateTokens(message.content)
    if (kept.length > 0 && used + cost > turnBudget) break
    kept.unshift(message)
    used += cost
  }
  return {
    systemPrompts,
    messages: kept,
    turnBudget,
    droppedTurns: input.turns.length - kept.length
  }
}
