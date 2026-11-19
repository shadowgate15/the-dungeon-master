/**
 * Test-only: a scripted chat port. Each model call takes the next script from the queue; a script
 * is a function over the request that yields AG-UI style events, exactly what the production port
 * yields. Requests are recorded so a test can assert what the model was (or was not) asked.
 */
import type { ChatPort, ChatRequest } from '../server/ai/port'

export type Script = (request: ChatRequest) => AsyncGenerator<unknown>

export const delta = (text: string) => ({ type: 'TEXT_MESSAGE_CONTENT', delta: text })
export const finished = { type: 'RUN_FINISHED' }

/** Streams the parts as text deltas, then finishes. */
export const says = (...parts: string[]): Script =>
  async function* () {
    for (const part of parts) yield delta(part)
    yield finished
  }

/** Answers a structured-output call with this object (what the production port yields). */
export const answers = (object: unknown): Script =>
  async function* () {
    yield { type: 'CUSTOM', name: 'structured-output.complete', value: { object } }
    yield finished
  }

/** Streams one piece, then waits until aborted (a long step the player stops). */
export const hangsAfter = (part: string): Script =>
  async function* (request) {
    yield delta(part)
    if (request.signal.aborted) return
    await new Promise<void>((resolve) => request.signal.addEventListener('abort', () => resolve()))
  }

/** Streams a half-written reply, then fails. */
export const fails: Script = async function* () {
  yield delta('Half a sent')
  yield { type: 'RUN_ERROR', message: 'model fell over' }
}

export function createScriptedPort(initial: Script[] = []) {
  const scripts = [...initial]
  const requests: ChatRequest[] = []
  const port: ChatPort = (request) => {
    requests.push(request)
    const script = scripts.shift()
    if (!script) throw new Error('no script left')
    return script(request)
  }
  return {
    port,
    requests,
    /** Queues scripts for the next model calls. */
    enqueue: (...more: Script[]) => void scripts.push(...more)
  }
}
