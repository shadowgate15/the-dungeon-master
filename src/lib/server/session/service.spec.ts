import { beforeEach, describe, expect, it } from 'vitest'
import { createCampaignService } from '../campaign/service'
import { createCharacterService } from '../character/service'
import { createWorldService } from '../world/service'
import { disposition, sessionEvent, sessionScene } from '../db/schema'
import {
  addNpc,
  firstSceneScripts,
  playableCampaign,
  sessionServiceWith,
  setSceneNpcs,
  updateNpc
} from './fixture'
import {
  SessionAlreadyOpenError,
  SessionNotFoundError,
  SessionValidationError,
  type SessionService
} from './service'
import { eq } from 'drizzle-orm'
import type { Database } from '../db/connect'
import type { CheckCall } from '#lib/session/call.ts'

const openCheck: CheckCall = {
  kind: 'check',
  skill: 'perception',
  difficulty: 'medium',
  dc: 15,
  declaration: { seq: 1, text: 'I look around' }
}

let db: Database
let sessions: SessionService
let campaignId: string
let characterId: string
let clock: number

beforeEach(() => {
  clock = 1000
  const fixture = playableCampaign()
  ;({ db, campaignId, characterId } = fixture)
  ;({ sessions } = sessionServiceWith(fixture, firstSceneScripts(), () => clock++))
})

describe('starting a Session', () => {
  it('creates a generated Scene and an empty Event log', async () => {
    const session = await sessions.start(campaignId)

    expect(session.campaignId).toBe(campaignId)
    expect(session.characterId).toBe(characterId)
    expect(session.endedAt).toBeNull()
    const scene = sessions.scene(session.id)
    expect(scene.location.name).toBeTruthy()
    expect(scene.location.description).toBeTruthy()
    expect(scene.exits.length).toBeGreaterThan(0)
    expect(scene.objects.length).toBeGreaterThan(0)
    expect(scene.npcs.length).toBeGreaterThan(0)
    expect(scene.mode).toBe('exploration')
    expect(scene.openCall).toBeNull()
    expect(sessions.events(session.id)).toEqual([])
  })

  it('refuses a second open Session for the same Campaign', async () => {
    await sessions.start(campaignId)
    await expect(sessions.start(campaignId)).rejects.toThrow(SessionAlreadyOpenError)
  })

  it('allows a new Session once the open one has ended', async () => {
    const first = await sessions.start(campaignId)
    sessions.end(first.id)
    const second = await sessions.start(campaignId)
    expect(second.id).not.toBe(first.id)
    expect(sessions.openFor(campaignId)?.id).toBe(second.id)
    expect(sessions.listNumbered(campaignId).map((s) => s.number)).toEqual([1, 2])
  })

  it('refuses without a linked Character', async () => {
    const worldId = createWorldService(db).create({ name: 'Other' }).id
    const other = createCampaignService(db).create(
      { name: 'D', premise: 'P', tone: 'dark', length: 'short' },
      [worldId]
    ).id
    await expect(sessions.start(other)).rejects.toThrow(/Link a Character/)
  })

  it('refuses on an unknown Campaign', async () => {
    await expect(sessions.start('nope')).rejects.toThrow(SessionValidationError)
  })

  it('stops the played Character being deleted', async () => {
    await sessions.start(campaignId)
    expect(() => createCharacterService(db).delete(characterId)).toThrow(/played Sessions/)
  })
})

describe('the Event log', () => {
  it('appends events in sequence, each with its producing role', async () => {
    const { id } = await sessions.start(campaignId)

    const a = sessions.appendEvent(id, { role: 'player', kind: 'declaration', text: 'I look' })
    const b = sessions.appendEvent(id, {
      role: 'narrator',
      kind: 'narration',
      text: 'You see a hearth.'
    })

    expect([a.seq, b.seq]).toEqual([1, 2])
    expect(sessions.events(id).map((e) => [e.seq, e.role, e.kind, e.text])).toEqual([
      [1, 'player', 'declaration', 'I look'],
      [2, 'narrator', 'narration', 'You see a hearth.']
    ])
  })

  it('keeps an event payload and speaker', async () => {
    const { id } = await sessions.start(campaignId)
    sessions.appendEvent(id, {
      role: 'npc',
      kind: 'npc-line',
      text: 'Welcome.',
      npcId: 'someone',
      data: { tone: 'warm' }
    })
    expect(sessions.events(id)[0]).toMatchObject({ npcId: 'someone', data: { tone: 'warm' } })
  })

  it('exposes no way to edit or remove an event, and the database rejects a bad role', async () => {
    const { id } = await sessions.start(campaignId)
    expect(Object.keys(sessions)).not.toEqual(
      expect.arrayContaining(['updateEvent', 'deleteEvent'])
    )
    expect(() =>
      db
        .insert(sessionEvent)
        .values({ sessionId: id, seq: 1, role: 'wizard' as never, kind: 'narration', createdAt: 1 })
        .run()
    ).toThrow()
    expect(db.select().from(sessionEvent).where(eq(sessionEvent.sessionId, id)).all()).toEqual([])
  })

  it('names the speaker of every NPC line, whether or not the NPC is still in the Scene', async () => {
    const { id } = await sessions.start(campaignId)
    const [brenna, hob] = sessions.scene(id).npcs
    const line = (npcId: string) =>
      sessions.appendEvent(id, { role: 'npc', kind: 'npc-line', text: 'Hm.', npcId })
    line(brenna.id)
    line(hob.id)
    line(brenna.id)
    setSceneNpcs({ db, campaignId, characterId }, id, [])
    updateNpc({ db, campaignId, characterId }, hob.id, { status: 'dead' })

    expect(sessions.speakers(id)).toEqual(
      expect.arrayContaining([
        { id: brenna.id, name: 'Brenna' },
        { id: hob.id, name: 'Old Hob' }
      ])
    )
    expect(sessions.speakers(id)).toHaveLength(2)
  })

  it('names no speakers before any NPC has spoken', async () => {
    const { id } = await sessions.start(campaignId)
    sessions.appendEvent(id, { role: 'player', kind: 'declaration', text: 'I look' })
    expect(sessions.speakers(id)).toEqual([])
  })

  it('refuses to append to an ended or unknown Session', async () => {
    const { id } = await sessions.start(campaignId)
    sessions.end(id)
    expect(() =>
      sessions.appendEvent(id, { role: 'player', kind: 'declaration', text: 'x' })
    ).toThrow(SessionValidationError)
    expect(() =>
      sessions.appendEvent('nope', { role: 'player', kind: 'declaration', text: 'x' })
    ).toThrow(SessionNotFoundError)
  })
})

describe('the Scene', () => {
  it('persists code-applied changes', async () => {
    const { id } = await sessions.start(campaignId)
    const scene = sessions.scene(id)
    const call = openCheck

    sessions.saveScene(id, {
      ...scene,
      mode: 'dialogue',
      dialogueNpcId: scene.npcs[0].id,
      openCall: call
    })

    expect(sessions.scene(id)).toMatchObject({
      mode: 'dialogue',
      dialogueNpcId: scene.npcs[0].id,
      openCall: call
    })
  })
})

describe('Scene NPCs resolve live from World memory', () => {
  const fixture = () => ({ db, campaignId, characterId })
  const storedNpcs = (id: string) =>
    db.select().from(sessionScene).where(eq(sessionScene.sessionId, id)).get()!.npcs

  it('stores NPC row ids only, and the resolved view carries current memory', async () => {
    const { id } = await sessions.start(campaignId)
    const scene = sessions.scene(id)

    expect(scene.npcs.map((n) => n.name)).toEqual(['Brenna', 'Old Hob'])
    const stored = storedNpcs(id)
    expect(stored).toEqual(scene.npcs.map((n) => n.id))
    expect(stored.every((v) => typeof v === 'string')).toBe(true)
    expect(scene.npcs[0]).toMatchObject({ attitude: 'friendly' })
  })

  it('shows a changed name, stance and note on the next read', async () => {
    const { id } = await sessions.start(campaignId)
    const hob = sessions.scene(id).npcs[1]
    updateNpc(fixture(), hob.id, { name: 'Hobart' })
    expect(
      sessions.changeAttitude(id, hob.id, { stance: 'allied', note: 'Owes the party.' })
    ).toEqual({
      ok: true
    })

    expect(sessions.scene(id).npcs[1]).toMatchObject({
      name: 'Hobart',
      attitude: 'allied',
      knowledge: 'Owes the party.'
    })
  })

  it('renders knowledge from linked facts plus the disposition note', async () => {
    const { id } = await sessions.start(campaignId)
    const sage = addNpc(fixture(), {
      name: 'Sage',
      stance: 'wary',
      note: 'Distrusts outsiders.',
      knows: [{ title: 'The well', detail: 'It is poisoned.' }]
    })
    sessions.placeNpc(id, sage)

    const resolved = sessions.scene(id).npcs.find((n) => n.id === sage)!
    expect(resolved.knowledge).toBe('Distrusts outsiders. The well: It is poisoned.')
  })

  it('is neutral when there is no disposition toward the Character', async () => {
    const { id } = await sessions.start(campaignId)
    const stranger = addNpc(fixture(), { name: 'Stranger' })
    sessions.placeNpc(id, stranger)

    expect(sessions.scene(id).npcs.find((n) => n.id === stranger)).toMatchObject({
      attitude: 'neutral',
      knowledge: ''
    })
  })

  it.each([
    ['dead', { status: 'dead' as const }],
    ['missing', { status: 'missing' as const }],
    ['departed', { status: 'departed' as const }],
    ['retired', { retiredAt: 5, retiredReason: 'gone' }]
  ])('never resolves a %s NPC, and prunes it from storage', async (_label, change) => {
    const { id } = await sessions.start(campaignId)
    const [brenna, hob] = sessions.scene(id).npcs
    updateNpc(fixture(), hob.id, change)

    expect(sessions.scene(id).npcs.map((n) => n.id)).toEqual([brenna.id])
    expect(storedNpcs(id)).toContain(hob.id)
    sessions.pruneScene(id)
    expect(storedNpcs(id)).toEqual([brenna.id])
  })

  it('ends dialogue when the dialogue partner no longer resolves', async () => {
    const { id } = await sessions.start(campaignId)
    const hob = sessions.scene(id).npcs[1]
    sessions.saveScene(id, { ...sessions.scene(id), mode: 'dialogue', dialogueNpcId: hob.id })
    updateNpc(fixture(), hob.id, { status: 'dead' })

    expect(sessions.scene(id)).toMatchObject({ mode: 'exploration', dialogueNpcId: null })
    sessions.pruneScene(id)
    expect(sessions.scene(id)).toMatchObject({ mode: 'exploration', dialogueNpcId: null })
  })

  it('places a newcomer only when it is alive, not retired and not already present', async () => {
    const { id } = await sessions.start(campaignId)
    const ghost = addNpc(fixture(), { name: 'Ghost', status: 'dead' })
    const guest = addNpc(fixture(), { name: 'Guest', stance: 'allied' })

    expect(sessions.placeNpc(id, ghost)).toBe(false)
    expect(sessions.placeNpc(id, guest)).toBe(true)
    expect(sessions.placeNpc(id, guest)).toBe(true)
    expect(sessions.scene(id).npcs.filter((n) => n.id === guest)).toHaveLength(1)
    expect(sessions.scene(id).npcs.at(-1)?.attitude).toBe('allied')
  })

  it('applies attitude changes as validated writes to the disposition', async () => {
    const { id } = await sessions.start(campaignId)
    const hob = sessions.scene(id).npcs[1]

    expect(sessions.changeAttitude(id, hob.id, { stance: 'furious', note: 'x' })).toMatchObject({
      ok: false
    })
    expect(
      sessions.changeAttitude(id, hob.id, { stance: 'friendly', note: 'Has 3 coins' })
    ).toMatchObject({
      ok: false
    })
    expect(sessions.scene(id).npcs[1].attitude).toBe('wary')

    expect(sessions.changeAttitude(id, hob.id, { stance: 'hostile' })).toEqual({ ok: true })
    expect(sessions.scene(id).npcs[1]).toMatchObject({
      attitude: 'hostile',
      knowledge: 'Saw lights on the north road.'
    })
    expect(sessions.changeAttitude(id, 'nobody', { stance: 'hostile' })).toMatchObject({
      ok: false
    })
  })

  it('stamps an attitude change with the Session and last Event seq', async () => {
    const { id } = await sessions.start(campaignId)
    sessions.appendEvent(id, { role: 'player', kind: 'declaration', text: 'hi' })
    const hob = sessions.scene(id).npcs[1]
    sessions.changeAttitude(id, hob.id, { stance: 'hostile' })

    const row = db.select().from(disposition).where(eq(disposition.npcId, hob.id)).get()!
    expect([row.changedSessionId, row.changedSeq]).toEqual([id, 1])
  })
})

describe('Scene carry-over and the Character lock', () => {
  it('opens a later Session on a clone of the previous Scene, without its open Call, with an empty Event log', async () => {
    const first = await sessions.start(campaignId)
    const npcId = sessions.scene(first.id).npcs[0].id
    const call = { ...openCheck, declaration: { seq: 1, text: 'I look' } }
    db.update(sessionScene)
      .set({ mode: 'dialogue', dialogueNpcId: npcId, openCall: call })
      .where(eq(sessionScene.sessionId, first.id))
      .run()
    sessions.appendEvent(first.id, { role: 'player', kind: 'declaration', text: 'I look' })
    sessions.end(first.id)

    const second = await sessions.start(campaignId)

    const before = sessions.scene(first.id)
    const after = sessions.scene(second.id)
    expect(after.location).toEqual(before.location)
    expect(after.exits).toEqual(before.exits)
    expect(after.npcs.map((n) => n.id)).toEqual(before.npcs.map((n) => n.id))
    expect(after.mode).toBe('dialogue')
    expect(after.dialogueNpcId).toBe(npcId)
    expect(before.openCall).toEqual(call)
    expect(after.openCall).toBeNull()
    expect(sessions.events(second.id)).toEqual([])
  })

  it('carries from the most recent Session by start time', async () => {
    const first = await sessions.start(campaignId)
    sessions.end(first.id)
    const second = await sessions.start(campaignId)
    db.update(sessionScene)
      .set({ locationName: 'The Deep Cellar' })
      .where(eq(sessionScene.sessionId, second.id))
      .run()
    sessions.end(second.id)

    const third = await sessions.start(campaignId)
    expect(sessions.scene(third.id).location.name).toBe('The Deep Cellar')
  })

  it('rejects changing or unlinking the Character once a Session exists', async () => {
    const campaigns = createCampaignService(db)
    expect(campaigns.characterLocked(campaignId)).toBe(false)
    await sessions.start(campaignId)

    expect(() => campaigns.linkCharacter(campaignId, 'someone-else')).toThrow(/first Session/)
    expect(() => campaigns.unlinkCharacter(campaignId)).toThrow(/first Session/)
    expect(campaigns.linkedCharacterId(campaignId)).toBe(characterId)
    expect(campaigns.characterLocked(campaignId)).toBe(true)
  })

  it('allows unlinking before any Session exists', () => {
    const campaigns = createCampaignService(db)
    campaigns.unlinkCharacter(campaignId)
    expect(campaigns.linkedCharacterId(campaignId)).toBeUndefined()
  })
})
