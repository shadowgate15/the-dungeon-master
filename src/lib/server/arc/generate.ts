import { z } from 'zod'
import {
  ARC_MAX,
  GENERATED_BEATS_PER_ACT,
  arcProblems,
  sizeText,
  type ArcDraft
} from '#lib/arc/arc.ts'
import type { Length, Tone } from '#lib/campaign/enums.ts'
import { callModel, type ChatPort } from '../ai/port.ts'

/**
 * Whole-Arc generation: one structured call from the Campaign Seed, validated by code (shape,
 * size ranges, text lengths) and retried once with the problem named. UI-free; the model is
 * reached only through the injected `ChatPort`. Nothing is stored here.
 */

export const ARC_TIMEOUT_MS = 180_000
const MAX_TOKENS = 3500

export interface ArcSeed {
  name: string
  premise: string
  tone: Tone
  length: Length
  worlds: { name: string; premise?: string | null }[]
}

export interface ArcFailure {
  kind: 'timeout' | 'invalid-output' | 'provider-error' | 'reasoning-model' | 'cancelled'
  message: string
}

export type ArcResult = { ok: true; arc: ArcDraft } | { ok: false; failure: ArcFailure }

export interface GenerateArcOptions {
  /** Cancels the call (the player pressed Stop). */
  signal?: AbortSignal
  /** The single deadline, retry included. Injectable for tests. */
  timeoutMs?: number
}

const outputSchema = z.object({
  title: z.string(),
  premise: z.string(),
  stakes: z.string(),
  acts: z.array(
    z.object({
      name: z.string(),
      purpose: z.string(),
      beats: z.array(z.object({ title: z.string(), description: z.string() }))
    })
  ),
  resolution: z.string()
})

function systemPrompts(seed: ArcSeed): string[] {
  const worlds = seed.worlds.length
    ? seed.worlds.map((w) => `- ${w.name}${w.premise ? `: ${w.premise}` : ''}`).join('\n')
    : '- (none)'
  const [lo, hi] = GENERATED_BEATS_PER_ACT
  return [
    'You are planning the story of a tabletop role-playing campaign. Write its Arc: the planned shape of the story, which a Dungeon Master will steer by but may deviate from. Reply with only the JSON object requested.',
    [
      'An Arc has a title, a premise (1 to 3 sentences), the stakes (1 to 3 sentences), an ordered series of Acts, and a resolution (the intended ending, not a Beat).',
      'An Act is a named phase (such as setup, escalation or climax) with a one-line purpose. It holds Beats.',
      'A Beat is a turning point or outcome the story should reach: a title and one or two sentences saying what should become true, never how to get there.',
      `Size: ${sizeText(seed.length)}, with ${lo} to ${hi} Beats in each Act.`,
      `Keep text short: title at most ${ARC_MAX.title} characters, Beat descriptions at most ${ARC_MAX.beatDescription}, Act purposes at most ${ARC_MAX.purpose}.`
    ].join('\n'),
    `Campaign:\n- Name: ${seed.name}\n- Premise: ${seed.premise}\n- Tone: ${seed.tone}\n- Length: ${seed.length}\nWorlds it is set in (stay consistent with them):\n${worlds}`
  ]
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
  // Resolves when stopped, so a port that ignores its signal cannot hold the call.
  const stopped = new Promise<ArcResult>((resolve) =>
    controller.signal.addEventListener('abort', () => resolve(outcome!))
  )
  const onCancel = () => stop(fail('cancelled', 'The request was stopped'))
  const timer = setTimeout(
    () => stop(fail('timeout', 'The model took too long to reply')),
    options.timeoutMs ?? ARC_TIMEOUT_MS
  )
  options.signal?.addEventListener('abort', onCancel)
  if (options.signal?.aborted) onCancel()

  type Attempt = { ok: true; arc: ArcDraft } | { ok: false; problem: string } | ArcResult
  const attempt = async (correction: string | null): Promise<Attempt> => {
    const call = await callModel(port, {
      systemPrompts: systemPrompts(seed),
      messages: [
        {
          role: 'user',
          content: correction
            ? `Write the Arc. Your previous answer was rejected: ${correction}`
            : 'Write the Arc.'
        }
      ],
      maxTokens: MAX_TOKENS,
      threadId: crypto.randomUUID(),
      outputSchema,
      signal: controller.signal
    })
    if (!call.ok) {
      return call.failure.kind === 'invalid-output'
        ? { ok: false, problem: 'the answer was not the requested JSON object' }
        : fail(call.failure.kind, call.failure.message)
    }
    const parsed = outputSchema.safeParse(call.object)
    if (!parsed.success) {
      return { ok: false, problem: 'the answer was not the requested JSON object' }
    }
    const problems = arcProblems(parsed.data, seed.length, { generated: true })
    return problems.length
      ? { ok: false, problem: problems.join('; ') }
      : { ok: true, arc: parsed.data }
  }

  try {
    if (controller.signal.aborted) return outcome!
    let problem = ''
    for (let tries = 0; tries < 2; tries++) {
      const result = await Promise.race([attempt(problem || null), stopped])
      if ('failure' in result) return result
      if (result.ok && 'arc' in result) return { ok: true, arc: result.arc }
      problem = (result as { problem: string }).problem
    }
    return fail('invalid-output', `The model did not return a usable Arc: ${problem}`)
  } finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', onCancel)
  }
}
