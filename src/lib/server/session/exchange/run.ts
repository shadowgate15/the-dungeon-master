/**
 * One Exchange (ADR 0005): a fixed sequence of steps over a recorded Declaration. Adjudication
 * rules how it resolves; on happens, Effect picks and code applies the one state change; the Reply
 * streams last, told what was settled. Code owns the order; the model only answers each step.
 */
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

/** The Reply's facts for a ruling and the change its Effect made (if any). */
function outcomeFacts(adjudication: Adjudication, change: string | null): string {
  if (adjudication.outcome === 'impossible') {
    return 'Outcome: the player character cannot do this. Say so in the fiction; nothing changes.'
  }
  return ['Outcome: the player character does it.', ...(change ? [change] : [])].join(' ')
}

/**
 * Runs the Exchange for a recorded Declaration, streaming its events. Returns true once the Reply
 * is saved, false when the player stopped it. Throws on a model failure or an invalid answer.
 */
export async function* runExchange(
  ctx: ExchangeContext,
  declaration: SessionEvent
): AsyncGenerator<ExchangeEvent, boolean> {
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

  yield { type: 'thinking', step }
  const adjudication = await adjudicate(run, declaration)
  yield snapshot()

  let effect: RulingEffect | null = null
  let change: string | null = null
  // TEMPORARY: a Check or a question resolves as happens until #272 (Checks as Calls) and #273
  // (questions) give them their own paths. Remove this fallback with those tickets.
  const happens = adjudication.outcome !== 'impossible'
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
  const replied = yield* reply(run, outcomeFacts(adjudication, change))
  yield snapshot()
  return replied
}
