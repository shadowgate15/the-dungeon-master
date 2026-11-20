import { z } from 'zod'
import {
  ARC_MAX,
  actProblems,
  arcProblems,
  plural,
  planArc,
  skeletonProblems,
  type ArcDraft,
  type ArcFailure,
  type ArcPlan,
  type ArcStep
} from '#lib/arc/arc.ts'
import type { Length, Tone } from '#lib/campaign/enums.ts'
import { callModel, type ChatPort } from '../ai/port.ts'

/**
 * Arc generation as a sequence of small calls driven by code: a skeleton call (title, premise,
 * stakes, resolution, Acts with name and purpose), then one Beats call per Act in Act order.
 * Code plans the counts (`planArc`) and validates every call (`skeletonProblems`, `actProblems`);
 * the assembled draft is checked once more by `arcProblems`. UI-free; the model is reached only
 * through the injected `ChatPort`. Nothing is stored here.
 */

/** The budget of one call (the skeleton, or one Act's Beats), retries included. No overall cap. */
export const ARC_CALL_TIMEOUT_MS = 120_000
const SKELETON_MAX_TOKENS = 1500
const ACT_MAX_TOKENS = 1500
/** The first try plus two retries, per call. */
const MAX_ATTEMPTS = 3
const NOT_JSON = 'the answer was not the requested JSON object'

/** The only repair code makes: trim every string, however deeply nested. */
function trimStrings(value: unknown): unknown {
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value)) return value.map(trimStrings)
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, trimStrings(v)]))
  }
  return value
}

/** The same prompt, plus the rejected answer (when there was one) and what was wrong with it. */
function retryPrompt(prompt: string, rejected: unknown, problems: string[]): string {
  return [
    prompt,
    '',
    `Your previous answer was rejected for these problems: ${problems.join('; ')}`,
    ...(rejected === undefined ? [] : ['The rejected answer:', JSON.stringify(rejected)]),
    'Answer again, fixing every problem.'
  ].join('\n')
}

export interface ArcSeed {
  name: string
  premise: string
  tone: Tone
  length: Length
  worlds: { name: string; premise?: string | null }[]
}

export type { ArcFailure, ArcStep }

export type ArcResult = { ok: true; arc: ArcDraft } | { ok: false; failure: ArcFailure }

export interface GenerateArcOptions {
  /** Cancels the call (the player pressed Stop). */
  signal?: AbortSignal
  /** The deadline of each call, its retries included. Injectable for tests. */
  timeoutMs?: number
  /** Called when a step starts. */
  onProgress?: (step: ArcStep) => void
}

/** How a step is named to the player (and the model), in failure messages. */
const stepName = (step: ArcStep) =>
  step.kind === 'skeleton' ? 'the story plan' : `Act ${step.number} of ${step.of}`

const skeletonSchema = z.object({
  title: z.string(),
  premise: z.string(),
  stakes: z.string(),
  acts: z.array(z.object({ name: z.string(), purpose: z.string() })),
  resolution: z.string()
})
type Skeleton = z.infer<typeof skeletonSchema>

const actSchema = z.object({
  beats: z.array(z.object({ title: z.string(), description: z.string() }))
})
type ActBeats = z.infer<typeof actSchema>

/** One system prompt shared by every call, plus the Campaign Seed with its Worlds. */
function systemPrompts(seed: ArcSeed): string[] {
  const worlds = seed.worlds.length
    ? seed.worlds.map((w) => `- ${w.name}${w.premise ? `: ${w.premise}` : ''}`).join('\n')
    : '- (none)'
  return [
    'You are planning the story of a tabletop role-playing campaign. Write its Arc: the planned shape of the story, which a Dungeon Master will steer by but may deviate from. You write it in small steps, each asking for part of it. Reply with only the JSON object requested.',
    [
      'An Arc has a title, a premise (1 to 3 sentences), the stakes (1 to 3 sentences), an ordered series of Acts, and a resolution (the intended ending, not a Beat).',
      'An Act is a named phase (such as setup, escalation or climax) with a one-line purpose. It holds Beats.',
      'A Beat is a turning point or outcome the story should reach: a title and one or two sentences saying what should become true, never how to get there.',
      `Keep text short: title at most ${ARC_MAX.title} characters, Beat descriptions at most ${ARC_MAX.beatDescription}, Act purposes at most ${ARC_MAX.purpose}.`
    ].join('\n'),
    `Campaign:\n- Name: ${seed.name}\n- Premise: ${seed.premise}\n- Tone: ${seed.tone}\n- Length: ${seed.length}\nWorlds it is set in (stay consistent with them):\n${worlds}`
  ]
}

function skeletonPrompt(plan: ArcPlan): string {
  return `Plan the story. Give the title, premise, stakes, resolution, and exactly ${plural(plan.acts, 'Act')} in order, each with only a name and a purpose (no Beats yet).`
}

function actPrompt(plan: ArcPlan, skeleton: Skeleton, written: ActBeats[], index: number): string {
  const lines = [
    `The story plan:`,
    `Title: ${skeleton.title}`,
    `Premise: ${skeleton.premise}`,
    `Stakes: ${skeleton.stakes}`,
    `Resolution: ${skeleton.resolution}`,
    `Acts:`,
    ...skeleton.acts.map((a, i) => `${i + 1}. ${a.name}: ${a.purpose}`)
  ]
  written.forEach((act, i) => {
    lines.push(
      '',
      `Beats already written for Act ${i + 1} (${skeleton.acts[i].name}):`,
      ...act.beats.map((b, j) => `${j + 1}. ${b.title}: ${b.description}`)
    )
  })
  lines.push(
    '',
    `Write the Beats for Act ${index + 1} of ${plan.acts} (${skeleton.acts[index].name}): exactly ${plural(plan.beats[index], 'Beat')}, as {"beats": [{"title", "description"}]}.`
  )
  if (index === plan.acts - 1) {
    lines.push('This is the last Act: lead the story toward the resolution.')
  }
  return lines.join('\n')
}

const fail = (kind: ArcFailure['kind'], message: string): ArcResult => ({
  ok: false,
  failure: { kind, message }
})

export async function generateArc(
  port: ChatPort,
  seed: ArcSeed,
  options: GenerateArcOptions = {}
): Promise<ArcResult> {
  const controller = new AbortController()
  let outcome: ArcResult | undefined
  const stop = (result: ArcResult) => {
    outcome ??= result
    controller.abort()
  }
  // Resolves when stopped, so a port that ignores its signal cannot hold the run.
  const stopped = new Promise<ArcResult>((resolve) =>
    controller.signal.addEventListener('abort', () => resolve(outcome!))
  )
  const onCancel = () => stop(fail('cancelled', 'The request was stopped'))
  options.signal?.addEventListener('abort', onCancel)
  if (options.signal?.aborted) onCancel()

  /**
   * One step: ask, parse, validate, up to `MAX_ATTEMPTS` times. Only invalid output (bad JSON or
   * rule violations) is retried; each retry is one stateless call with the same prompt plus the
   * rejected answer and its problems. Provider error, timeout, cancel and reasoning-model end the
   * step at once. One deadline covers all the step's attempts; it aborts the generator's controller
   * (the run ends there), and the race against `stopped` frees the run from a port that ignores
   * its signal.
   */
  const runStep = async <T>(
    step: ArcStep,
    request: { prompt: string; maxTokens: number; schema: z.ZodObject & z.ZodType<T> },
    problemsOf: (value: unknown) => string[]
  ): Promise<{ ok: true; value: T } | ArcResult> => {
    // Stopped between steps: no progress, no call.
    if (controller.signal.aborted) return outcome!
    options.onProgress?.(step)
    const timer = setTimeout(
      () => stop(fail('timeout', `The model took too long to write ${stepName(step)}`)),
      options.timeoutMs ?? ARC_CALL_TIMEOUT_MS
    )
    try {
      return await attemptStep(step, request, problemsOf)
    } finally {
      clearTimeout(timer)
    }
  }

  const attemptStep = async <T>(
    step: ArcStep,
    request: { prompt: string; maxTokens: number; schema: z.ZodObject & z.ZodType<T> },
    problemsOf: (value: unknown) => string[]
  ): Promise<{ ok: true; value: T } | ArcResult> => {
    let prompt = request.prompt
    let lastProblems: string[] = []
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      if (controller.signal.aborted) return outcome!
      const raced = await Promise.race([
        callModel(port, {
          systemPrompts: systemPrompts(seed),
          messages: [{ role: 'user', content: prompt }],
          maxTokens: request.maxTokens,
          threadId: crypto.randomUUID(),
          outputSchema: request.schema,
          signal: controller.signal
        }).then((call) => ({ call })),
        stopped.then((result) => ({ result }))
      ])
      if ('result' in raced) return raced.result
      const call = raced.call
      let rejected: unknown
      if (!call.ok) {
        if (call.failure.kind !== 'invalid-output')
          return fail(call.failure.kind, call.failure.message)
        // The provider's own check rejected it (no object to show), so keep its reason.
        lastProblems = [`${NOT_JSON} (${call.failure.message})`]
      } else {
        rejected = call.object
        const trimmed = trimStrings(call.object)
        const parsed = request.schema.safeParse(trimmed)
        // The rule checks accept any shape and say what is wrong (a missing key included), so
        // the retry names the rule rather than just "not the requested object".
        lastProblems = problemsOf(parsed.success ? parsed.data : trimmed)
        if (parsed.success && !lastProblems.length) return { ok: true, value: parsed.data }
        if (!parsed.success && !lastProblems.length) lastProblems = [NOT_JSON]
      }
      prompt = retryPrompt(request.prompt, rejected, lastProblems)
    }
    return fail(
      'invalid-output',
      `${stepName(step)} could not be written: ${lastProblems.join('; ')}`
    )
  }

  try {
    if (controller.signal.aborted) return outcome!
    const plan = planArc(seed.length)

    const skeleton = await runStep(
      { kind: 'skeleton' },
      { prompt: skeletonPrompt(plan), maxTokens: SKELETON_MAX_TOKENS, schema: skeletonSchema },
      (value) => skeletonProblems(value, plan.acts)
    )
    if (!('value' in skeleton)) return skeleton

    const written: ActBeats[] = []
    for (let i = 0; i < plan.acts; i++) {
      const act = await runStep(
        { kind: 'act', number: i + 1, of: plan.acts },
        {
          prompt: actPrompt(plan, skeleton.value, written, i),
          maxTokens: ACT_MAX_TOKENS,
          schema: actSchema
        },
        (value) => actProblems(value, plan.beats[i], i + 1)
      )
      if (!('value' in act)) return act
      written.push(act.value)
    }

    const draft: ArcDraft = {
      title: skeleton.value.title,
      premise: skeleton.value.premise,
      stakes: skeleton.value.stakes,
      resolution: skeleton.value.resolution,
      acts: skeleton.value.acts.map((a, i) => ({ ...a, beats: written[i].beats }))
    }
    // Backstop against assembly bugs; every call has already passed its own checks.
    const problems = arcProblems(draft, seed.length, { generated: true })
    if (problems.length) {
      return fail('invalid-output', `The Arc could not be assembled: ${problems.join('; ')}`)
    }
    return { ok: true, arc: draft }
  } finally {
    options.signal?.removeEventListener('abort', onCancel)
  }
}
