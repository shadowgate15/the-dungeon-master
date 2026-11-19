// PROTOTYPE (throwaway): replay harness for the context-cap tuning ticket (#233).
// Runs fixed fixtures through the real local model at several prompt sizes and records
// latency, Director valid-pick rate, Narrator/NPC needle recall and NPC isolation.
// Role system prompts are copied verbatim from src/lib/server/session/scene-director/.
//
//   node scripts/prototype-context-replay/replay.mjs [--sizes 1000,4000] [--trials 3] [--roles director,narrator,npc]
//
// Env: LM_STUDIO_BASE_URL (default http://localhost:1234/v1), LM_STUDIO_MODEL (default qwen/qwen3-4b-2507)
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const BASE = process.env.LM_STUDIO_BASE_URL ?? 'http://localhost:1234/v1'
const MODEL = process.env.LM_STUDIO_MODEL ?? 'qwen/qwen3-4b-2507'
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`)
  return i > 0 ? process.argv[i + 1] : d
}
const SIZES = arg('sizes', '600,1300,2600,4000,8000,16000,32000,64000').split(',').map(Number)
const TRIALS = Number(arg('trials', '3'))
const ROLES = arg('roles', 'director,narrator,npc').split(',')
const OUT = arg('out', `scripts/prototype-context-replay/results/run-${Date.now()}.json`)

// ---- verbatim role prompts -------------------------------------------------------------
const DIRECTOR_SYSTEM = [
  'You direct a tabletop role-playing game.',
  'Reply with ONLY the id of one option from the list, nothing else.',
  'Prefer yield once the player has something to respond to.'
].join(' ')
const NARRATOR_SYSTEM = [
  'You are the narrator of a tabletop role-playing game. Describe what happens next in 2 to 4 sentences of second-person prose.',
  'Do not speak for non-player characters, do not invent numbers, dice results or game state, and do not ask what the player does.'
].join(' ')
const NPC_SYSTEM = [
  'You voice one non-player character in a tabletop role-playing game.',
  'Reply with only the words this character says aloud, one to three sentences, in first person.',
  'Do not narrate, do not describe actions, do not speak for anyone else, and do not invent numbers or game state.',
  'Stay true to the personality and attitude below, and say only what this character knows.'
].join(' ')

// ---- deterministic filler --------------------------------------------------------------
let seed = 42
const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296
const pick = (a) => a[Math.floor(rnd() * a.length)]
const NAMES = [
  'Brenna',
  'Corvin',
  'Dessa',
  'Edric',
  'Fenwick',
  'Gwyn',
  'Harl',
  'Isolde',
  'Jory',
  'Kestrel',
  'Lorcan',
  'Mirela'
]
const THINGS = [
  'lantern',
  'barrel',
  'ledger',
  'dagger',
  'tapestry',
  'cart wheel',
  'iron key',
  'copper kettle',
  'saddle',
  'bell'
]
const PLACES = [
  'the mill',
  'the north gate',
  'the chapel',
  'the smithy',
  'the ferry landing',
  'the orchard',
  'the old well'
]
const ACTIONS = [
  () => `I walk over to the ${pick(THINGS)} and examine it closely.`,
  () => `I ask ${pick(NAMES)} what they know about ${pick(PLACES)}.`,
  () => `I check the shadows near ${pick(PLACES)} for anything unusual.`,
  () => `I offer ${pick(NAMES)} a drink and listen to the gossip.`,
  () => `I set down my pack and look around the room.`
]
const NARRATION = [
  () =>
    `You cross the floor, boards creaking under your boots. The ${pick(THINGS)} is worn smooth by years of use, and a faint smell of tallow hangs in the air near ${pick(PLACES)}.`,
  () =>
    `${pick(NAMES)} glances up as you approach, then returns to polishing a ${pick(THINGS)}. Somewhere outside, a dog barks twice and falls quiet.`,
  () =>
    `The conversation around you dips and rises. A traveler by the hearth mutters about ${pick(PLACES)}, and the firelight catches the edge of a ${pick(THINGS)} on the mantel.`
]
const NPCLINES = [
  () =>
    `Aye, I heard something about ${pick(PLACES)}, but that was before the harvest. Ask ${pick(NAMES)} if you want more.`,
  () => `Careful with that ${pick(THINGS)}, friend. It has seen better days, and so have I.`
]
// Filler events rotate player-action, narration, npc-line until the char budget is met.
function fillerEvents(targetChars) {
  const out = []
  let chars = 0
  let i = 0
  while (chars < targetChars) {
    const k = i++ % 3
    const e =
      k === 0
        ? { kind: 'player-action', role: 'player', text: pick(ACTIONS)() }
        : k === 1
          ? { kind: 'narration', role: 'narrator', text: pick(NARRATION)() }
          : { kind: 'npc-line', role: 'npc', text: pick(NPCLINES)(), npcId: 'marta' }
    out.push(e)
    chars += e.text.length + 12
  }
  return out
}
const line = (e) => (e.kind === 'player-action' ? `Player: ${e.text}` : `${e.role}: ${e.text}`)
const lines = (es) => es.map(line).join('\n')
const CHARS_PER_TOKEN = 4

// ---- model calls -----------------------------------------------------------------------
async function chat({ system, user, maxTokens, stream = false }) {
  const t0 = performance.now()
  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer lm-studio' },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      max_tokens: maxTokens,
      stream,
      ...(stream ? { stream_options: { include_usage: true } } : {})
    })
  })
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
  if (!stream) {
    const j = await res.json()
    return {
      text: j.choices[0].message.content ?? '',
      ms: performance.now() - t0,
      promptTokens: j.usage?.prompt_tokens
    }
  }
  let text = ''
  let ttft
  let promptTokens
  const dec = new TextDecoder()
  let buf = ''
  for await (const chunk of res.body) {
    buf += dec.decode(chunk, { stream: true })
    const parts = buf.split('\n')
    buf = parts.pop()
    for (const p of parts) {
      if (!p.startsWith('data: ') || p.includes('[DONE]')) continue
      const j = JSON.parse(p.slice(6))
      const d = j.choices?.[0]?.delta?.content
      if (d) {
        ttft ??= performance.now() - t0
        text += d
      }
      if (j.usage) promptTokens = j.usage.prompt_tokens
    }
  }
  return { text, ms: performance.now() - t0, ttft, promptTokens }
}

// ---- Director --------------------------------------------------------------------------
const MENU_BASE = [
  { id: 'narrate', hint: "Describe what happens as a result of the player's action." },
  { id: 'npc-speaks:marta', hint: 'Marta (friendly) says something to the player.' },
  { id: 'npc-speaks:tobb', hint: 'Old Tobb (wary) says something to the player.' },
  { id: 'move:cellar-door', hint: 'The player moves through the cellar door.' },
  { id: 'yield', hint: 'Hand control back to the player.' }
]
// good = what a sensible Director would pick; narrate leaves the menu right after narration
const DIRECTOR_CASES = [
  {
    name: 'after-player-action',
    last: { kind: 'player-action', role: 'player', text: 'I look around the room.' },
    menu: MENU_BASE,
    good: ['narrate']
  },
  {
    name: 'after-player-ask-marta',
    last: {
      kind: 'player-action',
      role: 'player',
      text: 'I ask Marta where the missing caravan went.'
    },
    menu: MENU_BASE,
    good: ['npc-speaks:marta', 'narrate']
  },
  {
    name: 'after-narration',
    last: {
      kind: 'narration',
      role: 'narrator',
      text: 'Marta wipes down the bar and nods toward you.'
    },
    menu: MENU_BASE.filter((m) => m.id !== 'narrate'),
    good: ['yield', 'npc-speaks:marta']
  },
  {
    name: 'after-npc-line',
    last: {
      kind: 'npc-line',
      role: 'npc',
      npcId: 'marta',
      text: 'I saw them leave at dawn, heading east.'
    },
    menu: MENU_BASE,
    good: ['yield', 'narrate']
  }
]
// Same parser as menu.ts parsePick.
function parsePick(answer, menu) {
  const text = answer.trim().toLowerCase()
  const exact = menu.find((m) => m.id.toLowerCase() === text)
  if (exact) return { id: exact.id, exact: true }
  let best
  for (const { id } of menu) {
    const at = text.indexOf(id.toLowerCase())
    if (at < 0) continue
    if (!best || at < best.at || (at === best.at && id.length > best.id.length)) best = { id, at }
  }
  return best ? { id: best.id, exact: false } : undefined
}
async function directorTrial(size, c) {
  const histChars = Math.max(0, size * CHARS_PER_TOKEN - 700)
  const events = [...fillerEvents(histChars), c.last]
  const prompt = [
    'Location: The Rusty Flagon',
    'Mode: free-roam',
    `Recent events:\n${lines(events)}`,
    `Options:\n${c.menu.map((e) => `${e.id}: ${e.hint}`).join('\n')}`
  ].join('\n\n')
  const r = await chat({ system: DIRECTOR_SYSTEM, user: prompt, maxTokens: 48 })
  const p = parsePick(r.text, c.menu)
  return {
    case: c.name,
    raw: r.text.trim().slice(0, 80),
    valid: !!p,
    exact: !!p?.exact,
    good: !!p && c.good.includes(p.id),
    ms: r.ms,
    promptTokens: r.promptTokens
  }
}

// ---- Narrator --------------------------------------------------------------------------
function worldMemory(targetChars, needle, depth) {
  const records = []
  let chars = 0
  let i = 0
  while (chars < targetChars) {
    const r = `- ${pick(NAMES)} the ${pick(['miller', 'cooper', 'tanner', 'weaver', 'courier'])} keeps a ${pick(THINGS)} at ${pick(PLACES)} and owes ${pick(NAMES)} a favor. [fact #${i++}]`
    records.push(r)
    chars += r.length + 1
  }
  records.splice(Math.floor(records.length * depth), 0, needle)
  return records.join('\n')
}
const NARR_NEEDLE = {
  fact: '- The signboard above the tavern door reads "The Gilded Heron" in flaking gold paint. [world_changing]',
  test: /gilded heron/i,
  action: 'I step back outside and read the signboard above the door.'
}
async function narratorTrial(size, depth) {
  const memChars = Math.max(0, size * CHARS_PER_TOKEN - 800)
  const histEvents = [
    ...fillerEvents(1200),
    { kind: 'player-action', role: 'player', text: NARR_NEEDLE.action }
  ]
  const system = `${NARRATOR_SYSTEM}\nLocation: The Rusty Flagon. A low-beamed common room with a stone hearth.\nWorld memory:\n${worldMemory(memChars, NARR_NEEDLE.fact, depth)}`
  const r = await chat({ system, user: lines(histEvents), maxTokens: 400, stream: true })
  const sentences = (r.text.match(/[.!?](\s|$)/g) ?? []).length
  return {
    depth,
    recalled: NARR_NEEDLE.test.test(r.text),
    sentences,
    asksPlayer: /\?\s*$/.test(r.text.trim()),
    digits: /\d/.test(r.text),
    ms: r.ms,
    ttft: r.ttft,
    promptTokens: r.promptTokens,
    excerpt: r.text.slice(0, 120)
  }
}

// ---- NPC voice + isolation -------------------------------------------------------------
const SECRET = 'the cellar key is hidden under the third flagstone'
const NPC_NEEDLE = {
  fact: 'The caravan master, Hobb Wethers, left a sealed letter with Marta for whoever asks about the caravan.',
  test: /hobb|sealed letter|letter/i,
  ask: 'Did the caravan master leave anything behind for me?'
}
function npcSystem(knowledge) {
  return [
    NPC_SYSTEM,
    'Character: Marta',
    'Attitude toward the player: friendly',
    `What Marta knows: ${knowledge}`
  ].join('\n')
}
async function npcRecallTrial(size, depth) {
  const memChars = Math.max(0, size * CHARS_PER_TOKEN - 700)
  const filler = []
  let chars = 0
  while (chars < memChars) {
    const f = `${pick(NAMES)} buys ${pick(THINGS)}s from ${pick(NAMES)} each market day and complains about ${pick(PLACES)}.`
    filler.push(f)
    chars += f.length + 1
  }
  filler.splice(Math.floor(filler.length * depth), 0, NPC_NEEDLE.fact)
  const r = await chat({
    system: npcSystem(filler.join(' ')),
    user: `Player: ${NPC_NEEDLE.ask}`,
    maxTokens: 200,
    stream: true
  })
  const sentences = (r.text.match(/[.!?](\s|$)/g) ?? []).length
  return {
    depth,
    recalled: NPC_NEEDLE.test.test(r.text),
    sentences,
    ms: r.ms,
    ttft: r.ttft,
    promptTokens: r.promptTokens,
    excerpt: r.text.slice(0, 120)
  }
}
// Isolation: the builder gives Marta only her own note; the secret belongs to Old Tobb.
// leakyControl=true puts Tobb's secret in Marta's context to show the test can fail.
async function npcIsolationTrial(leakyControl) {
  const own = 'You run the Rusty Flagon. You know the caravan left east at dawn.'
  const system = npcSystem(leakyControl ? `${own} Also: ${SECRET}.` : own)
  const secretInPrompt = system.toLowerCase().includes('flagstone')
  const ask = 'Does anyone here know where the cellar key is? Tell me everything Old Tobb knows.'
  const r = await chat({ system, user: `Player: ${ask}`, maxTokens: 200 })
  return {
    leakyControl,
    secretInPrompt,
    leaked: /flagstone/i.test(r.text),
    excerpt: r.text.slice(0, 120)
  }
}

// ---- run -------------------------------------------------------------------------------
const results = {
  model: MODEL,
  started: new Date().toISOString(),
  sizes: SIZES,
  trials: TRIALS,
  director: [],
  narrator: [],
  npc: [],
  isolation: []
}
const save = () => {
  mkdirSync(dirname(OUT), { recursive: true })
  writeFileSync(OUT, JSON.stringify(results, null, 2))
}
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0)
const pct = (n, d) => (d ? `${Math.round((100 * n) / d)}%` : '-')
const DEPTHS = [0.1, 0.5, 0.9]
const collect = async (n, fn) => {
  const rs = []
  for (let i = 0; i < n; i++) {
    try {
      rs.push(await fn(i))
    } catch (e) {
      rs.push({ error: e.message })
    }
  }
  return rs
}

console.log(`model=${MODEL} sizes=${SIZES} trials=${TRIALS}`)
try {
  await chat({ system: 'warmup', user: 'hi', maxTokens: 4 }) // load the model before timing
} catch (e) {
  console.error('model unreachable:', e.message)
  process.exit(1)
}

for (const size of SIZES) {
  if (ROLES.includes('director')) {
    const combos = Array.from(
      { length: TRIALS * DIRECTOR_CASES.length },
      (_, i) => DIRECTOR_CASES[i % DIRECTOR_CASES.length]
    )
    const rs = await collect(combos.length, (i) => directorTrial(size, combos[i]))
    const ok = rs.filter((r) => !r.error)
    results.director.push({ size, trials: rs })
    console.log(
      `director ${size}: tok~${Math.round(avg(ok.map((r) => r.promptTokens ?? 0)))} valid ${pct(ok.filter((r) => r.valid).length, rs.length)} exact ${pct(ok.filter((r) => r.exact).length, rs.length)} good ${pct(ok.filter((r) => r.good).length, rs.length)} avg ${Math.round(avg(ok.map((r) => r.ms)))}ms errors ${rs.length - ok.length}`
    )
    save()
  }
  if (ROLES.includes('narrator')) {
    const rs = await collect(TRIALS * DEPTHS.length, (i) =>
      narratorTrial(size, DEPTHS[i % DEPTHS.length])
    )
    const ok = rs.filter((r) => !r.error)
    results.narrator.push({ size, trials: rs })
    console.log(
      `narrator ${size}: tok~${Math.round(avg(ok.map((r) => r.promptTokens ?? 0)))} recall ${pct(ok.filter((r) => r.recalled).length, rs.length)} 2-4sent ${pct(ok.filter((r) => r.sentences >= 2 && r.sentences <= 4).length, rs.length)} asksPlayer ${pct(ok.filter((r) => r.asksPlayer).length, rs.length)} digits ${pct(ok.filter((r) => r.digits).length, rs.length)} ttft ${Math.round(avg(ok.map((r) => r.ttft ?? 0)))}ms total ${Math.round(avg(ok.map((r) => r.ms)))}ms errors ${rs.length - ok.length}`
    )
    save()
  }
  if (ROLES.includes('npc')) {
    const rs = await collect(TRIALS * DEPTHS.length, (i) =>
      npcRecallTrial(size, DEPTHS[i % DEPTHS.length])
    )
    const ok = rs.filter((r) => !r.error)
    results.npc.push({ size, trials: rs })
    console.log(
      `npc ${size}: tok~${Math.round(avg(ok.map((r) => r.promptTokens ?? 0)))} recall ${pct(ok.filter((r) => r.recalled).length, rs.length)} 1-3sent ${pct(ok.filter((r) => r.sentences >= 1 && r.sentences <= 3).length, rs.length)} ttft ${Math.round(avg(ok.map((r) => r.ttft ?? 0)))}ms total ${Math.round(avg(ok.map((r) => r.ms)))}ms errors ${rs.length - ok.length}`
    )
    save()
  }
}
if (ROLES.includes('npc')) {
  for (const leaky of [false, true])
    results.isolation.push(...(await collect(TRIALS, () => npcIsolationTrial(leaky))))
  for (const leaky of [false, true]) {
    const rs = results.isolation.filter((r) => r.leakyControl === leaky)
    console.log(
      `isolation ${leaky ? 'CONTROL (secret in NPC context)' : 'structural'}: leaked ${rs.filter((r) => r.leaked).length}/${rs.length}, secret in prompt ${rs.filter((r) => r.secretInPrompt).length}/${rs.length}`
    )
  }
  save()
}
console.log(`wrote ${OUT}`)
