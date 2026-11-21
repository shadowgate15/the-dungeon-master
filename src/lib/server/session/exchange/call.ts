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
  type ClarifyingRound,
  type QuestionCall
} from '#lib/session/call.ts'
import type { SessionEvent } from '#lib/session/enums.ts'
import type { Dice } from '../../dice.ts'
import type { CheckModifier } from '../check-modifier.ts'
import type { SessionService } from '../service.ts'
import { DIFFICULTY_DC, type Adjudication } from './contract.ts'

type CheckRuling = Extract<Adjudication, { outcome: 'check' }>
type AskRuling = Extract<Adjudication, { outcome: 'ask' }>

const callDeclaration = (declaration: SessionEvent) => ({
  seq: declaration.seq,
  text: declaration.text ?? ''
})

/**
 * Saves a Check Call for the Declaration on the Scene and logs it as `call-raised`. A Check called
 * after clarifying keeps the history, so the Effect after the roll knows what was meant.
 */
export function raiseCheck(
  sessions: SessionService,
  sessionId: string,
  declaration: SessionEvent,
  ruling: CheckRuling,
  history: ClarifyingRound[] = [],
  effect?: CarriedEffect
): SessionEvent {
  const call: CheckCall = {
    kind: 'check',
    skill: ruling.skill,
    difficulty: ruling.difficulty,
    dc: DIFFICULTY_DC[ruling.difficulty],
    declaration: callDeclaration(declaration),
    ...(history.length > 0 && { history }),
    ...(effect && { effect })
  }
  sessions.saveScene(sessionId, { ...sessions.scene(sessionId), openCall: call })
  return sessions.appendEvent(sessionId, {
    role: 'code',
    kind: 'call-raised',
    text: `${checkLabel(call.skill)} check: ${call.declaration.text}`,
    data: { kind: call.kind, skill: call.skill, difficulty: call.difficulty, dc: call.dc }
  })
}

/**
 * Saves a question Call for the Declaration on the Scene, with the rounds already answered, and
 * logs it as `call-raised` with the question as its text.
 */
export function raiseQuestion(
  sessions: SessionService,
  sessionId: string,
  declaration: SessionEvent,
  ruling: AskRuling,
  history: ClarifyingRound[],
  effect?: CarriedEffect
): SessionEvent {
  const call: QuestionCall = {
    kind: 'question',
    question: ruling.question,
    ...(ruling.choices && { choices: ruling.choices }),
    declaration: callDeclaration(declaration),
    history,
    ...(effect && { effect })
  }
  sessions.saveScene(sessionId, { ...sessions.scene(sessionId), openCall: call })
  return sessions.appendEvent(sessionId, {
    role: 'code',
    kind: 'call-raised',
    text: call.question,
    data: { kind: call.kind, question: call.question, choices: call.choices ?? [] }
  })
}

/**
 * Clears the open question Call and logs the player's answer as their `call-answered` line.
 * Returns the event and the history with this round added.
 */
export function answerQuestion(
  sessions: SessionService,
  sessionId: string,
  call: QuestionCall,
  answer: { answer: string; chosen: boolean }
): { event: SessionEvent; history: ClarifyingRound[] } {
  sessions.saveScene(sessionId, { ...sessions.scene(sessionId), openCall: null })
  const event = sessions.appendEvent(sessionId, {
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
export function answerCheck(
  sessions: SessionService,
  sessionId: string,
  call: CheckCall,
  roll: CheckRoll
): SessionEvent {
  sessions.saveScene(sessionId, { ...sessions.scene(sessionId), openCall: null })
  return sessions.appendEvent(sessionId, {
    role: 'code',
    kind: 'call-answered',
    text: rollLine(call.skill, roll),
    data: { kind: call.kind, skill: call.skill, dc: call.dc, ...roll }
  })
}

/** Clears the open Call unanswered and logs it as a withdrawn `call-answered`. */
export function withdrawCall(
  sessions: SessionService,
  sessionId: string,
  call: Call
): SessionEvent {
  sessions.saveScene(sessionId, { ...sessions.scene(sessionId), openCall: null })
  return sessions.appendEvent(sessionId, {
    role: 'code',
    kind: 'call-answered',
    text:
      call.kind === 'check' ? `${checkLabel(call.skill)} check withdrawn` : 'Question withdrawn',
    data:
      call.kind === 'check'
        ? { kind: call.kind, skill: call.skill, withdrawn: true }
        : { kind: call.kind, question: call.question, withdrawn: true }
  })
}
