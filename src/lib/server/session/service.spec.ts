import { beforeEach, describe, expect, it } from 'vitest'
import { createCampaignService } from '../campaign/service'
import { createCharacterService } from '../character/service'
import { createWorldService } from '../world/service'
import { sessionEvent } from '../db/schema'
import { playableCampaign } from './fixture'
import {
  createSessionService,
  SessionAlreadyOpenError,
  SessionNotFoundError,
  SessionValidationError,
  type SessionService
} from './service'
import { eq } from 'drizzle-orm'
import type { Database } from '../db/connect'

let db: Database
let sessions: SessionService
let campaignId: string
let characterId: string
let clock: number

beforeEach(() => {
  clock = 1000
  ;({ db, campaignId, characterId } = playableCampaign())
  sessions = createSessionService(db, () => clock++)
})

describe('starting a Session', () => {
  it('creates a seeded Scene and an empty Event log', () => {
    const session = sessions.start(campaignId)

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
    expect(scene.pendingRoll).toBeNull()
    expect(sessions.events(session.id)).toEqual([])
  })

  it('refuses a second open Session for the same Campaign', () => {
    sessions.start(campaignId)
    expect(() => sessions.start(campaignId)).toThrow(SessionAlreadyOpenError)
  })

  it('allows a new Session once the open one has ended', () => {
    const first = sessions.start(campaignId)
    sessions.end(first.id)
    const second = sessions.start(campaignId)
    expect(second.id).not.toBe(first.id)
    expect(sessions.openFor(campaignId)?.id).toBe(second.id)
    expect(sessions.listNumbered(campaignId).map((s) => s.number)).toEqual([1, 2])
  })

  it('refuses without a linked Character', () => {
    const worldId = createWorldService(db).create({ name: 'Other' }).id
    const other = createCampaignService(db).create(
      { name: 'D', premise: 'P', tone: 'dark', length: 'short' },
      [worldId]
    ).id
    expect(() => sessions.start(other)).toThrow(/Link a Character/)
  })

  it('refuses on an unknown Campaign', () => {
    expect(() => sessions.start('nope')).toThrow(SessionValidationError)
  })

  it('stops the played Character being deleted', () => {
    sessions.start(campaignId)
    expect(() => createCharacterService(db).delete(characterId)).toThrow(/played Sessions/)
  })
})

describe('the Event log', () => {
  it('appends events in sequence, each with its producing role', () => {
    const { id } = sessions.start(campaignId)

    const a = sessions.appendEvent(id, { role: 'player', kind: 'player-action', text: 'I look' })
    const b = sessions.appendEvent(id, {
      role: 'narrator',
      kind: 'narration',
      text: 'You see a hearth.'
    })

    expect([a.seq, b.seq]).toEqual([1, 2])
    expect(sessions.events(id).map((e) => [e.seq, e.role, e.kind, e.text])).toEqual([
      [1, 'player', 'player-action', 'I look'],
      [2, 'narrator', 'narration', 'You see a hearth.']
    ])
  })

  it('keeps an event payload and speaker', () => {
    const { id } = sessions.start(campaignId)
    sessions.appendEvent(id, {
      role: 'npc',
      kind: 'npc-line',
      text: 'Welcome.',
      npcId: 'marta',
      data: { tone: 'warm' }
    })
    expect(sessions.events(id)[0]).toMatchObject({ npcId: 'marta', data: { tone: 'warm' } })
  })

  it('exposes no way to edit or remove an event, and the database rejects a bad role', () => {
    const { id } = sessions.start(campaignId)
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

  it('refuses to append to an ended or unknown Session', () => {
    const { id } = sessions.start(campaignId)
    sessions.end(id)
    expect(() =>
      sessions.appendEvent(id, { role: 'player', kind: 'player-action', text: 'x' })
    ).toThrow(SessionValidationError)
    expect(() =>
      sessions.appendEvent('nope', { role: 'player', kind: 'player-action', text: 'x' })
    ).toThrow(SessionNotFoundError)
  })
})

describe('the Scene', () => {
  it('persists code-applied changes', () => {
    const { id } = sessions.start(campaignId)
    const scene = sessions.scene(id)

    sessions.saveScene(id, {
      ...scene,
      mode: 'dialogue',
      dialogueNpcId: scene.npcs[0].id,
      pendingRoll: { check: 'perception', dc: 12, reason: 'looking around' }
    })

    expect(sessions.scene(id)).toMatchObject({
      mode: 'dialogue',
      dialogueNpcId: scene.npcs[0].id,
      pendingRoll: { check: 'perception', dc: 12 }
    })
  })
})
