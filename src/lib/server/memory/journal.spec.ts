import { beforeEach, describe, expect, it } from 'vitest'
import type { Database } from '../db/connect'
import { fact, place, worldCampaign } from '../db/schema'
import {
  addNpc,
  playableCampaign,
  sessionServiceWith,
  setSceneNpcs,
  type PlayableCampaign
} from '../session/fixture'
import type { SessionService } from '../session/service'
import { createJournal } from './journal.ts'

let fixture: PlayableCampaign
let db: Database
let sessions: SessionService
let s1: string
let clock: number

beforeEach(async () => {
  clock = 1000
  fixture = playableCampaign()
  db = fixture.db
  sessions = sessionServiceWith(fixture, undefined, () => ++clock).sessions
  s1 = (await sessions.start(fixture.campaignId)).id
})

const journal = () => createJournal(db).read(fixture.campaignId, fixture.characterId)
const names = (j: ReturnType<typeof journal>) =>
  j.people.flatMap((g) => g.entries.map((e) => e.name))

describe('the Journal', () => {
  it('lists the First Scene NPCs with role, status and stance only', () => {
    const brenna = journal()
      .people.flatMap((g) => g.entries)
      .find((e) => e.name === 'Brenna')
    expect(brenna).toEqual({
      id: expect.any(String),
      name: 'Brenna',
      role: 'Innkeeper',
      status: 'alive',
      stance: 'friendly'
    })
  })

  it('hides an NPC that was never in a Scene or named in narration', () => {
    addNpc(fixture, { name: 'Zed', knows: [{ title: 'Secret', detail: 'Hidden vault' }] })
    expect(names(journal())).not.toContain('Zed')
  })

  it('shows an NPC once a Scene held them, even after the Session moved on', async () => {
    const zed = addNpc(fixture, { name: 'Zed', status: 'dead', stance: 'hostile' })
    setSceneNpcs(fixture, s1, [zed])
    sessions.end(s1)
    await sessions.start(fixture.campaignId)
    expect(
      journal()
        .people.flatMap((g) => g.entries)
        .find((e) => e.name === 'Zed')
    ).toMatchObject({
      status: 'dead',
      stance: 'hostile'
    })
  })

  it('shows an NPC who spoke in the story', () => {
    const zed = addNpc(fixture, { name: 'Zed' })
    sessions.appendEvent(s1, { role: 'npc', kind: 'npc-line', text: 'Hello.', npcId: zed })
    expect(names(journal())).toContain('Zed')
  })

  it('shows an NPC once narration names them', () => {
    addNpc(fixture, { name: 'Zed' })
    sessions.appendEvent(s1, {
      role: 'narrator',
      kind: 'narration',
      text: 'A shadow named zed waits.'
    })
    expect(names(journal())).toContain('Zed')
  })

  it('never exposes what an NPC knows, and skips retired NPCs', () => {
    const zed = addNpc(fixture, {
      name: 'Zed',
      knows: [{ title: 'Vault', detail: 'Under the mill' }]
    })
    const gone = addNpc(fixture, { name: 'Gone', retired: true })
    setSceneNpcs(fixture, s1, [zed, gone])
    const j = journal()
    expect(names(j)).toContain('Zed')
    expect(names(j)).not.toContain('Gone')
    expect(JSON.stringify(j.people)).not.toContain('Under the mill')
  })

  it('groups by Session, newest first, and lists live places and facts', async () => {
    const worldId = db.select().from(worldCampaign).get()!.worldId
    sessions.end(s1)
    const s2 = (await sessions.start(fixture.campaignId)).id
    const stamp = (id: string) => ({ createdSessionId: id, changedSessionId: id })
    db.insert(place)
      .values({
        campaignId: fixture.campaignId,
        worldId,
        name: 'Mill',
        description: 'Old.',
        ...stamp(s2)
      })
      .run()
    db.insert(fact)
      .values([
        { campaignId: fixture.campaignId, title: 'Live', detail: 'd', ...stamp(s2) },
        {
          campaignId: fixture.campaignId,
          title: 'Old',
          detail: 'd',
          ...stamp(s1),
          retiredAt: 1,
          retiredReason: 'x'
        }
      ])
      .run()
    const j = journal()
    expect(j.places.map((g) => [g.sessionNumber, g.entries.map((e) => e.name)])).toEqual([
      [2, ['Mill']],
      [1, ['The Gilded Stag']]
    ])
    expect(j.facts.map((g) => [g.sessionNumber, g.entries.map((e) => e.title)])).toEqual([
      [2, ['Live']]
    ])
  })
})
