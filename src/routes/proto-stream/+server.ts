// PROTOTYPE (throwaway): streaming transport + Stop for the session runner. Wipe me.
import type { RequestHandler } from './$types'

type Turn = { seq: number; side: 'player' | 'dm'; text: string }
const turns: Turn[] = [] // stand-in for the turn table
let inFlight = false // one call in flight per Session (ticket: lifecycle)
const log: string[] = [] // what the server observed, shown in the page

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => (clearTimeout(t), resolve()), { once: true })
  })

// Stand-in for chat() with no outputSchema: AG-UI events, TEXT_MESSAGE_CONTENT deltas.
async function* fakeModel(signal: AbortSignal, slow: boolean) {
  const words =
    'The torchlight gutters as you push open the iron door. Beyond, a stairwell spirals down into damp dark, and something below is dragging a chain. Make a Stealth check, DC 13.'.split(
      ' '
    )
  yield { type: 'RUN_STARTED' }
  for (const w of words) {
    if (signal.aborted) return
    yield { type: 'TEXT_MESSAGE_CONTENT', delta: w + ' ' }
    await sleep(slow ? 400 : 80, signal)
  }
  yield { type: 'CUSTOM', name: 'roll-request', value: { check: 'Stealth', dc: 13 } }
  yield { type: 'RUN_FINISHED' }
}

export const GET: RequestHandler = () => Response.json({ turns, inFlight, log })

export const DELETE: RequestHandler = () => {
  turns.length = 0
  log.length = 0
  inFlight = false
  return Response.json({ ok: true })
}

export const POST: RequestHandler = async ({ request }) => {
  const { text, slow } = await request.json()
  if (inFlight) return Response.json({ error: 'a call is already in flight' }, { status: 409 })
  inFlight = true
  // Player turn persists BEFORE the model call (data-model ticket).
  turns.push({ seq: turns.length + 1, side: 'player', text })
  log.push('player turn persisted')

  // request.signal fires when the browser drops the request: Stop, or tab closed.
  const signal = request.signal
  const encoder = new TextEncoder()
  let narration = ''
  let roll: unknown

  const body = new ReadableStream({
    async start(controller) {
      const send = (e: unknown) => controller.enqueue(encoder.encode(JSON.stringify(e) + '\n'))
      try {
        for await (const e of fakeModel(signal, !!slow)) {
          if (signal.aborted) break
          const ev = e as { type: string; delta?: string; value?: unknown }
          if (ev.type === 'TEXT_MESSAGE_CONTENT') narration += ev.delta
          if (ev.type === 'CUSTOM') roll = ev.value
          send(e)
        }
        if (signal.aborted) {
          log.push(
            `aborted after ${narration.length} chars: DM turn DISCARDED, player turn left unanswered`
          )
        } else {
          turns.push({
            seq: turns.length + 1,
            side: 'dm',
            text: narration.trim() + (roll ? ' [roll request]' : '')
          })
          log.push('RUN_FINISHED: DM turn persisted whole')
        }
      } catch (err) {
        log.push('failure: ' + String(err))
      } finally {
        inFlight = false
        try {
          controller.close()
        } catch {
          /* client already gone */
        }
      }
    },
    cancel() {
      // The reader went away; the signal path above does the bookkeeping.
      log.push('stream cancel() called by runtime')
    }
  })
  return new Response(body, {
    headers: { 'content-type': 'application/x-ndjson', 'cache-control': 'no-cache' }
  })
}
