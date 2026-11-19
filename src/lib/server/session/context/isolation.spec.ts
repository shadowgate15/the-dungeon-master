/**
 * Deterministic CI checks that each role's context holds only what its job allows. The NPC test
 * plants secret facts and other NPCs' notes in World memory, then asserts no planted string is in
 * the NPC's context. The model-based leak and latency harnesses are manual (docs/context-harnesses.md).
 */
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { createScriptedPort, says } from '../../../testing/scripted-chat-port'
import { fact, session } from '../../db/schema'
import { addNpc, playableCampaign, sessionServiceWith, setSceneNpcs } from '../fixture'
import { createDirectorPipeline } from '../scene-director/pipeline.ts'
import { createSceneRunner, type PipelineEvent } from '../scene-runner.ts'
import type { SessionService } from '../service'
import { buildNpcContext } from './npc.ts'
import { createFixedReader, createWorldReader } from './sources.ts'

const SECRETS = {
  otherNote: 'PLANTED-OTHER-NPC-NOTE the duke pays Borg.',
  otherFact: 'PLANTED-OTHER-NPC-FACT',
  otherFactDetail: 'PLANTED-OTHER-NPC-DETAIL the vault is under the mill.',
  unknownFact: 'PLANTED-UNKNOWN-FACT',
  unknownDetail: 'PLANTED-UNKNOWN-DETAIL the king is dead.',
  place: 'PLANTED-PLACE-NAME',
  summary: 'PLANTED-SUMMARY the party burned the mill.',
  borgName: 'Borg'
}

let fixture: ReturnType<typeof playableCampaign>
let sessions: SessionService
let sessionId: string
let mira: string
let borg: string

beforeEach(async () => {
  fixture = playableCampaign()
  sessions = sessionServiceWith(fixture).sessions
  sessionId = (await sessions.start(fixture.campaignId)).id
  mira = addNpc(fixture, {
    name: 'Mira',
    stance: 'friendly',
    note: 'MIRA-OWN-NOTE the key is under the altar.',
    knows: [{ title: 'MIRA-OWN-FACT', detail: 'Mira saw the thief.' }]
  })
  borg = addNpc(fixture, {
    name: SECRETS.borgName,
    stance: 'hostile',
    note: SECRETS.otherNote,
    knows: [{ title: SECRETS.otherFact, detail: SECRETS.otherFactDetail }]
  })
  setSceneNpcs(fixture, sessionId, [mira, borg])
  const campaignId = fixture.campaignId
  fixture.db
    .insert(fact)
    .values({
      campaignId,
      createdSessionId: sessionId,
      createdSeq: null,
      changedSessionId: sessionId,
      changedSeq: null,
      title: SECRETS.unknownFact,
      detail: SECRETS.unknownDetail,
      worldChanging: true
    })
    .run()
  fixture.db
    .update(session)
    .set({ summary: SECRETS.summary, summaryThroughSeq: 0 })
    .where(eq(session.id, sessionId))
    .run()
})

const planted = [
  SECRETS.otherNote,
  SECRETS.otherFact,
  SECRETS.otherFactDetail,
  SECRETS.unknownFact,
  SECRETS.unknownDetail,
  SECRETS.summary
]

describe('NPC isolation', () => {
  it('builds an NPC context with none of the planted secrets or other NPCs', () => {
    sessions.appendEvent(sessionId, { role: 'player', kind: 'player-action', text: 'Hello' })
    const resolved = sessions.scene(sessionId).npcs.find((n) => n.id === mira)!
    const built = buildNpcContext({ npc: resolved, events: sessions.events(sessionId) })
    const text = `${built.system}\n${built.content}`

    expect(text).toContain('MIRA-OWN-NOTE')
    expect(text).toContain('MIRA-OWN-FACT')
    for (const secret of planted) expect(text).not.toContain(secret)
    expect(text).not.toContain(SECRETS.borgName)
  })

  it('holds in a real run: the NPC voice request carries none of the planted strings', async () => {
    const model = createScriptedPort([
      says('npc-speaks:mira'),
      says('The key is under the altar.'),
      says('yield')
    ])
    const runner = createSceneRunner({
      sessions,
      port: model.port,
      pipeline: createDirectorPipeline(),
      contextSources: {
        summary: () => ({ text: SECRETS.summary, throughSeq: 0 }),
        world: createWorldReader(fixture.db)
      }
    })
    const result = runner.begin(sessionId, 'Hello', new AbortController().signal)
    if (!result.ok) throw new Error(result.reason)
    const events: PipelineEvent[] = []
    for await (const e of result.events) events.push(e)

    const voice = model.requests[1]
    const sent = JSON.stringify([voice.systemPrompts, voice.messages])
    expect(sent).toContain('MIRA-OWN-NOTE')
    for (const secret of planted) expect(sent).not.toContain(secret)
  })
})

describe('the other roles', () => {
  it('gives the Narrator selected live Facts but never an NPC knowledge note, and the Director no World memory', async () => {
    const model = createScriptedPort([says('narrate'), says('Dust settles.'), says('yield')])
    const runner = createSceneRunner({
      sessions,
      port: model.port,
      pipeline: createDirectorPipeline(),
      contextSources: {
        summary: () => ({ text: SECRETS.summary, throughSeq: 0 }),
        world: createWorldReader(fixture.db)
      }
    })
    const result = runner.begin(sessionId, 'I look around', new AbortController().signal)
    if (!result.ok) throw new Error(result.reason)
    for await (const e of result.events) void e

    const sentOf = (i: number) =>
      JSON.stringify([model.requests[i].systemPrompts, model.requests[i].messages])
    const director = sentOf(0)
    const narrator = sentOf(1)

    // Narrator: the summary, the world-changing Fact and the Scene NPCs, but no per-NPC knowledge.
    expect(narrator).toContain(SECRETS.summary)
    expect(narrator).toContain(SECRETS.unknownFact)
    expect(narrator).toContain('Mira')
    for (const note of ['MIRA-OWN-NOTE', SECRETS.otherNote]) {
      expect(narrator).not.toContain(note)
    }
    // Director: no World memory and no summary.
    for (const text of [SECRETS.unknownFact, SECRETS.summary, 'MIRA-OWN-NOTE', 'Innkeeper']) {
      expect(director).not.toContain(text)
    }
  })

  it('gives the Narrator the Campaign Seed and the Character sheet, and the Director neither', async () => {
    const model = createScriptedPort([says('narrate'), says('Dust settles.'), says('yield')])
    const runner = createSceneRunner({
      sessions,
      port: model.port,
      pipeline: createDirectorPipeline(),
      contextSources: {
        summary: () => ({ text: null, throughSeq: 0 }),
        world: createWorldReader(fixture.db),
        fixed: createFixedReader(fixture.db)
      }
    })
    const result = runner.begin(sessionId, 'I look around', new AbortController().signal)
    if (!result.ok) throw new Error(result.reason)
    for await (const e of result.events) void e

    const sentOf = (i: number) =>
      JSON.stringify([model.requests[i].systemPrompts, model.requests[i].messages])
    expect(sentOf(1)).toContain('Premise: P')
    expect(sentOf(1)).toContain('Tone: dark')
    expect(sentOf(1)).toContain('Rowan')
    expect(sentOf(1)).toContain('Fighter')
    expect(sentOf(0)).not.toContain('Rowan')
    expect(sentOf(0)).not.toContain('Premise: P')
  })
})
