/**
 * Calls: raising one on the Scene, answering it and withdrawing it, each recorded in the Event
 * log. Code rolls every Check; the DC comes from the difficulty map and stays server-side (in the
 * Scene row and in event data, never in event text).
 */
import {
  checkLabel,
  rollLine,
  type Call,
  type CarriedEffect,
  type CheckCall,
  type CheckRoll,
  type Clarification,
  type QuestionCall
} from '#lib/session/call.ts'
import type { SessionEvent } from '#lib/session/enums.ts'
import type { Dice } from '../../dice.ts'
import type { CheckModifier } from '../check-modifier.ts'
import type { ExchangeContext } from './context.ts'
import { DIFFICULTY_DC, type Adjudication } from './contract.ts'

/** The Session a Call lives in. */
type At = Pick<ExchangeContext, 'sessions' | 'sessionId'>

/** A ruling that raises a Call: a Check or a clarifying question. */
export type CallRuling = Extract<Adjudication, { outcome: 'check' | 'ask' }>

/** Opens `call` on the Scene, or clears it with null. */
function setOpenCall({ sessions, sessionId }: At, call: Call | null) {
  sessions.saveScene(sessionId, { ...sessions.scene(sessionId), openCall: call })
}

/** The Call a ruling raises, and the text and data its `call-raised` event logs (no DC in text). */
function callFor(
  ruling: CallRuling,
  declaration: SessionEvent,
  history: Clarification[],
  effect?: CarriedEffect
): { call: Call; text: string; data: Record<string, unknown> } {
  const shared = {
    declaration: { seq: declaration.seq, text: declaration.text ?? '' },
    ...(effect && { effect })
  }
  if (ruling.outcome === 'check') {
    // A Check called after clarifying keeps the history, so the Effect after the roll knows what
    // was meant.
    const call: CheckCall = {
      kind: 'check',
      skill: ruling.skill,
      difficulty: ruling.difficulty,
      dc: DIFFICULTY_DC[ruling.difficulty],
      ...shared,
      ...(history.length > 0 && { history })
    }
    return {
      call,
      text: `${checkLabel(call.skill)} check: ${call.declaration.text}`,
      data: { kind: call.kind, skill: call.skill, difficulty: call.difficulty, dc: call.dc }
    }
  }
  const call: QuestionCall = {
    kind: 'question',
    question: ruling.question,
    ...(ruling.choices && { choices: ruling.choices }),
    ...shared,
    history
  }
  return {
    call,
    text: call.question,
    data: { kind: call.kind, question: call.question, choices: call.choices ?? [] }
  }
}

/**
 * Saves the Call a Check or ask ruling raises for the Declaration on the Scene, with the
 * Clarifications already answered and any carried Effect, and logs it as `call-raised`: a Check
 * by its skill, a question by its text.
 */
export function raiseCall(
  ctx: At,
  declaration: SessionEvent,
  ruling: CallRuling,
  history: Clarification[],
  effect?: CarriedEffect
): SessionEvent {
  const { call, text, data } = callFor(ruling, declaration, history, effect)
  setOpenCall(ctx, call)
  return ctx.sessions.appendEvent(ctx.sessionId, { role: 'code', kind: 'call-raised', text, data })
}

/**
 * Clears the open question Call and logs the player's answer as their `call-answered` line.
 * Returns the event and the history with this Clarification added.
 */
export function answerQuestion(
  ctx: At,
  call: QuestionCall,
  answer: { answer: string; chosen: boolean }
): { event: SessionEvent; history: Clarification[] } {
  setOpenCall(ctx, null)
  const event = ctx.sessions.appendEvent(ctx.sessionId, {
    role: 'player',
    kind: 'call-answered',
    text: answer.answer,
    data: { kind: call.kind, question: call.question, ...answer }
  })
  return { event, history: [...call.history, { question: call.question, answer: answer.answer }] }
}

/** Rolls a Check Call: d20 plus the Character's modifier, against the DC. */
export function rollCheck(
  call: CheckCall,
  dice: Dice,
  modifier: CheckModifier,
  sessionId: string
): CheckRoll {
  const die = dice.d20()
  const mod = modifier(sessionId, call.skill)
  const total = die + mod
  return { die, modifier: mod, total, success: total >= call.dc }
}

/** Clears the open Call and logs its rolled result as `call-answered`. */
export function answerCheck(ctx: At, call: CheckCall, roll: CheckRoll): SessionEvent {
  setOpenCall(ctx, null)
  return ctx.sessions.appendEvent(ctx.sessionId, {
    role: 'code',
    kind: 'call-answered',
    text: rollLine(call.skill, roll),
    data: { kind: call.kind, skill: call.skill, dc: call.dc, ...roll }
  })
}

/** The text and data a withdrawn Call logs: a Check by its skill, a question by its text. */
function withdrawn(call: Call): { text: string; data: Record<string, unknown> } {
  return call.kind === 'check'
    ? {
        text: `${checkLabel(call.skill)} check withdrawn`,
        data: { kind: call.kind, skill: call.skill, withdrawn: true }
      }
    : {
        text: 'Question withdrawn',
        data: { kind: call.kind, question: call.question, withdrawn: true }
      }
}

/** Clears the open Call unanswered and logs it as a withdrawn `call-answered`. */
export function withdrawCall(ctx: At, call: Call): SessionEvent {
  setOpenCall(ctx, null)
  return ctx.sessions.appendEvent(ctx.sessionId, {
    role: 'code',
    kind: 'call-answered',
    ...withdrawn(call)
  })
}
