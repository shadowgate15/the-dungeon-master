import type { AiStatus } from '#lib/ai/status.ts'

/** A typed failure for a probe that is not ready. */
export interface UnavailableFailure {
  kind: 'not-connected' | 'model-unavailable'
  message: string
}

/** The typed failure for a probe that is not ready, or null when the model can be used. */
export function unavailableFailure(status: AiStatus): UnavailableFailure | null {
  switch (status.state) {
    case 'unreachable':
      return { kind: 'not-connected', message: 'Not connected to LM Studio' }
    case 'model-unavailable':
      return {
        kind: 'model-unavailable',
        message: `The model ${status.model} is not available in LM Studio`
      }
    default:
      return null
  }
}
