import { z } from 'zod'
import { callModel, type ChatPort, type ChatRequest } from './port.ts'
import type { EquipmentValue } from '#lib/character/ai-groups.ts'
import {
  characterGroupSpec,
  describeCurrent,
  FIELD_REGISTRY,
  type EquipmentFieldSpec,
  type FieldRegistry,
  type FieldSpec,
  type PicksFieldSpec,
  type TextFieldSpec,
  type EnumFieldSpec
} from './field-registry.ts'
import { isGroupField } from '#lib/character/ai-groups.ts'
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

/** What a call writes: text or a slug for most fields, a list of slugs or an equipment option for pick groups. */
export type FieldValue = string | string[] | EquipmentValue

export type FieldResult = { ok: true; value: FieldValue } | { ok: false; failure: FieldFailure }

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
      const shown = value && spec.kind === 'enum' && spec.display ? spec.display(value) : value
      return `- ${spec.label}: ${value && legal ? shown : '(unset)'}`
    })
  return `Other fields (the player may have edited them):\n${lines.join('\n')}`
}

/** The one-key (or, for equipment, two-key) output schema of a field. */
function outputSchema(spec: FieldSpec, options: readonly string[]): z.ZodObject {
  if (spec.kind === 'picks') {
    const slugs = spec.options.map((o) => o.slug) as [string, ...string[]]
    return z.object({
      values: z.array(z.enum(slugs)).min(spec.count).max(spec.count).meta({ uniqueItems: true })
    })
  }
  if (spec.kind === 'equipment') {
    const legal = spec.group.options.filter((o) => !o.disabled)
    const items = [
      ...new Set(Object.values(spec.group.items).flatMap((list) => list.map((i) => i.slug)))
    ]
    const slots = Math.max(0, ...legal.map((o) => o.slots.length))
    return z.object({
      option: z
        .number()
        .int()
        .min(0)
        .max(spec.group.options.length - 1),
      wild: (items.length
        ? z.array(z.enum(items as [string, ...string[]]))
        : z.array(z.string())
      ).max(slots)
    })
  }
  return z.object({
    value: spec.kind === 'enum' ? z.enum(options as [string, ...string[]]) : z.string()
  })
}

function buildRequest(
  spec: FieldSpec,
  flowSpecs: Record<string, FieldSpec>,
  request: FieldRequest,
  options: readonly string[],
  correction: string | null,
  signal: AbortSignal,
  extraSystemPrompts: string[] = []
): ChatRequest {
  const values: Record<string, string> = request.values
  const system = [
    `${PREAMBLE}\n${spec.instruction}${spec.kind === 'enum' ? `\nAllowed values: ${options.join(', ')}.` : ''}`,
    ...extraSystemPrompts,
    otherFields(flowSpecs, request, values)
  ]
  if (request.mode === 'feedback') {
    const current =
      spec.kind === 'picks' || spec.kind === 'equipment'
        ? describeCurrent(spec)
        : spec.kind === 'enum' && spec.display
          ? spec.display(request.current ?? '')
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
    outputSchema: outputSchema(spec, options),
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

type Checked = { ok: true; value: FieldValue } | { ok: false; problem: string }

/** A comparable form of a value, to tell whether a result is the same as what is in the form. */
const canon = (value: FieldValue | null | undefined): string =>
  value === null || value === undefined
    ? ''
    : typeof value === 'string'
      ? value.trim()
      : Array.isArray(value)
        ? [...value].sort().join(',')
        : `${value.option}:${value.wild.join(',')}`

function checkPicks(spec: PicksFieldSpec, raw: unknown): Checked {
  const parsed = z.object({ values: z.array(z.string()) }).safeParse(raw)
  if (!parsed.success) return { ok: false, problem: 'the answer was not the requested JSON object' }
  const values = parsed.data.values.map((v) => stripWrappers(v))
  const legal = new Set(spec.options.map((o) => o.slug))
  const illegal = values.filter((v) => !legal.has(v))
  if (illegal.length) {
    return {
      ok: false,
      problem: `${illegal.map((v) => `"${v}"`).join(', ')} not allowed; choose only from: ${[...legal].join(', ')}`
    }
  }
  if (new Set(values).size !== values.length) {
    return { ok: false, problem: 'a value was picked more than once; every pick must differ' }
  }
  if (values.length !== spec.count) {
    return { ok: false, problem: `${values.length} picks were given; choose exactly ${spec.count}` }
  }
  return { ok: true, value: values }
}

function checkEquipment(spec: EquipmentFieldSpec, raw: unknown): Checked {
  const parsed = z.object({ option: z.number().int(), wild: z.array(z.string()) }).safeParse(raw)
  if (!parsed.success) return { ok: false, problem: 'the answer was not the requested JSON object' }
  const { option, wild } = parsed.data
  const chosen = spec.group.options[option]
  if (!chosen || chosen.disabled) {
    const legal = spec.group.options.filter((o) => !o.disabled).map((o) => o.index)
    return {
      ok: false,
      problem: `option ${option} is not allowed; choose one of: ${legal.join(', ')}`
    }
  }
  if (wild.length !== chosen.slots.length) {
    return {
      ok: false,
      problem: `option ${option} needs exactly ${chosen.slots.length} wild item(s), but ${wild.length} were given`
    }
  }
  for (let i = 0; i < wild.length; i++) {
    const item = stripWrappers(wild[i])
    if (!spec.group.items[chosen.slots[i]]?.some((x) => x.slug === item)) {
      return {
        ok: false,
        problem: `"${item}" is not a legal ${chosen.slots[i]} item for wild slot ${i + 1}`
      }
    }
    wild[i] = item
  }
  return { ok: true, value: { option, wild } }
}

function check(spec: FieldSpec, raw: unknown, options: readonly string[], same: string): Checked {
  const checked =
    spec.kind === 'picks'
      ? checkPicks(spec, raw)
      : spec.kind === 'equipment'
        ? checkEquipment(spec, raw)
        : checkValue(spec, raw, options)
  if (checked.ok && same && canon(checked.value) === same) {
    return { ok: false, problem: 'it was identical to the current value; write a different one' }
  }
  return checked
}

function checkValue(
  spec: TextFieldSpec | EnumFieldSpec,
  raw: unknown,
  options: readonly string[]
): Checked {
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
  } else if (value.length > spec.maxChars) {
    const trimmed = trimToSentence(value, spec.maxChars)
    if (!trimmed) {
      return {
        ok: false,
        problem: `it was longer than ${spec.maxChars} characters; make it shorter`
      }
    }
    value = trimmed
  }
  return { ok: true, value }
}

export async function runField(
  port: ChatPort,
  request: FieldRequest,
  options: RunFieldOptions = {}
): Promise<FieldResult> {
  const flowSpecs = (options.registry ?? FIELD_REGISTRY)[request.flow]
  const values: Record<string, string> = request.values
  const group =
    request.flow === 'character' && flowSpecs?.[request.field] === undefined
      ? characterGroupSpec(request.field, values, request.choices)
      : undefined
  const spec = flowSpecs?.[request.field] ?? group
  if (!spec) {
    // A pick group the draft does not have (or has no legal options for) is `no-options`.
    return request.flow === 'character' && isGroupField(request.field)
      ? fail('no-options', 'There is nothing to choose from for this yet')
      : fail('context-invalid', `Unknown field ${request.flow}.${request.field}`)
  }

  const currentGroup =
    spec.kind === 'picks'
      ? canon(spec.current)
      : spec.kind === 'equipment'
        ? canon(spec.group.current)
        : ''
  if (request.mode === 'feedback') {
    const hasCurrent = group ? !!currentGroup : !!request.current?.trim()
    if (!hasCurrent) return fail('context-invalid', 'There is nothing to give feedback on yet')
    if (!request.note?.trim()) return fail('context-invalid', 'The feedback note is empty')
  }
  const legal = spec.kind === 'enum' ? spec.options(values) : []
  if (spec.kind === 'enum' && legal.length === 0) {
    return fail('no-options', `There are no options for ${spec.label} yet`)
  }
  // The value a result must differ from: the feedback's current value, else what is in the form.
  const same = group
    ? currentGroup
    : request.mode === 'feedback'
      ? (request.current ?? '').trim()
      : (values[request.field] ?? '').trim()

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
        options.extraSystemPrompts
      )
    )
    if (!call.ok) {
      return call.failure.kind === 'invalid-output'
        ? { ok: false, problem: 'the answer was not usable' }
        : fail(call.failure.kind, call.failure.message)
    }
    return check(spec, call.object, legal, same)
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
