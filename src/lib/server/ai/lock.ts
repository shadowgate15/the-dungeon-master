import type { AiStatus } from '#lib/ai/status.ts'

/**
 * Once a turn shows the model is a reasoning model, AI controls stay disabled until the
 * user re-probes successfully ("Check connection") or the server restarts. In-memory on
 * purpose: a restart is how the operator signals they changed the model.
 */
export function createReasoningLock(probe: () => Promise<AiStatus>) {
  let model: string | null = null
  return {
    get locked() {
      return model !== null
    },
    engage(name: string) {
      model = name
    },
    /** Plain reads report the lock; only an explicit `recheck` probes and may release it. */
    async status({ recheck = false } = {}): Promise<AiStatus> {
      if (model === null) return probe()
      if (!recheck) return { state: 'reasoning-model', model }
      const result = await probe()
      if (result.state === 'ready') {
        model = null
        return result
      }
      return { state: 'reasoning-model', model }
    }
  }
}
