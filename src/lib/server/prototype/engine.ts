// PROTOTYPE (throwaway): the code-owned scene-director loop. See src/lib/prototype/README.md.
import type {
  DirectorTrace,
  DoneReason,
  EventKind,
  Mode,
  PendingRoll,
  Role,
  RunStats,
  SceneEvent,
  SceneState,
  StepRequest,
  StreamMsg
} from '#lib/prototype/types.ts'
import { fakeBackend, realBackend, type Backend } from './backend.ts'
import { LOCATIONS, NPCS, OPENING, PLAYER, ROLL_DCS, ROLL_MODIFIER } from './scenario.ts'

/** The hard cap on director steps per run; the request may override it (1-12). */
export const STEP_CAP = 6

interface World {
  locationId: string
  npcLoc: Record<string, string>
  mode: Mode
  dialogueNpcId: string | null
  pendingRoll: PendingRoll | null
  log: SceneEvent[]
}

function initWorld(): World {
  const world: World = {
    locationId: 'tavern',
    npcLoc: Object.fromEntries(NPCS.map((n) => [n.id, n.home])),
    mode: 'exploration',
    dialogueNpcId: null,
    pendingRoll: null,
    log: []
  }
  world.log.push({
    id: crypto.randomUUID(),
    seq: 1,
    kind: 'narration',
    role: 'narrator',
    text: OPENING
  })
  return world
}

let world = initWorld()
let busy = false

export const isBusy = () => busy

export function resetWorld(): SceneState {
  world = initWorld()
  return snapshot()
}

export function snapshot(): SceneState {
  const loc = LOCATIONS[world.locationId]!
  return {
    location: {
      id: loc.id,
      name: loc.name,
      description: loc.description,
      exits: loc.exits.map(({ id, label }) => ({ id, label })),
      objects: loc.objects
    },
    npcsPresent: NPCS.filter((n) => world.npcLoc[n.id] === world.locationId).map((n) => ({
      id: n.id,
      name: n.name,
      occupation: n.occupation,
      persona: n.persona,
      attitude: n.attitude,
      knowledge: n.knowledge
    })),
    mode: world.mode,
    dialogueNpcId: world.dialogueNpcId,
    pendingRoll: world.pendingRoll,
    log: [...world.log]
  }
}

function addEvent(event: Omit<SceneEvent, 'id' | 'seq'>, id = crypto.randomUUID()): SceneEvent {
  const full = { ...event, id, seq: world.log.length + 1 }
  world.log.push(full)
  return full
}

const npcName = (id: string) => NPCS.find((n) => n.id === id)?.name ?? id

// ---- director -----------------------------------------------------------------------------

interface MenuItem {
  id: string
  hint: string
}

function buildMenu(): MenuItem[] {
  const state = snapshot()
  const last = world.log.at(-1)
  const afterPlayer = last?.kind === 'player-action'
  const menu: MenuItem[] = []
  if (last?.kind !== 'narration') {
    menu.push({ id: 'narrate', hint: 'describe what happens or what the player notices' })
  }
  for (const npc of state.npcsPresent) {
    const spokeLast = last?.kind === 'npc-line' && last.npcId === npc.id
    const inScope = world.mode === 'exploration' || world.dialogueNpcId === npc.id
    if (inScope && !spokeLast) {
      menu.push({ id: `npc-speaks:${npc.id}`, hint: `${npc.name} says something` })
    }
    if (world.mode === 'exploration') {
      menu.push({ id: `begin-dialogue:${npc.id}`, hint: `start a conversation with ${npc.name}` })
    }
  }
  if (world.mode === 'dialogue') {
    menu.push({ id: 'end-dialogue', hint: 'the conversation ends' })
  }
  if (afterPlayer && world.mode === 'exploration') {
    for (const exit of state.location.exits) {
      menu.push({ id: `move:${exit.id}`, hint: `the player travels to ${exit.label}` })
    }
  }
  if (afterPlayer) {
    for (const check of Object.keys(ROLL_DCS)) {
      menu.push({ id: `request-roll:${check}`, hint: `the player must roll a ${check} check` })
    }
  }
  menu.push({ id: 'yield', hint: 'hand control back to the player' })
  return menu
}

function recentLines(n: number, only?: (e: SceneEvent) => boolean): string {
  return world.log
    .filter((e) => (only ? only(e) : true))
    .slice(-n)
    .map((e) => `- [${e.npcName ?? e.role}] ${e.text}`)
    .join('\n')
}

const DIRECTOR_SYSTEM = `You are the director of a solo D&D scene. You do not write story text. Choose the single best next step from the list. Reply with ONLY the option id, exactly as written, and nothing else. Prefer "yield" once the player has something to respond to.`

function directorPrompt(menu: MenuItem[]): string {
  const state = snapshot()
  return [
    `Player: ${PLAYER}`,
    `Location: ${state.location.name}`,
    `Mode: ${state.mode}${state.dialogueNpcId ? ` with ${npcName(state.dialogueNpcId)}` : ''}`,
    `Present: ${state.npcsPresent.map((n) => `${n.name} (${n.attitude})`).join('; ') || 'nobody'}`,
    `Recent events:\n${recentLines(8)}`,
    `Options:\n${menu.map((m) => `${m.id}: ${m.hint}`).join('\n')}`,
    'Your choice (option id only):'
  ].join('\n\n')
}

function parsePick(raw: string | undefined, ids: string[]): string | undefined {
  if (!raw) return undefined
  const text = raw.toLowerCase()
  let best: { id: string; at: number } | undefined
  for (const id of ids) {
    const at = text.indexOf(id.toLowerCase())
    if (at < 0) continue
    if (!best || at < best.at || (at === best.at && id.length > best.id.length)) best = { id, at }
  }
  return best?.id
}

/** The code-chosen pick when the model cannot give a valid one. */
function fallbackPick(ids: string[]): string {
  const last = world.log.at(-1)
  const pick =
    last?.kind === 'player-action' || last?.kind === 'roll-resolved'
      ? world.mode === 'dialogue' && world.dialogueNpcId
        ? `npc-speaks:${world.dialogueNpcId}`
        : 'narrate'
      : 'yield'
  return ids.includes(pick) ? pick : 'yield'
}

async function direct(
  backend: Backend,
  menu: MenuItem[],
  signal: AbortSignal,
  stats: RunStats,
  step: number
): Promise<DirectorTrace> {
  const ids = menu.map((m) => m.id)
  const base = {
    system: DIRECTOR_SYSTEM,
    user: directorPrompt(menu),
    menu: ids,
    last: world.log.at(-1),
    state: snapshot()
  }
  const raw: (string | undefined)[] = []
  stats.directorCalls++
  raw.push(await backend.direct({ ...base, attempt: 0 }, signal))
  let pick = parsePick(raw[0], ids)
  let retried = false
  if (!pick && !signal.aborted) {
    retried = true
    stats.retries++
    stats.directorCalls++
    raw.push(
      await backend.direct(
        {
          ...base,
          user: `${base.user}\n\nYour last answer was not one of the option ids. Reply with exactly one option id from the list.`,
          attempt: 1
        },
        signal
      )
    )
    pick = parsePick(raw[1], ids)
  }
  let fallback = false
  if (!pick) {
    fallback = true
    stats.fallbacks++
    pick = fallbackPick(ids)
  }
  return { step, menu: ids, raw, pick, retried, fallback }
}

// ---- narrator and NPC voice ---------------------------------------------------------------

function narratorPrompts() {
  const state = snapshot()
  const system = `You are the narrator of a solo D&D 5e game. The player character is ${PLAYER}. Write 2 to 4 vivid sentences of scene prose in second person. Never write quoted dialogue for NPCs, never decide what the player does or feels, never invent dice results, numbers or items that are not listed. React to the most recent event.`
  const user = [
    `Location: ${state.location.name}. ${state.location.description}`,
    `Exits: ${state.location.exits.map((e) => e.label).join('; ')}`,
    `Objects: ${state.location.objects.join('; ')}`,
    `Present: ${state.npcsPresent.map((n) => `${n.name} (${n.occupation}, ${n.attitude})`).join('; ') || 'nobody'}`,
    `Recent events:\n${recentLines(6)}`,
    'Write the next narration.'
  ].join('\n\n')
  return { system, user, state }
}

function npcPrompts(npcId: string) {
  const npc = NPCS.find((n) => n.id === npcId)!
  const state = snapshot()
  const system = `You are ${npc.name}, a ${npc.occupation}. Personality: ${npc.persona} Your attitude toward the player: ${npc.attitude}. What you know: ${npc.knowledge} Speak ONE short in-character line (1 to 3 sentences). No narration, no stage directions, no quotation marks. Only reveal what you know if it fits your attitude and the conversation. Never invent game numbers.`
  const user = [
    `You are at ${state.location.name}. The player is ${PLAYER}.`,
    `Conversation so far:\n${recentLines(6, (e) => e.kind === 'player-action' || e.npcId === npcId) || '(nothing yet)'}`,
    'Say your next line.'
  ].join('\n\n')
  return { system, user, state }
}

/** Streams one narrator or NPC event; commits it on success, discards it on abort or failure. */
async function* streamEvent(
  backend: Backend,
  kind: Extract<EventKind, 'narration' | 'npc-line'>,
  npcId: string | undefined,
  signal: AbortSignal
): AsyncGenerator<StreamMsg, boolean> {
  const role: Role = kind === 'narration' ? 'narrator' : 'npc'
  const name = npcId ? npcName(npcId) : undefined
  const id = crypto.randomUUID()
  yield {
    t: 'thinking',
    role: kind === 'narration' ? 'narrator' : 'npc',
    step: 0,
    ...(name && { npcName: name })
  }
  const prompts = kind === 'narration' ? narratorPrompts() : npcPrompts(npcId!)
  yield {
    t: 'start',
    id,
    kind,
    role,
    ...(npcId && { npcId }),
    ...(name && { npcName: name })
  }
  let text = ''
  try {
    for await (const delta of backend.stream(
      { role: kind === 'narration' ? 'narrator' : 'npc', ...prompts, ...(npcId && { npcId }) },
      signal
    )) {
      if (signal.aborted) break
      text += delta
      yield { t: 'delta', id, text: delta }
    }
  } catch (error) {
    yield { t: 'discard', id }
    yield { t: 'error', message: error instanceof Error ? error.message : 'Model call failed' }
    return false
  }
  if (signal.aborted || !text.trim()) {
    yield { t: 'discard', id }
    if (!signal.aborted) yield { t: 'error', message: 'The model returned nothing' }
    return false
  }
  addEvent(
    { kind, role, text: text.trim(), ...(npcId && { npcId }), ...(name && { npcName: name }) },
    id
  )
  yield { t: 'state', state: snapshot() }
  return true
}

// ---- the loop -----------------------------------------------------------------------------

export async function* runPipeline(
  input: StepRequest,
  signal: AbortSignal
): AsyncGenerator<StreamMsg> {
  const stats: RunStats = { steps: 0, directorCalls: 0, retries: 0, fallbacks: 0, capHits: 0 }
  const done = (reason: DoneReason): StreamMsg => ({ t: 'done', reason, stats: { ...stats } })
  if (busy) {
    yield { t: 'error', message: 'A run is already in flight' }
    yield done('error')
    return
  }
  busy = true
  try {
    const backend = input.fake ? fakeBackend() : realBackend()
    if (!backend) {
      yield { t: 'error', message: 'No model configured (LM_STUDIO_MODEL is unset). Use fake.' }
      yield done('error')
      return
    }
    const cap = Math.min(12, Math.max(1, Math.round(input.stepCap ?? STEP_CAP)))

    if (input.roll) {
      const pending = world.pendingRoll
      if (!pending) {
        yield { t: 'error', message: 'No roll is pending' }
        yield done('error')
        return
      }
      const d20 = 1 + Math.floor(Math.random() * 20)
      const total = d20 + ROLL_MODIFIER
      const success = total >= pending.dc
      world.pendingRoll = null
      addEvent({
        kind: 'roll-resolved',
        role: 'code',
        text: `${pending.check}: d20 (${d20}) + ${ROLL_MODIFIER} = ${total} vs DC ${pending.dc}: ${success ? 'success' : 'failure'}`,
        roll: { check: pending.check, dc: pending.dc, d20, modifier: ROLL_MODIFIER, total, success }
      })
      yield { t: 'state', state: snapshot() }
    } else if (input.action?.trim()) {
      if (world.pendingRoll) {
        yield { t: 'error', message: 'A roll is pending; roll first' }
        yield done('error')
        return
      }
      addEvent({ kind: 'player-action', role: 'player', text: input.action.trim() })
      yield { t: 'state', state: snapshot() }
    } else {
      yield { t: 'error', message: 'Nothing to do: send an action or roll' }
      yield done('error')
      return
    }

    for (let step = 1; step <= cap; step++) {
      if (signal.aborted) {
        yield done('stopped')
        return
      }
      stats.steps = step
      yield { t: 'thinking', role: 'director', step }
      const trace = await direct(backend, buildMenu(), signal, stats, step)
      yield { t: 'director', trace }
      yield { t: 'stats', stats: { ...stats } }
      if (signal.aborted) {
        yield done('stopped')
        return
      }

      const [verb, arg = ''] = trace.pick.split(':')
      if (verb === 'yield') {
        yield done('yield')
        return
      }
      if (verb === 'narrate') {
        if (!(yield* streamEvent(backend, 'narration', undefined, signal))) {
          yield done(signal.aborted ? 'stopped' : 'error')
          return
        }
      } else if (verb === 'npc-speaks') {
        if (!(yield* streamEvent(backend, 'npc-line', arg, signal))) {
          yield done(signal.aborted ? 'stopped' : 'error')
          return
        }
      } else if (verb === 'begin-dialogue') {
        world.mode = 'dialogue'
        world.dialogueNpcId = arg
        addEvent({
          kind: 'mode-changed',
          role: 'director',
          text: `Dialogue begins with ${npcName(arg)}`,
          npcId: arg
        })
        yield { t: 'state', state: snapshot() }
      } else if (verb === 'end-dialogue') {
        world.mode = 'exploration'
        world.dialogueNpcId = null
        addEvent({ kind: 'mode-changed', role: 'director', text: 'The conversation ends' })
        yield { t: 'state', state: snapshot() }
      } else if (verb === 'move') {
        const exit = LOCATIONS[world.locationId]!.exits.find((e) => e.id === arg)!
        world.locationId = exit.to
        world.mode = 'exploration'
        world.dialogueNpcId = null
        addEvent({
          kind: 'scene-changed',
          role: 'code',
          text: `You travel to ${LOCATIONS[exit.to]!.name}`
        })
        yield { t: 'state', state: snapshot() }
      } else if (verb === 'request-roll') {
        const dc = ROLL_DCS[arg] ?? 12
        const lastAction = [...world.log].reverse().find((e) => e.kind === 'player-action')
        world.pendingRoll = {
          check: arg,
          dc,
          reason: lastAction ? `You tried: "${lastAction.text}"` : 'The DM calls for a check'
        }
        addEvent({
          kind: 'roll-requested',
          role: 'director',
          text: `Roll ${arg} (DC ${dc})`,
          roll: { check: arg, dc }
        })
        yield { t: 'state', state: snapshot() }
        yield done('roll')
        return
      }
    }
    stats.capHits++
    yield { t: 'stats', stats: { ...stats } }
    yield done('cap')
  } catch (error) {
    yield { t: 'error', message: error instanceof Error ? error.message : 'Pipeline failed' }
    yield done('error')
  } finally {
    busy = false
  }
}
