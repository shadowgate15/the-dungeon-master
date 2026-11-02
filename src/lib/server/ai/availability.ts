import type { AiStatus } from '#lib/ai/status.ts'
import type { TurnFailure } from './world-conversation.ts'

/** The typed failure for a probe that is not ready, or null when the model can be used. */
export function unavailableFailure(status: AiStatus): TurnFailure | null {
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
