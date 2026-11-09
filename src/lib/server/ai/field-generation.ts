import { z } from 'zod'
import {
  ABILITY_KEYS,
  ABILITY_LABELS,
  POINT_BUY,
  STANDARD_ARRAY,
  arrangementProblem,
  type DraftAbilityMethod
} from '#lib/character/ability-scores.ts'
import { callModel, type ChatPort, type ChatRequest } from './port.ts'
import { FIELD_REGISTRY, type FieldRegistry, type FieldSpec } from './field-registry.ts'
import type { FieldRequest } from './field-request.ts'

export { fieldRequestSchema, type FieldRequest } from './field-request.ts'

/**
 * Per-field generation: one stateless model call (plus at most one retry) that writes or
 * revises a single field. UI-free; the model is reached only through the injected
 * `ChatPort`. What each field asks for lives in the registry (`field-registry.ts`).
 *
 * Validation, per call: wrappers stripped, empty rejected, over-long text trimmed to the
 * last sentence boundary, a value identical to the current one rejected. A rejected or
 * unusable answer gets one retry naming the problem; after that, `invalid-output`. The retry
 * shares the single deadline.
 */

export const FIELD_TIMEOUT_MS = 60_000
const MAX_TOKENS = 300

export interface FieldFailure {
  kind:
    | 'timeout'
    | 'no-options'
    | 'context-invalid'
    | 'invalid-output'
    | 'provider-error'
    | 'reasoning-model'
    | 'cancelled'
  message: string
}

export type FieldResult = { ok: true; value: string } | { ok: false; failure: FieldFailure }

export interface RunFieldOptions {
  /** Cancels the call (the player pressed Stop). */
  signal?: AbortSignal
  /** The single deadline, retry included. Injectable for tests. */
  timeoutMs?: number
  registry?: FieldRegistry
  /** Flow context loaded outside the request (e.g. the Campaign's Worlds), added to the system prompts. */
  extraSystemPrompts?: string[]
}

const PREAMBLE =
  'You are helping a player build a tabletop role-playing game. You write or revise exactly one field of a form at a time. Reply with only the value for that field, in the JSON object requested, with no label, quotes or commentary. Keep it consistent with the other fields.'

const fail = (kind: FieldFailure['kind'], message: string): FieldResult => ({
  ok: false,
  failure: { kind, message }
})

/** The prompt context: other fields as `- Label: value`, flagged or invalid values as unset. */
function otherFields(
  flowSpecs: Record<string, FieldSpec>,
  request: FieldRequest,
  values: Record<string, string>
) {
  const lines = Object.entries(flowSpecs)
    .filter(([key, spec]) => key !== request.field && (spec.relevant?.(values) ?? true))
    .map(([key, spec]) => {
      const value = values[key]?.trim()
      const legal = spec.kind === 'enum' ? spec.options(values).includes(value ?? '') : true
      const shown =
        value && spec.kind === 'enum' && spec.display
          ? spec.display(value)
          : value && spec.kind === 'abilities'
            ? showScores(value)
            : value
      return `- ${spec.label}: ${value && legal ? shown : '(unset)'}`
    })
  return `Other fields (the player may have edited them):\n${lines.join('\n')}`
}

const ABILITY_SCORES = z.object(
  Object.fromEntries(ABILITY_KEYS.map((k) => [k, z.number().int()])) as Record<
    (typeof ABILITY_KEYS)[number],
    z.ZodNumber
  >
)

/** Parses an ability-scores value (JSON); null when it is not six whole numbers. */
function parseScores(text: string | undefined) {
  if (!text) return null
  try {
    const parsed = ABILITY_SCORES.safeParse(JSON.parse(text))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

/** The scores as they read in the prompt: `Strength 15, Dexterity 14, ...` (totals only). */
const showScores = (text: string) => {
  const scores = parseScores(text)
  return scores ? ABILITY_KEYS.map((k) => `${ABILITY_LABELS[k]} ${scores[k]}`).join(', ') : text
}

/** The canonical JSON of scores, in ability order, so equal arrangements compare equal. */
const scoresJson = (scores: Record<(typeof ABILITY_KEYS)[number], number>) =>
  JSON.stringify(Object.fromEntries(ABILITY_KEYS.map((k) => [k, scores[k]])))

/** What the model may assign for the chosen method; null when none can be built yet. */
function abilityRule(method: string | undefined, pool: readonly number[]): string | null {
  const m = method as DraftAbilityMethod | undefined
  if (m === 'standard-array') {
    return `Method: standard array. Assign each of ${STANDARD_ARRAY.join(', ')} to exactly one ability.`
  }
  if (m === 'rolling') {
    return pool.length === 6
      ? `Method: rolling. Assign each of the rolled totals ${pool.join(', ')} to exactly one ability.`
      : null
  }
  if (m === 'point-buy') {
    return `Method: point buy. Give each ability a score from ${POINT_BUY.min} to ${POINT_BUY.max}, spending at most ${POINT_BUY.budget} points in total. A score costs: ${Object.entries(
      POINT_BUY.costs
    )
      .map(([score, cost]) => `${score}=${cost}`)
      .join(', ')}.`
  }
  return null
}

function buildRequest(
  spec: FieldSpec,
  flowSpecs: Record<string, FieldSpec>,
  request: FieldRequest,
  options: readonly string[],
  correction: string | null,
  signal: AbortSignal,
  extraSystemPrompts: string[] = [],
  abilityPool: readonly number[] = []
): ChatRequest {
  const values: Record<string, string> = request.values
  const system = [
    `${PREAMBLE}\n${spec.instruction}${spec.kind === 'enum' ? `\nAllowed values: ${options.join(', ')}.` : ''}`,
    ...extraSystemPrompts,
    otherFields(flowSpecs, request, values)
  ]
  if (spec.kind === 'abilities') {
    system.splice(1, 0, abilityRule(values.abilityMethod, abilityPool) ?? '')
  }
  if (request.mode === 'feedback') {
    const current =
      spec.kind === 'enum' && spec.display
        ? spec.display(request.current ?? '')
        : spec.kind === 'abilities'
          ? showScores(request.current ?? '')
          : request.current
    system.push(
      `Current value of ${spec.label}: ${current}\nThe player's note: ${request.note}\nRewrite it to follow the note; do not return the same text.`
    )
  }
  const task =
    request.mode === 'feedback' ? `Revise the ${spec.label}.` : `Write the ${spec.label}.`
  return {
    systemPrompts: system,
    messages: [
      {
        role: 'user',
        content: correction ? `${task} Your previous answer was rejected: ${correction}` : task
      }
    ],
    maxTokens: MAX_TOKENS,
    threadId: crypto.randomUUID(),
    // One key, and no `maxLength`: length is steered by the prompt and trimmed in code.
    outputSchema:
      spec.kind === 'abilities'
        ? z.object({ scores: ABILITY_SCORES })
        : z.object({
            value: spec.kind === 'enum' ? z.enum(options as [string, ...string[]]) : z.string()
          }),
    signal
  }
}

/** Removes the wrappers small models add: code fences, bold or heading markers, quotes. */
export function stripWrappers(text: string): string {
  let out = text.trim()
  out = out.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/, '')
  out = out.replace(/^#{1,6}\s+/, '').replace(/(\*\*|__)(.*?)\1/gs, '$2')
  let previous: string
  do {
    previous = out
    out = out.trim().replace(/^(["'`“‘])(.*)(["'`”’])$/s, '$2')
  } while (out !== previous)
  return out.trim()
}

/** Cuts `text` at the last sentence end that fits in `max` characters, or null if none does. */
function trimToSentence(text: string, max: number): string | null {
  let end = -1
  for (const match of text.matchAll(/[.!?]+["')\]”’]*(?=\s|$)/g)) {
    const stop = match.index + match[0].length
    if (stop > max) break
    end = stop
  }
  return end > 0 ? text.slice(0, end).trim() : null
}

type Checked = { ok: true; value: string } | { ok: false; problem: string }

function checkScores(
  raw: unknown,
  method: string | undefined,
  pool: readonly number[],
  same: string
): Checked {
  const parsed = z.object({ scores: ABILITY_SCORES }).safeParse(raw)
  if (!parsed.success) return { ok: false, problem: 'the answer was not the requested JSON object' }
  const problem = arrangementProblem(method as DraftAbilityMethod, parsed.data.scores, pool)
  if (problem) return { ok: false, problem }
  const value = scoresJson(parsed.data.scores)
  const current = parseScores(same)
  if (current && scoresJson(current) === value) {
    return {
      ok: false,
      problem: 'it was identical to the current scores; arrange them differently'
    }
  }
  return { ok: true, value }
}

function check(spec: FieldSpec, raw: unknown, options: readonly string[], same: string): Checked {
  const parsed = z.object({ value: z.string() }).safeParse(raw)
  if (!parsed.success) return { ok: false, problem: 'the answer was not the requested JSON object' }
  let value = stripWrappers(parsed.data.value)
  if (!value) return { ok: false, problem: 'the value was empty' }
  if (spec.kind === 'enum') {
    if (!options.includes(value)) {
      return {
        ok: false,
        problem: `"${value}" is not allowed; choose one of: ${options.join(', ')}`
      }
    }
  } else if (spec.kind === 'text' && value.length > spec.maxChars) {
    const trimmed = trimToSentence(value, spec.maxChars)
    if (!trimmed) {
      return {
        ok: false,
        problem: `it was longer than ${spec.maxChars} characters; make it shorter`
      }
    }
    value = trimmed
  }
  if (same && value === same.trim()) {
    return { ok: false, problem: 'it was identical to the current value; write a different one' }
  }
  return { ok: true, value }
}

export async function runField(
  port: ChatPort,
  request: FieldRequest,
  options: RunFieldOptions = {}
): Promise<FieldResult> {
  const flowSpecs = (options.registry ?? FIELD_REGISTRY)[request.flow]
  const spec = flowSpecs?.[request.field]
  if (!spec) return fail('context-invalid', `Unknown field ${request.flow}.${request.field}`)

  const values: Record<string, string> = request.values
  if (request.mode === 'feedback') {
    if (!request.current?.trim()) {
      return fail('context-invalid', 'There is nothing to give feedback on yet')
    }
    if (!request.note?.trim()) return fail('context-invalid', 'The feedback note is empty')
  }
  const legal = spec.kind === 'enum' ? spec.options(values) : []
  if (spec.kind === 'enum' && legal.length === 0) {
    return fail('no-options', `There are no options for ${spec.label} yet`)
  }
  const pool = request.flow === 'character' ? (request.rolledTotals ?? []) : []
  if (spec.kind === 'abilities' && !abilityRule(values.abilityMethod, pool)) {
    return fail(
      'no-options',
      values.abilityMethod === 'rolling'
        ? 'Roll your ability scores first'
        : 'Choose an ability score method first'
    )
  }
  // The value a result must differ from: the feedback's current value, else what is in the form.
  const same = request.mode === 'feedback' ? (request.current ?? '') : (values[request.field] ?? '')

  const controller = new AbortController()
  let outcome: FieldResult | undefined
  const stop = (result: FieldResult) => {
    outcome ??= result
    controller.abort()
  }
  // Resolves when stopped, so a port that ignores its signal cannot hold the call.
  const stopped = new Promise<FieldResult>((resolve) =>
    controller.signal.addEventListener('abort', () => resolve(outcome!))
  )
  const onCancel = () => stop(fail('cancelled', 'The request was stopped'))
  const timer = setTimeout(
    () => stop(fail('timeout', 'The model took too long to reply')),
    options.timeoutMs ?? FIELD_TIMEOUT_MS
  )
  options.signal?.addEventListener('abort', onCancel)
  if (options.signal?.aborted) onCancel()

  const attempt = async (correction: string | null): Promise<Checked | FieldResult> => {
    const call = await callModel(
      port,
      buildRequest(
        spec,
        flowSpecs,
        request,
        legal,
        correction,
        controller.signal,
        options.extraSystemPrompts,
        pool
      )
    )
    if (!call.ok) {
      return call.failure.kind === 'invalid-output'
        ? { ok: false, problem: 'the answer was not usable' }
        : fail(call.failure.kind, call.failure.message)
    }
    return spec.kind === 'abilities'
      ? checkScores(call.object, values.abilityMethod, pool, same)
      : check(spec, call.object, legal, same)
  }
  const isCheck = (r: Checked | FieldResult): r is Checked => !('failure' in r)

  try {
    if (controller.signal.aborted) return outcome!
    let problem: string | null = null
    for (let tries = 0; tries < 2; tries++) {
      const result: Checked | FieldResult = await Promise.race([attempt(problem), stopped])
      if (!isCheck(result)) return result
      if (result.ok) return { ok: true, value: result.value }
      problem = result.problem
    }
    return fail('invalid-output', `The model did not return a usable value: ${problem}`)
  } finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', onCancel)
  }
}
