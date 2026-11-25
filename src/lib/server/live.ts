import type { LiveMessage } from '#lib/live/messages.ts'
import type { Sessions } from './bridge/sessions'

/** Where the browser's live updates stream lives. */
export const LIVE_STREAM = '/api/events'

type Listener = (message: LiveMessage) => void

const encoder = new TextEncoder()

/**
 * The one SSE stream that keeps every browser tab current: each message names a state change the
 * browser answers by invalidating its TanStack Query caches. Session attach and detach are pushed
 * as they happen; later state changes are pushed with `publish`.
 */
export function createLiveUpdates({ sessions }: { sessions: Sessions }) {
  const listeners = new Set<Listener>()

  function publish(message: LiveMessage) {
    for (const listener of listeners) listener(message)
  }

  sessions.onChange(({ campaign, attached }) => publish({ type: 'session', campaign, attached }))

  return {
    publish,

    /** A browser's stream, until it hangs up. */
    stream(): Response {
      let stop = () => {}
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          const write = (text: string) => controller.enqueue(encoder.encode(text))
          write(': open\n\n')
          const listener: Listener = (message) => write(`data: ${JSON.stringify(message)}\n\n`)
          listeners.add(listener)
          const keepAlive = setInterval(() => write(': ka\n\n'), 15_000)
          stop = () => {
            listeners.delete(listener)
            clearInterval(keepAlive)
          }
        },
        cancel: () => stop()
      })
      return new Response(body, {
        headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' }
      })
    }
  }
}

export type LiveUpdates = ReturnType<typeof createLiveUpdates>
