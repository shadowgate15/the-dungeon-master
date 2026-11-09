// PROTOTYPE (throwaway): mock per-field AI state machine shared by the variants. No real AI calls.
export type Blocked = 'ai-unavailable' | 'archived' | 'read-only' | undefined

export const blockedText: Record<NonNullable<Blocked>, string> = {
  'ai-unavailable': 'AI is offline. Start LM Studio to use this.',
  archived: 'Archived. Restore it to edit.',
  'read-only': 'Read-only.'
}

const samples = [
  'The Hollow Crown: a drowned kingdom whose tides keep the old oaths.',
  'Ashfall Reach: a frontier of cooling volcanoes and fraught trade.',
  'The Lantern Coast: harbour towns that fear what the fog returns.'
]

export class FieldAi {
  value = $state('')
  status = $state<'idle' | 'loading' | 'error'>('idle')
  error = $state('')
  /** One-step undo: the value before the last AI write. */
  undoValue = $state<string | undefined>(undefined)
  lastNote = $state('')
  failNext = $state(false)
  #timer: ReturnType<typeof setTimeout> | undefined
  #n = 0
  options: string[] | undefined

  constructor(initial = '', options?: string[]) {
    this.value = initial
    this.options = options
  }

  #run(note: string) {
    this.status = 'loading'
    this.error = ''
    this.lastNote = note
    this.#timer = setTimeout(() => {
      if (this.failNext) {
        this.failNext = false
        this.status = 'error'
        this.error = 'The model returned something unusable. Try again.'
        return
      }
      this.undoValue = this.value
      const pool = this.options ?? samples
      const pick = pool[this.#n++ % pool.length]
      this.value = note && !this.options ? `${pick} (revised: “${note}”)` : pick
      this.status = 'idle'
    }, 1400)
  }

  generate() {
    this.#run('')
  }
  revise(note: string) {
    this.#run(note)
  }
  cancel() {
    clearTimeout(this.#timer)
    this.status = 'idle'
  }
  undo() {
    if (this.undoValue === undefined) return
    this.value = this.undoValue
    this.undoValue = undefined
  }
  dismissError() {
    this.status = 'idle'
    this.error = ''
  }
}
