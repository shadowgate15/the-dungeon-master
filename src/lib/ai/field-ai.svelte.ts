import { unavailableReason, type AiStatusStore } from './ai-status.svelte.ts'
import type { AiStatus } from './status.ts'

/**
 * Client-side state for per-field AI: one controller per form, one entry per field. Each field
 * has its own pending state, abort controller and one-step Undo, so several fields can be
 * generating at once and results can land in any order. Call it during component init (it
 * aborts every in-flight request when the component is destroyed and discards their results).
 *
 * `field(name)` returns exactly the props `FieldAi` needs, ready to spread:
 *
 *     <FieldAi {...ai.field('name')} label="Name" kind="text" bind:value={seed.name} />
 *
 * The flow supplies how to read and write values and, optionally, why a field is blocked
 * (archived, no legal options). Availability comes from the shared `createAiStatus()` store.
 */

type Failure = { kind: string; message: string }
type Mode = 'generate' | 'feedback'
type Call = { mode: Mode; note?: string }

class FieldState {
  status = $state<'idle' | 'loading' | 'error'>('idle')
  error = $state('')
  retryable = $state(true)
  /** The value an AI write replaced and the value it wrote; Undo expires when they diverge. */
  undo = $state<{ previous: string; written: string; snapshot?: unknown; version?: unknown }>()
  controller?: AbortController
  last?: Call
}

export interface FieldAiOptions<F extends string> {
  /** The flow in the request body, e.g. 'world'. */
  flow: string
  ai: AiStatusStore
  /** The form's live values (all fields, empty string for unset): the request's context. */
  values: () => Record<F, string>
  /** Extra request-body keys the flow needs beyond the field values (e.g. the Campaign's World ids). */
  extra?: () => Record<string, unknown>
  /** Writes a value into the form (AI result or Undo). */
  set: (field: F, value: string) => void
  /**
   * For flows where one write can change other fields (the Character's reconcile-and-flag
   * path): `snapshot` captures everything an AI write may touch just before it, `restore` puts
   * it back on Undo, and `version` returns a token that changes on every edit of the form, so
   * Undo expires on the next edit (of any field) instead of when this field's value changes.
   */
  snapshot?: () => unknown
  restore?: (snapshot: unknown) => void
  version?: () => unknown
  /** Archived or read-only: both icons disabled with this reason, and the field read-only. */
  readonlyReason?: () => string | undefined
  /** A per-field reason the field cannot be generated now (e.g. "Choose a class first"). */
  blockedReason?: (field: F) => string | undefined
}

const MESSAGES: Record<string, string> = {
  timeout: 'The model took too long to answer. Your value is unchanged.',
  'invalid-output': 'The AI gave an unusable answer. Your value is unchanged.',
  'provider-error': 'The AI could not answer. Your value is unchanged.',
  'no-options': 'There is nothing to choose from yet.'
}

/** Failures Retry cannot fix. */
const NOT_RETRYABLE = new Set(['no-options', 'context-invalid'])

export function createFieldAi<F extends string>(options: FieldAiOptions<F>) {
  // The map is plain (entries are created while rendering); each entry is its own reactive object.
  const states: Partial<Record<F, FieldState>> = {}

  function state(field: F): FieldState {
    return (states[field] ??= new FieldState())
  }

  function fail(s: FieldState, failure: Failure | string, retryable = true) {
    const kind = typeof failure === 'string' ? '' : failure.kind
    s.status = 'error'
    s.error =
      typeof failure === 'string' ? failure : (MESSAGES[kind] ?? failure.message ?? 'Failed.')
    s.retryable = retryable && !NOT_RETRYABLE.has(kind)
  }

  async function run(field: F, call: Call) {
    const s = state(field)
    s.controller?.abort()
    const controller = new AbortController()
    s.controller = controller
    s.last = call
    s.status = 'loading'
    s.error = ''
    const current = options.values()[field]
    // A superseded, stopped or abandoned call must not touch the field.
    const stale = () => s.controller !== controller

    try {
      const response = await fetch('/api/ai/field', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          flow: options.flow,
          field,
          mode: call.mode,
          values: options.values(),
          ...options.extra?.(),
          ...(call.mode === 'feedback' ? { current, note: call.note } : {})
        })
      })
      const result = (await response.json().catch(() => null)) as
        | { ok: true; value: string }
        | { ok: false; failure: Failure; status?: AiStatus }
        | { error: string }
        | null
      if (stale()) return
      s.controller = undefined

      if (result && 'ok' in result && result.ok) {
        s.status = 'idle'
        const snapshot = options.snapshot?.()
        options.set(field, result.value)
        s.undo = {
          previous: current,
          written: result.value,
          snapshot,
          version: options.version?.()
        }
      } else if (result && 'ok' in result) {
        if (result.failure.kind === 'reasoning-model') options.ai.reasoningModel()
        if (result.status) options.ai.unavailable(result.status)
        if (result.failure.kind === 'cancelled') s.status = 'idle'
        else fail(s, result.failure)
      } else {
        fail(s, result && 'error' in result ? result.error : 'The AI could not answer.')
      }
    } catch {
      if (stale()) return
      s.controller = undefined
      fail(s, 'Could not reach the server. Your value is unchanged.')
    }
  }

  /** Aborts everything in flight and discards the results. */
  function abortAll() {
    for (const s of Object.values<FieldState | undefined>(states)) {
      if (!s) continue
      const controller = s.controller
      s.controller = undefined
      if (controller) s.status = 'idle'
      controller?.abort()
    }
  }

  // Leaving the form aborts everything in flight and discards the results.
  $effect(() => abortAll)

  return {
    abortAll,
    /** The props for one `FieldAi`. */
    field(field: F) {
      const s = state(field)
      const blocked = () => options.readonlyReason?.() ?? options.blockedReason?.(field)
      return {
        get status() {
          return s.status
        },
        get error() {
          return s.error
        },
        get retryable() {
          return s.retryable
        },
        get canUndo() {
          if (!s.undo) return false
          return options.version
            ? options.version() === s.undo.version
            : options.values()[field] === s.undo.written
        },
        get readonly() {
          return !!options.readonlyReason?.()
        },
        get disabledReason() {
          return unavailableReason(options.ai.status) ?? blocked()
        },
        onGenerate: () => run(field, { mode: 'generate' }),
        onFeedback: (note: string) => run(field, { mode: 'feedback', note }),
        onStop: () => {
          const controller = s.controller
          s.controller = undefined
          s.status = 'idle'
          controller?.abort()
        },
        onRetry: () => {
          if (s.last) void run(field, s.last)
        },
        onDismiss: () => {
          s.status = 'idle'
          s.error = ''
        },
        onUndo: () => {
          if (!s.undo) return
          if (s.undo.snapshot !== undefined) options.restore?.(s.undo.snapshot)
          else options.set(field, s.undo.previous)
          s.undo = undefined
        }
      }
    }
  }
}

export type FieldAi<F extends string> = ReturnType<typeof createFieldAi<F>>

/** Props for a control with no AI behind it (a form rendered without a controller): disabled. */
export function inertFieldAi(reason: string) {
  const noop = () => {}
  return {
    status: 'idle' as const,
    error: '',
    retryable: true,
    canUndo: false,
    readonly: false,
    disabledReason: reason,
    onGenerate: noop,
    onFeedback: noop,
    onStop: noop,
    onRetry: noop,
    onDismiss: noop,
    onUndo: noop
  }
}
