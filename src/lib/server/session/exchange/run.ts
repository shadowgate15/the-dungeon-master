/**
 * One Exchange (ADR 0005): a fixed sequence of steps over a recorded Declaration. Adjudication
 * rules how it resolves; a Check or a clarifying question raises a Call, which pauses the Exchange
 * until the player rolls or answers. An answered question is ruled on again, merged with the
 * answers so far, for as many Clarifications as it takes.
 * On happens or a successful Check, Effect picks and code applies the one Effect; the Reply
 * streams last, told what was settled. Code owns the order; the model only answers each step.
 */
import type { CarriedEffect, CheckCall, CheckRoll, Clarification } from '#lib/session/call.ts'
import type { SessionEvent } from '#lib/session/enums.ts'
import type {
  ContextReport,
  ContextStats,
  ExchangeEvent,
  ExchangeStep,
  RulingEffect,
  RunStats,
  TrimCounts
} from '#lib/session/exchange-events.ts'
import type { ChatPort } from '../../ai/port.ts'
import { adjudicate } from './adjudicate.ts'
import { raiseCall } from './call.ts'
import type { ExchangeContext } from './context.ts'
import type { Adjudication } from './contract.ts'
import { applyEffect, chooseEffect } from './effect.ts'
import { reply } from './reply.ts'

const noTrims = (): TrimCounts => ({ memory: 0, events: 0, summary: 0, uncovered: 0 })

/** Folds one built context's report into the Exchange's context stats (latest per role; trims summed). */
function addReport(context: ContextStats, report: ContextReport) {
  context.roles[report.role] = report
  for (const key of Object.keys(context.trims) as (keyof TrimCounts)[]) {
    context.trims[key] += report.trims[key]
  }
}

/** The Reply's facts for a ruling, its Check result (if rolled) and what its Effect did. */
function rulingFacts(
  adjudication: Adjudication,
  check: CheckRoll | null,
  change: string | null
): string {
  if (adjudication.outcome === 'impossible') {
    return 'Outcome: the player character cannot do this. Say so in the fiction; nothing changes.'
  }
  const skill = adjudication.outcome === 'check' ? adjudication.skill.replaceAll('_', ' ') : ''
  if (check && !check.success) {
    return `Outcome: the player character tries and fails (a failed ${skill} check). Narrate the failure; nothing changes.`
  }
  const does = check
    ? `Outcome: the player character succeeds (a successful ${skill} check) and does it.`
    : 'Outcome: the player character does it.'
  return [does, ...(change ? [change] : [])].join(' ')
}

/**
 * Where an Exchange starts: a new Declaration, a Check Call the player has just rolled, or a
 * question Call the player has just answered (either Call is already cleared and its answer
 * logged). An answered question carries the clarifying history, this answer included. `effect`
 * is a clicked exit's or NPC's Effect, already checked against the Scene: it replaces the Effect
 * step once the Declaration happens or its Check succeeds, and rides on any Call raised meanwhile.
 */
export type ExchangeStart =
  | { kind: 'declaration'; declaration: SessionEvent; effect?: CarriedEffect }
  | {
      kind: 'check'
      declaration: SessionEvent
      call: CheckCall
      roll: CheckRoll
      effect?: CarriedEffect
    }
  | {
      kind: 'question'
      declaration: SessionEvent
      history: Clarification[]
      effect?: CarriedEffect
    }

/** How an Exchange handed the floor back: a saved Reply, a stopped one, or an open Call. */
export type ExchangeEnd = 'replied' | 'stopped' | 'call'

/**
 * Runs the Exchange, streaming its events. Returns `replied` once the Reply is saved, `stopped`
 * when the player stopped it and `call` when it paused on a Call. Throws on a model failure or
 * an invalid answer.
 */
export async function* runExchange(
  ctx: ExchangeContext,
  start: ExchangeStart
): AsyncGenerator<ExchangeEvent, ExchangeEnd> {
  const { declaration } = start
  const context: ContextStats = { roles: {}, trims: noTrims() }
  const stats: RunStats = { steps: {}, context }
  let step: ExchangeStep = 'adjudication'
  let startedAt = performance.now()
  const current = () =>
    (stats.steps[step] ??= { requests: 0, retries: 0, defaults: 0, latencyMs: 0 })
  /** Starts timing a step; its latency covers every request and retry it makes. */
  const enter = (next: ExchangeStep): ExchangeEvent => {
    step = next
    startedAt = performance.now()
    current()
    ctx.entered?.(next)
    return { type: 'thinking', step }
  }
  const snapshot = (): ExchangeEvent => {
    current().latencyMs = Math.round(performance.now() - startedAt)
    return {
      type: 'stats',
      stats: {
        steps: Object.fromEntries(Object.entries(stats.steps).map(([k, v]) => [k, { ...v }])),
        context: { roles: { ...context.roles }, trims: { ...context.trims } }
      }
    }
  }
  // Every model request is counted against the step that made it, retries included.
  const counted: ChatPort = (request) => {
    current().requests++
    return ctx.port(request)
  }
  const run: ExchangeContext = {
    ...ctx,
    port: counted,
    report: (report) => {
      addReport(context, report)
      ctx.report?.(report)
    },
    tally: (what) => void (what === 'retry' ? current().retries++ : current().defaults++)
  }

  let adjudication: Adjudication
  // A defaulted Adjudication settles Effect `none`.
  let defaulted = false
  let check: CheckRoll | null = null
  let history: Clarification[] = []
  if (start.kind === 'check') {
    const { skill, difficulty } = start.call
    adjudication = { outcome: 'check', skill, difficulty }
    check = start.roll
    history = start.call.history ?? []
  } else {
    if (start.kind === 'question') history = start.history
    yield enter('adjudication')
    ;({ adjudication, defaulted } = await adjudicate(run, declaration, history))
    yield snapshot()
    if (adjudication.outcome === 'check' || adjudication.outcome === 'ask') {
      const event = raiseCall(ctx, declaration, adjudication, history, start.effect)
      yield { type: 'event', event }
      yield { type: 'ruling', adjudication, effect: null }
      return 'call'
    }
  }

  let effect: RulingEffect | null = null
  let change: string | null = null
  const happens = adjudication.outcome === 'happens' || (check !== null && check.success)
  if (happens && defaulted) {
    // A defaulted ruling settles `none`, even over a click's Effect: it never really happened.
    effect = { effect: 'none' }
  } else if (happens && start.effect) {
    // A click already chose the Effect: apply it, with no chooseEffect request. Applying it is
    // still the effect step, so a first-visit move's place generation is counted there.
    yield enter('effect')
    change = yield* applyEffect(run, start.effect)
    effect = start.effect
    yield snapshot()
  } else if (happens) {
    yield enter('effect')
    const chosen = await chooseEffect(run, declaration, history)
    change = yield* applyEffect(run, chosen)
    effect = chosen
    yield snapshot()
  }
  yield { type: 'ruling', adjudication, effect }

  yield enter('reply')
  const replied = yield* reply(run, rulingFacts(adjudication, check, change))
  yield snapshot()
  return replied ? 'replied' : 'stopped'
}
