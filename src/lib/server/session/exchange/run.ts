/**
 * One Exchange (ADR 0005): a fixed sequence of steps over a recorded Declaration. Adjudication
 * rules how it resolves; a Check raises a Call, which pauses the Exchange until the player rolls.
 * On happens or a successful Check, Effect picks and code applies the one state change; the Reply
 * streams last, told what was settled. Code owns the order; the model only answers each step.
 */
import type { CheckCall, CheckRoll } from '#lib/session/call.ts'
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
import { raiseCheck } from './call.ts'
import type { ExchangeContext } from './context.ts'
import type { Adjudication } from './contract.ts'
import { applyEffect, chooseEffect } from './effect.ts'
import { reply } from './reply.ts'

const noTrims = (): TrimCounts => ({ memory: 0, events: 0, summary: 0, uncovered: 0 })

/** Folds one built context's report into the run's context stats (latest per role; trims summed). */
function addReport(context: ContextStats, report: ContextReport) {
  context.roles[report.role] = report
  for (const key of Object.keys(context.trims) as (keyof TrimCounts)[]) {
    context.trims[key] += report.trims[key]
  }
}

/** The Reply's facts for a ruling, its Check result (if rolled) and the change its Effect made. */
function outcomeFacts(
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
 * Where an Exchange starts: a new Declaration, or a Check Call the player has just rolled (the
 * Call is already cleared and its result logged). #273 adds an answered question here.
 */
export type ExchangeStart =
  | { kind: 'declaration'; declaration: SessionEvent }
  | { kind: 'check'; declaration: SessionEvent; call: CheckCall; roll: CheckRoll }

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
  const snapshot = (): ExchangeEvent => ({
    type: 'stats',
    stats: {
      steps: Object.fromEntries(Object.entries(stats.steps).map(([k, v]) => [k, { ...v }])),
      context: { roles: { ...context.roles }, trims: { ...context.trims } }
    }
  })
  // Every model request is counted against the step that made it (retries included, for #275).
  const counted: ChatPort = (request) => {
    const current = (stats.steps[step] ??= { requests: 0 })
    current.requests++
    return ctx.port(request)
  }
  const run: ExchangeContext = {
    ...ctx,
    port: counted,
    report: (report) => {
      addReport(context, report)
      ctx.report?.(report)
    }
  }

  let adjudication: Adjudication
  let check: CheckRoll | null = null
  if (start.kind === 'check') {
    const { skill, difficulty } = start.call
    adjudication = { outcome: 'check', skill, difficulty } as Adjudication
    check = start.roll
  } else {
    yield { type: 'thinking', step }
    adjudication = await adjudicate(run, declaration)
    yield snapshot()
    if (adjudication.outcome === 'check') {
      const event = raiseCheck(ctx.sessions, ctx.sessionId, declaration, adjudication)
      yield { type: 'event', event }
      yield { type: 'ruling', adjudication, effect: null }
      return 'call'
    }
  }

  let effect: RulingEffect | null = null
  let change: string | null = null
  // TEMPORARY: a question resolves as happens until #273 gives it its own path.
  const happens =
    adjudication.outcome === 'happens' ||
    adjudication.outcome === 'ask' ||
    (check !== null && check.success)
  if (happens) {
    step = 'effect'
    yield { type: 'thinking', step }
    const chosen = await chooseEffect(run, declaration)
    change = yield* applyEffect(run, chosen)
    effect = chosen
    yield snapshot()
  }
  yield { type: 'ruling', adjudication, effect }

  step = 'reply'
  yield { type: 'thinking', step }
  const replied = yield* reply(run, outcomeFacts(adjudication, check, change))
  yield snapshot()
  return replied ? 'replied' : 'stopped'
}
