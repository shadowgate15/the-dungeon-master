import { fetchServerSentEvents } from '@tanstack/ai-client'

/**
 * Client state for one streamed DM turn, over TanStack AI's `fetchServerSentEvents` (a fetch
 * POST, not `EventSource`). `start` posts the player's action (or nothing, for the DM's opening
 * or a Retry); `start(undefined, { roll: true })` is the Roll click, answering a pending Roll
 * request; `text` fills as narration streams; `stop` aborts the request, which the server
 * treats like a closed tab: the partial DM turn is discarded and the action stays unanswered.
 * Call `start` only from the browser. The caller refreshes the transcript when `start` settles.
 */
export class TurnStream {
  streaming = $state(false)
  /** The narration so far; cleared at the start of each turn. */
  text = $state('')
  /** What the player just sent, shown until the saved transcript replaces it. */
  pendingAction = $state<string | null>(null)
  error = $state<string | null>(null)
  private controller?: AbortController

  /** `settle` refreshes the saved transcript; it runs before the streamed text is cleared. */
  constructor(
    private readonly url: string,
    private readonly settle?: () => Promise<unknown>
  ) {}

  /** Resolves when the turn has finished, failed or been stopped. */
  async start(action?: string, options: { roll?: boolean } = {}): Promise<void> {
    if (this.streaming) return
    this.streaming = true
    this.text = ''
    this.error = null
    this.pendingAction = action ?? null
    const controller = new AbortController()
    this.controller = controller
    try {
      const connection = fetchServerSentEvents(this.url)
      const chunks = connection.connect(
        [],
        { ...(action !== undefined && { action }), ...(options.roll && { roll: true }) },
        controller.signal,
        {
          threadId: crypto.randomUUID(),
          runId: crypto.randomUUID()
        }
      )
      let finished = false
      for await (const chunk of chunks) {
        if (chunk.type === 'TEXT_MESSAGE_CONTENT') this.text += chunk.delta
        else if (chunk.type === 'RUN_ERROR')
          this.error = chunk.message || 'The DM could not answer.'
        else if (chunk.type === 'RUN_FINISHED') finished = true
      }
      if (!finished && !this.error && !controller.signal.aborted) {
        this.error = 'The connection dropped before the DM finished.'
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        this.error =
          error instanceof Error && error.message ? error.message : 'The DM could not answer.'
      }
    } finally {
      await this.settle?.()
      this.streaming = false
      this.text = ''
      this.pendingAction = null
      this.controller = undefined
    }
  }

  stop() {
    this.controller?.abort()
  }
}
