// PROTOTYPE (throwaway): model backends for the scene-director prototype, real and scripted.
import { getChatPort } from '#lib/server/ai/index.ts'
import { collectText, streamText } from '#lib/server/ai/port.ts'
import type { SceneEvent, SceneState } from '#lib/prototype/types.ts'

export interface DirectCtx {
  system: string
  user: string
  menu: string[]
  last: SceneEvent | undefined
  state: SceneState
  /** 0 for the first ask, 1 for the retry. */
  attempt: number
}

export interface StreamReq {
  role: 'narrator' | 'npc'
  system: string
  user: string
  state: SceneState
  npcId?: string
}

export interface Backend {
  /** The director's raw answer, or undefined on a model failure. */
  direct(ctx: DirectCtx, signal: AbortSignal): Promise<string | undefined>
  /** The narrator's or NPC's text as deltas; throws on a model failure. */
  stream(req: StreamReq, signal: AbortSignal): AsyncGenerator<string>
}

/** The real local model, or null when none is configured. */
export function realBackend(): Backend | null {
  const port = getChatPort()
  if (!port) return null
  return {
    async direct(ctx, signal) {
      return collectText(port, {
        systemPrompts: [ctx.system],
        messages: [{ role: 'user', content: ctx.user }],
        maxTokens: 48,
        threadId: crypto.randomUUID(),
        signal
      })
    },
    async *stream(req, signal) {
      const events = streamText(port, {
        systemPrompts: [req.system],
        messages: [{ role: 'user', content: req.user }],
        maxTokens: req.role === 'narrator' ? 400 : 200,
        threadId: crypto.randomUUID(),
        signal
      })
      for await (const event of events) {
        if (event.type === 'delta') yield event.text
        else if (event.type === 'error') throw new Error(event.failure.message)
      }
    }
  }
}

const NPC_LINES: Record<string, string[]> = {
  marta: [
    "Rooms are two silver. Soup's free if you don't track mud on my floor.",
    "Caravan's late. Three days. Nobody here wants to say why, and I don't like it.",
    'Cellar key? Not for strangers. Give me a reason and maybe.'
  ],
  tobb: [
    'Ha! Stand me an ale and I will tell you how I held a bridge against forty orcs, singlehanded!',
    "Lights, lad. Green ones. Out by the old mill... but I didn't see nothing, you hear?",
    'Forty orcs! Maybe thirty. The point is, I was magnificent.'
  ],
  vey: [
    'State your business, stranger. I have little patience for idle questions.',
    'That wagon was not an accident. Do not touch the crates.',
    'A circle, split by three lines. If you see it, tell me. Quickly.'
  ]
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        resolve()
      },
      { once: true }
    )
  })

let fakeDirectCalls = 0
const fakeNpcCounters: Record<string, number> = {}

function fakePick(ctx: DirectCtx): string {
  const { last, state, menu } = ctx
  const has = (id: string) => menu.includes(id)
  const text = (last?.text ?? '').toLowerCase()
  const dialogueId = state.dialogueNpcId
  if (last?.kind === 'player-action') {
    const named = state.npcsPresent.find((n) =>
      n.name
        .toLowerCase()
        .split(' ')
        .some((word) => word.length > 3 && text.includes(word))
    )
    if (named && has(`begin-dialogue:${named.id}`)) return `begin-dialogue:${named.id}`
    if (dialogueId && has(`npc-speaks:${dialogueId}`)) return `npc-speaks:${dialogueId}`
    if (/(road|outside|leave|head|go to|inn|tavern)/.test(text)) {
      const move = menu.find((m) => m.startsWith('move:'))
      if (move) return move
    }
    if (/(persuade|convince|lie|bribe|ask)/.test(text) && has('request-roll:persuasion')) {
      return 'request-roll:persuasion'
    }
    if (/(look|search|examine|inspect)/.test(text) && has('request-roll:perception')) {
      return 'request-roll:perception'
    }
    return has('narrate') ? 'narrate' : 'yield'
  }
  if (last?.kind === 'roll-resolved') return has('narrate') ? 'narrate' : 'yield'
  if (last?.kind === 'mode-changed' && dialogueId && has(`npc-speaks:${dialogueId}`)) {
    return `npc-speaks:${dialogueId}`
  }
  if (last?.kind === 'scene-changed' && has('narrate')) return 'narrate'
  return 'yield'
}

/** A scripted backend for fast UI iteration. Misbehaves on purpose so retries and fallbacks show. */
export function fakeBackend(): Backend {
  return {
    async direct(ctx, signal) {
      if (ctx.attempt === 0) fakeDirectCalls++
      await sleep(250, signal)
      if (fakeDirectCalls % 8 === 0) return 'Hmm, hard to say what the story needs right now.'
      if (fakeDirectCalls % 4 === 0 && ctx.attempt === 0) return 'Let me think about the scene...'
      return fakePick(ctx)
    },
    async *stream(req, signal) {
      let text: string
      if (req.role === 'npc' && req.npcId) {
        const lines = NPC_LINES[req.npcId] ?? ['...']
        const n = (fakeNpcCounters[req.npcId] = (fakeNpcCounters[req.npcId] ?? -1) + 1)
        text = lines[n % lines.length]!
      } else {
        const last = req.state.log.at(-1)
        const loc = req.state.location
        if (last?.kind === 'roll-resolved') {
          text = last.roll?.success
            ? 'Your instincts pay off: the detail you were after comes into sharp focus.'
            : 'You try, but the moment slips past you and nothing useful comes of it.'
        } else if (last?.kind === 'scene-changed') {
          text = `${loc.description} You take a slow look around, noting ${loc.objects[0]}.`
        } else {
          text = `You take stock of ${loc.name}. ${loc.objects[0] ?? 'Nothing'} catches your eye while the room carries on around you.`
        }
      }
      for (const word of text.split(/(?<= )/)) {
        if (signal.aborted) return
        await sleep(30, signal)
        yield word
      }
    }
  }
}
