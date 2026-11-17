// PROTOTYPE (throwaway): the one client store every layout variant shares.
import type {
  DirectorTrace,
  DoneReason,
  EventKind,
  NpcView,
  Role,
  RunStats,
  SceneEvent,
  SceneState,
  StepRequest,
  StreamMsg
} from './types.ts'

export interface LiveEvent {
  id: string
  kind: EventKind
  role: Role
  npcId?: string
  npcName?: string
  text: string
}

export interface RunRecord {
  reason: DoneReason
  stats: RunStats
}

export class SceneStore {
  state = $state<SceneState>() as SceneState
  /** The narrator or NPC event streaming right now; never part of the log until committed. */
  live = $state<LiveEvent | null>(null)
  thinking = $state<string | null>(null)
  busy = $state(false)
  error = $state<string | null>(null)
  stats = $state<RunStats | null>(null)
  traces = $state<DirectorTrace[]>([])
  runs = $state<RunRecord[]>([])
  fake = $state(false)
  affordances = $state(true)
  stepCap = $state(6)
  draft = $state('')
  readonly aiConfigured: boolean
  private controller?: AbortController

  constructor(initial: SceneState, aiConfigured: boolean, stepCap: number) {
    this.state = initial
    this.aiConfigured = aiConfigured
    this.fake = !aiConfigured
    this.stepCap = stepCap
  }

  /** The NPC the dialogue is with, if any. */
  get dialogueNpc(): NpcView | undefined {
    return this.state.npcsPresent.find((n) => n.id === this.state.dialogueNpcId)
  }

  /** The newest NPC line: the streaming one, else the last committed one from this scene. */
  get latestNpcLine(): { npcId?: string; npcName?: string; text: string } | undefined {
    if (this.live?.kind === 'npc-line') return this.live
    return this.lastOf((e) => e.kind === 'npc-line')
  }

  /** The newest narration: the streaming one, else the last committed one. */
  get latestNarration(): { text: string } | undefined {
    if (this.live?.kind === 'narration') return this.live
    return this.lastOf((e) => e.kind === 'narration')
  }

  private lastOf(match: (e: SceneEvent) => boolean) {
    return [...this.state.log].reverse().find(match)
  }

  fill(text: string) {
    this.draft = text
  }

  async send(text = this.draft) {
    const action = text.trim()
    if (!action || this.busy || this.state.pendingRoll) return
    this.draft = ''
    await this.run({ action })
  }

  async roll() {
    if (this.busy || !this.state.pendingRoll) return
    await this.run({ roll: true })
  }

  stop() {
    this.controller?.abort()
  }

  async reset() {
    if (this.busy) return
    const res = await fetch('/api/prototype/reset', { method: 'POST' })
    if (!res.ok) return
    const { state } = (await res.json()) as { state: SceneState }
    this.state = state
    this.live = null
    this.thinking = null
    this.error = null
    this.stats = null
    this.traces = []
    this.runs = []
  }

  private async run(extra: StepRequest) {
    this.busy = true
    this.error = null
    this.traces = []
    this.stats = null
    const controller = new AbortController()
    this.controller = controller
    try {
      const res = await fetch('/api/prototype/step', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...extra, fake: this.fake, stepCap: this.stepCap }),
        signal: controller.signal
      })
      if (!res.ok || !res.body) {
        this.error = res.status === 409 ? 'A run is already in flight' : 'The run failed to start'
        return
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let nl: number
        while ((nl = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, nl).trim()
          buffer = buffer.slice(nl + 1)
          if (line) this.apply(JSON.parse(line) as StreamMsg)
        }
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        this.error = error instanceof Error ? error.message : 'The run failed'
      }
    } finally {
      this.live = null
      this.thinking = null
      this.busy = false
      this.controller = undefined
    }
  }

  private apply(msg: StreamMsg) {
    switch (msg.t) {
      case 'state':
        this.state = msg.state
        this.live = null
        break
      case 'thinking':
        this.thinking =
          msg.role === 'director'
            ? `Director is choosing the next step (${msg.step})`
            : msg.role === 'narrator'
              ? 'Narrator is writing'
              : `${msg.npcName ?? 'An NPC'} is answering`
        break
      case 'director':
        this.traces = [...this.traces, msg.trace]
        break
      case 'start':
        this.thinking = null
        this.live = {
          id: msg.id,
          kind: msg.kind,
          role: msg.role,
          npcId: msg.npcId,
          npcName: msg.npcName,
          text: ''
        }
        break
      case 'delta':
        if (this.live?.id === msg.id) this.live.text += msg.text
        break
      case 'discard':
        if (this.live?.id === msg.id) this.live = null
        break
      case 'stats':
        this.stats = msg.stats
        break
      case 'done':
        this.stats = msg.stats
        this.thinking = null
        this.runs = [{ reason: msg.reason, stats: msg.stats }, ...this.runs].slice(0, 20)
        break
      case 'error':
        this.error = msg.message
        break
    }
  }
}
