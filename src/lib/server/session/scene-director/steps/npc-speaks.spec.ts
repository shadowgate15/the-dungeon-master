import { beforeEach, describe, expect, it } from 'vitest'
import { createScriptedPort, fails, says } from '../../../../testing/scripted-chat-port'
import {
  addNpc,
  playableCampaign,
  sessionServiceWith,
  setSceneNpcs,
  updateNpc
} from '../../fixture'
import { createSceneRunner, type PipelineEvent } from '../../scene-runner.ts'
import type { SessionService } from '../../service'
import { buildMenu } from '../menu.ts'
import { MENU_OPTIONS } from '../options.ts'
import { createDirectorPipeline } from '../pipeline.ts'

let sessions: SessionService
let sessionId: string
let fixture: ReturnType<typeof playableCampaign>
let mira: string
let borg: string
let model: ReturnType<typeof createScriptedPort>

beforeEach(async () => {
  fixture = playableCampaign()
  sessions = sessionServiceWith(fixture).sessions
  sessionId = (await sessions.start(fixture.campaignId)).id
  model = createScriptedPort()
  mira = addNpc(fixture, {
    name: 'Mira',
    stance: 'friendly',
    note: 'The key is under the altar.'
  })
  borg = addNpc(fixture, {
    name: 'Borg',
    stance: 'hostile',
    note: 'Borg secretly serves the duke.'
  })
  setSceneNpcs(fixture, sessionId, [mira, borg])
})

async function play(text: string) {
  const runner = createSceneRunner({
    sessions,
    port: model.port,
    pipeline: createDirectorPipeline()
  })
  const result = runner.begin(sessionId, text, new AbortController().signal)
  if (!result.ok) throw new Error(result.reason)
  const events: PipelineEvent[] = []
  for await (const e of result.events) events.push(e)
  return events
}

describe('the NPC speaks option', () => {
  const menuIds = () =>
    buildMenu(MENU_OPTIONS, {
      scene: sessions.scene(sessionId),
      events: sessions.events(sessionId)
    })
      .map((m) => m.id)
      .filter((id) => id.startsWith('npc-speaks'))

  it('is offered once per NPC present, and never for an absent one', () => {
    expect(menuIds()).toEqual(['npc-speaks:mira', 'npc-speaks:borg'])
    sessions.saveScene(sessionId, {
      ...sessions.scene(sessionId),
      npcs: sessions.scene(sessionId).npcs.filter((n) => n.id === borg)
    })
    expect(menuIds()).toEqual(['npc-speaks:borg'])
  })

  it('is not offered when nobody is present', () => {
    sessions.saveScene(sessionId, { ...sessions.scene(sessionId), npcs: [] })
    expect(menuIds()).toEqual([])
  })
})

describe('an NPC line', () => {
  it('streams as an attributed npc-line and is saved when finished', async () => {
    model.enqueue(says('npc-speaks:mira'), says('Welcome, ', 'traveller.'), says('yield'))
    const events = await play('I greet Mira')

    const deltas = events.flatMap((e) => (e.type === 'delta' ? [e] : []))
    expect(deltas.map((d) => [d.kind, d.role, d.npcId, d.text])).toEqual([
      ['npc-line', 'npc', mira, 'Welcome, '],
      ['npc-line', 'npc', mira, 'traveller.']
    ])
    expect(
      sessions.events(sessionId).map((e) => `${e.role}:${e.kind}:${e.npcId}:${e.text}`)
    ).toEqual([
      'player:player-action:null:I greet Mira',
      `npc:npc-line:${mira}:Welcome, traveller.`
    ])
  })

  it("gives the voice only that NPC's own data", async () => {
    model.enqueue(says('npc-speaks:mira'), says('Hello.'), says('yield'))
    await play('I greet Mira')

    const voice = model.requests[1]
    const prompt = [...voice.systemPrompts, ...voice.messages.map((m) => m.content)].join('\n')
    expect(prompt).toContain('Mira')
    expect(prompt).toContain('friendly')
    expect(prompt).toContain('The key is under the altar.')
    expect(prompt).not.toContain('Borg')
    expect(prompt).not.toContain('secretly serves the duke')
  })

  it("gives the voice only its own lines and the player's actions, not narration or other NPCs", async () => {
    sessions.appendEvent(sessionId, { role: 'player', kind: 'player-action', text: 'I ask around' })
    sessions.appendEvent(sessionId, {
      role: 'npc',
      kind: 'npc-line',
      npcId: borg,
      text: 'The duke pays me well.'
    })
    sessions.appendEvent(sessionId, {
      role: 'narrator',
      kind: 'narration',
      text: 'Borg glances at the duke’s ring.'
    })
    sessions.appendEvent(sessionId, {
      role: 'npc',
      kind: 'npc-line',
      npcId: mira,
      text: 'Welcome.'
    })
    model.enqueue(says('npc-speaks:mira'), says('Hello.'), says('yield'))
    await play('I greet Mira')

    const history = model.requests[1].messages.map((m) => m.content).join('\n')
    expect(history).toContain('Player: I ask around')
    expect(history).toContain('Player: I greet Mira')
    expect(history).toContain('Mira: Welcome.')
    expect(history).not.toContain('duke')
    expect(history).not.toContain('Borg')
    expect(history).not.toContain('Someone')
  })

  it('discards the in-flight line and saves nothing when the model fails', async () => {
    model.enqueue(says('npc-speaks:mira'), fails)
    const events = await play('I greet Mira')
    const tail = events.map((e) => (e.type === 'done' ? `done:${e.reason}` : e.type)).slice(-2)
    expect(tail).toEqual(['discard', 'done:error'])
    expect(sessions.events(sessionId)).toHaveLength(1)
  })

  it('sees a change to its memory on the very next step', async () => {
    model.enqueue(
      says('npc-speaks:mira'),
      says('Hello.'),
      says('npc-speaks:mira'),
      says('Again.'),
      says('yield')
    )
    const runner = createSceneRunner({
      sessions,
      port: model.port,
      pipeline: createDirectorPipeline()
    })
    const result = runner.begin(sessionId, 'I greet Mira', new AbortController().signal)
    if (!result.ok) throw new Error(result.reason)
    let changed = false
    for await (const e of result.events) {
      if (e.type === 'event' && e.event.kind === 'npc-line' && !changed) {
        changed = true
        sessions.changeAttitude(sessionId, mira, { stance: 'allied', note: 'Trusts the party.' })
        updateNpc(fixture, mira, { name: 'Mirabel' })
      }
    }

    const voice = model.requests.filter((r) => r.systemPrompts.join('\n').includes('You voice'))
    const prompt = voice.at(-1)!.systemPrompts.join('\n')
    expect(prompt).toContain('Mirabel')
    expect(prompt).toContain('allied')
    expect(prompt).toContain('Trusts the party.')
    expect(prompt).not.toContain('The key is under the altar.')
  })
})
