/**
 * Deterministic CI checks that each role's context holds only what its job allows. The NPC test
 * plants secret facts and other NPCs' notes in World memory, then asserts no planted string is in
 * the NPC's context. The model-based leak and latency harnesses are manual (docs/context-harnesses.md).
 */
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { effect, happens } from '../../../testing/exchange-scripts'
import { createScriptedPort, says, type Script } from '../../../testing/scripted-chat-port'
import { fact, session } from '../../db/schema'
import { addNpc, playableCampaign, sessionServiceWith, setSceneNpcs } from '../fixture'
import { createSceneRunner } from '../scene-runner.ts'
import type { SessionService } from '../service'
import { buildNpcContext } from './npc.ts'
import type { ContextSources } from './sources.ts'
import { createCharacterLineReader, createFixedReader, createWorldReader } from './sources.ts'

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

/** Plays one Declaration through the runner and returns what each model request was sent. */
async function play(declaration: string, scripts: Script[], sources: Partial<ContextSources> = {}) {
  const model = createScriptedPort(scripts)
  const runner = createSceneRunner({
    sessions,
    port: model.port,
    contextSources: {
      summary: () => ({ text: SECRETS.summary, throughSeq: 0 }),
      world: createWorldReader(fixture.db),
      ...sources
    }
  })
  const result = runner.begin(sessionId, declaration, new AbortController().signal)
  if (!result.ok) throw new Error(result.reason)
  for await (const e of result.events) void e
  return model.requests.map((r) => JSON.stringify([r.systemPrompts, r.messages]))
}

describe('NPC isolation', () => {
  it('builds an NPC context with none of the planted secrets or other NPCs', () => {
    sessions.appendEvent(sessionId, { role: 'player', kind: 'declaration', text: 'Hello' })
    const resolved = sessions.scene(sessionId).npcs.find((n) => n.id === mira)!
    const built = buildNpcContext({ npc: resolved, events: sessions.events(sessionId) })
    const text = `${built.system}\n${built.content}`

    expect(text).toContain('MIRA-OWN-NOTE')
    expect(text).toContain('MIRA-OWN-FACT')
    for (const secret of planted) expect(text).not.toContain(secret)
    expect(text).not.toContain(SECRETS.borgName)
  })

  it('holds in a real Exchange: the NPC Reply request carries none of the planted strings', async () => {
    const [, , voice] = await play('Hello, Mira', [
      happens(),
      effect({ effect: 'talk', npcId: mira }),
      says('The key is under the altar.')
    ])
    expect(voice).toContain('MIRA-OWN-NOTE')
    for (const secret of planted) expect(voice).not.toContain(secret)
  })
})

describe('the other roles', () => {
  it('gives the Narrator selected live Facts but never an NPC knowledge note, and the ruling steps no World memory', async () => {
    const [adjudication, effectRequest, narrator] = await play('I look around', [
      happens(),
      effect({ effect: 'none' }),
      says('Dust settles.')
    ])

    // Narrator: the summary, the world-changing Fact and the Scene NPCs, but no per-NPC knowledge.
    expect(narrator).toContain(SECRETS.summary)
    expect(narrator).toContain(SECRETS.unknownFact)
    expect(narrator).toContain('Mira')
    for (const note of ['MIRA-OWN-NOTE', SECRETS.otherNote]) {
      expect(narrator).not.toContain(note)
    }
    // Adjudication and Effect: no World memory, no summary and no NPC knowledge.
    for (const sent of [adjudication, effectRequest]) {
      for (const text of [SECRETS.unknownFact, SECRETS.summary, 'MIRA-OWN-NOTE', 'Innkeeper']) {
        expect(sent).not.toContain(text)
      }
    }
  })

  it('gives the Narrator the Campaign Seed and the Character sheet, and the ruling steps only the Character line', async () => {
    const [adjudication, , narrator] = await play(
      'I look around',
      [happens(), effect({ effect: 'none' }), says('Dust settles.')],
      { fixed: createFixedReader(fixture.db), character: createCharacterLineReader(fixture.db) }
    )
    expect(narrator).toContain('Premise: P')
    expect(narrator).toContain('Tone: dark')
    expect(narrator).toContain('Rowan')
    expect(narrator).toContain('Fighter')
    expect(adjudication).toContain('Rowan')
    expect(adjudication).toContain('fighter')
    expect(adjudication).not.toContain('Premise: P')
  })
})
