import { SOLO_PLAYER } from '#lib/character/enums.ts'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { tempDir } from '../../../testing/temp-dir'
import { testLibrary } from '../../../testing/library'
import type { LiveMessage } from '#lib/live/messages.ts'
import { createChannels, type ChannelEvent } from '../bridge/channels'
import type { CampaignLibrary } from '../campaign/library'
import { addCharacter, fighterDraft } from '../character/test-characters'
import { gameTools } from '../tools'
import { createToolHost, type ToolHost } from '../tools/host'
import { createPlay, DmAwayError, DmBusyError, type Play } from './play'

let library: CampaignLibrary
let host: ToolHost
let play: Play
let folder: string
let campaignId: string
let heard: ChannelEvent[]
let claimsHeard: ChannelEvent[]
let pushed: LiveMessage[]

beforeEach(() => {
  const tmp = tempDir('play')
  library = testLibrary({ home: path.join(tmp, 'home') })
  folder = path.join(tmp, 'campaigns', 'ember-road')
  campaignId = library.create({ name: 'Ember Road', folder }).id
  const channels = createChannels()
  heard = []
  pushed = []
  claimsHeard = []
  // `claims` events are kept apart: they never await Narration and the turn's specs ignore them.
  channels.listen(folder, (e) => (e.meta.kind === 'claims' ? claimsHeard : heard).push(e))
  const publish = (m: LiveMessage) => pushed.push(m)
  host = createToolHost({ library, tools: gameTools, publish })
  play = createPlay({ library, channels, publish })
})

afterEach(() => library.close())

const addFighter = (name: string) => addCharacter(library, campaignId, fighterDraft(name))

/** The parsed payload of a tool call. */
function call(name: string, args: unknown = {}) {
  const result = host.call(folder, name, args)
  return { isError: result.isError ?? false, payload: JSON.parse(result.content[0].text) }
}

describe('Done', () => {
  it('closes the Floor and wakes the DM with one floor event listing every Declaration', () => {
    const wren = addFighter('Wren')
    const floor = library.floor(campaignId)
    floor.send({ character: wren, text: 'I pick the lock.', player: SOLO_PLAYER })
    floor.send({ character: wren, text: 'I keep an eye on the street.', player: SOLO_PLAYER })

    play.done(campaignId, SOLO_PLAYER)

    expect(heard).toHaveLength(1)
    expect(heard[0].meta).toMatchObject({ kind: 'floor', players: 'Host · Player of Wren' })
    expect(heard[0].meta.floor_id).toEqual(expect.any(String))
    expect(heard[0].content).toBe(
      '[d1 Wren · Host · Player of Wren] I pick the lock.\n[d2 Wren · Host · Player of Wren] I keep an eye on the street.'
    )
    expect(library.floor(campaignId).current(SOLO_PLAYER).declarations).toEqual([])
  })

  it('sends a two-Character Floor as one event, in send order', () => {
    const wren = addFighter('Wren')
    const bram = addFighter('Bram')
    const floor = library.floor(campaignId)
    floor.send({ character: wren, text: 'I pick the lock.', player: SOLO_PLAYER })
    floor.send({ character: bram, text: 'I bar the door.', player: SOLO_PLAYER })

    play.done(campaignId, SOLO_PLAYER)

    expect(heard).toHaveLength(1)
    expect(heard[0].content).toBe(
      '[d1 Wren · Host · Player of Wren & Bram] I pick the lock.\n[d2 Bram · Host · Player of Wren & Bram] I bar the door.'
    )
  })

  it('on an empty Floor still wakes the DM, handing over the initiative', () => {
    addFighter('Wren')

    play.done(campaignId, SOLO_PLAYER)

    expect(heard).toEqual([
      {
        content: 'passed: Host · Player of Wren',
        meta: expect.objectContaining({ kind: 'floor', players: 'Host · Player of Wren' })
      }
    ])
    expect(play.timeline(campaignId, SOLO_PLAYER).awaitingSince).toEqual(expect.any(Number))
  })

  it('sets awaiting Narration, and is refused while the DM is still answering', () => {
    const wren = addFighter('Wren')
    library
      .floor(campaignId)
      .send({ character: wren, text: 'I pick the lock.', player: SOLO_PLAYER })

    play.done(campaignId, SOLO_PLAYER)

    expect(play.timeline(campaignId, SOLO_PLAYER).awaitingSince).toEqual(expect.any(Number))
    expect(() => play.done(campaignId, SOLO_PLAYER)).toThrow(DmBusyError)
    expect(heard).toHaveLength(1)
  })

  it('tells the browser the Floor and the timeline changed', () => {
    addFighter('Wren')

    play.done(campaignId, SOLO_PLAYER)

    expect(pushed).toEqual([
      { type: 'floor', campaign: campaignId },
      { type: 'timeline', campaign: campaignId }
    ])
  })
})

describe('narrate', () => {
  it('clears awaiting Narration and puts the Narration in the timeline', () => {
    const wren = addFighter('Wren')
    library
      .floor(campaignId)
      .send({ character: wren, text: 'I pick the lock.', player: SOLO_PLAYER })
    play.done(campaignId, SOLO_PLAYER)

    expect(call('narrate', { text: 'The lock clicks open.' })).toEqual({
      isError: false,
      payload: expect.anything()
    })

    const timeline = play.timeline(campaignId, SOLO_PLAYER)
    expect(timeline.awaitingSince).toBeNull()
    expect(timeline.entries).toEqual([
      {
        type: 'declaration',
        id: expect.any(String),
        character: 'Wren',
        player: 'player',
        text: 'I pick the lock.'
      },
      { type: 'narration', id: expect.any(String), text: 'The lock clicks open.', voice: null }
    ])
  })

  it('answers a two-Character Floor with one Narration', () => {
    const wren = addFighter('Wren')
    const bram = addFighter('Bram')
    const floor = library.floor(campaignId)
    floor.send({ character: wren, text: 'I pick the lock.', player: SOLO_PLAYER })
    floor.send({ character: bram, text: 'I bar the door.', player: SOLO_PLAYER })
    play.done(campaignId, SOLO_PLAYER)

    call('narrate', { text: 'The lock gives; the door holds.' })

    expect(play.timeline(campaignId, SOLO_PLAYER).entries.map((e) => e.type)).toEqual([
      'declaration',
      'declaration',
      'narration'
    ])
  })

  it('allows later Narrations in the same turn', () => {
    addFighter('Wren')
    play.done(campaignId, SOLO_PLAYER)

    call('narrate', { text: 'Rain hammers the shutters.' })
    expect(call('narrate', { text: 'Somewhere a dog barks.' }).isError).toBe(false)

    expect(play.timeline(campaignId, SOLO_PLAYER).entries).toHaveLength(2)
  })

  it('shows the NPC a Narration is voiced by, by the name the Characters know', () => {
    addCharacter(library, campaignId, fighterDraft('Wren'))
    const npc = call('establish', { type: 'npc', name: 'Mira Voss' }).payload.handle
    call('reveal', { of: npc })

    call('narrate', { text: '"You are late," she says.', voice: npc })

    expect(play.timeline(campaignId, SOLO_PLAYER).entries).toEqual([
      expect.objectContaining({ type: 'narration', voice: 'Mira Voss' })
    ])
  })

  it('refuses a voice that names no NPC', () => {
    expect(call('narrate', { text: 'Hello.', voice: 'npc:nobody' })).toEqual({
      isError: true,
      payload: expect.objectContaining({ code: 'unknown_handle' })
    })
  })

  it('pushes the timeline change to the browser', () => {
    call('narrate', { text: 'The lock clicks open.' })

    expect(pushed).toContainEqual({ type: 'timeline', campaign: campaignId })
  })
})

describe('Done per browser', () => {
  const GUEST = 'guest-browser'

  /** Wren is the Host's, Bram the guest's, Tamsin unclaimed; all in the Scene. */
  function table() {
    const wren = addFighter('Wren')
    const bram = addFighter('Bram')
    const tamsin = addFighter('Tamsin')
    play.letGo(campaignId, bram, SOLO_PLAYER)
    play.claim(campaignId, bram, GUEST)
    play.letGo(campaignId, tamsin, SOLO_PLAYER)
    return { wren, bram, tamsin }
  }

  it('waits for every browser with a Claimed Character, and never counts unclaimed ones', () => {
    table()
    expect(play.done(campaignId, SOLO_PLAYER).closed).toBe(false)
    expect(heard).toHaveLength(0)
    expect(play.done(campaignId, GUEST).closed).toBe(true)
    expect(heard).toHaveLength(1)
  })

  it('takes back Done with Not done yet until the Floor closes', () => {
    table()
    play.done(campaignId, SOLO_PLAYER)
    play.undone(campaignId, SOLO_PLAYER)
    expect(play.done(campaignId, GUEST).closed).toBe(false)
    expect(play.done(campaignId, SOLO_PLAYER).closed).toBe(true)
    // Closed: nothing left to take back.
    play.undone(campaignId, SOLO_PLAYER)
    expect(library.floor(campaignId).current(SOLO_PLAYER).declarations).toEqual([])
  })

  it("withdraws the lost Character's Declarations and closes the Floor if the rest are Done", () => {
    const { bram } = table()
    library.floor(campaignId).send({ character: bram, text: 'I bar the door.', player: GUEST })
    play.done(campaignId, SOLO_PLAYER)
    expect(heard).toHaveLength(0)

    play.letGo(campaignId, bram, GUEST)

    expect(heard).toHaveLength(1)
    expect(heard[0].meta).toMatchObject({ kind: 'floor' })
    expect(heard[0].content).not.toContain('bar the door')
  })

  it('withdraws Declarations on Let go but keeps waiting while a remaining browser is undecided', () => {
    const { bram } = table()
    library.floor(campaignId).send({ character: bram, text: 'I bar the door.', player: GUEST })

    play.letGo(campaignId, bram, GUEST)

    expect(library.floor(campaignId).current(SOLO_PLAYER).declarations).toEqual([])
    expect(heard).toHaveLength(0)
  })

  it('waits when no Claimed Character is left in the Scene', () => {
    const { wren, bram } = table()
    play.done(campaignId, GUEST)
    play.letGo(campaignId, bram, GUEST)
    play.letGo(campaignId, wren, SOLO_PLAYER)

    expect(heard).toHaveLength(0)
    expect(play.done(campaignId, SOLO_PLAYER).closed).toBe(false)
    expect(heard).toHaveLength(0)
  })
})

describe('Sessions', () => {
  it('stamps Declarations and Narrations with the Session the DM opened on attach', () => {
    const wren = addFighter('Wren')
    play.openSession(campaignId)
    library
      .floor(campaignId)
      .send({ character: wren, text: 'I pick the lock.', player: SOLO_PLAYER })
    play.done(campaignId, SOLO_PLAYER)
    call('narrate', { text: 'The lock clicks open.' })

    const logged = host.events(folder).filter((e) => ['declaration', 'narration'].includes(e.kind))
    expect(logged.map((e) => e.kind)).toEqual(['declaration', 'narration'])
    const [session] = new Set(logged.map((e) => e.session))
    expect(session).toEqual(expect.any(String))
    expect(logged.every((e) => e.session === session && e.minute === 0)).toBe(true)
  })

  it('reuses the open Session when the DM reattaches', () => {
    const first = play.openSession(campaignId)
    expect(play.openSession(campaignId)).toEqual(first)
  })

  it('leaves offline changes outside any Session', () => {
    call('narrate', { text: 'Offline.' })
    expect(host.events(folder).at(-1)?.session).toBeNull()
  })
})

describe('DM activity', () => {
  it('shows a Player-safe line for each tool call, never the raw result', () => {
    call('seed')
    call('establish', { type: 'npc', name: 'Mira Voss', page: 'Secretly the smuggler queen.' })

    const timeline = play.timeline(campaignId, SOLO_PLAYER)
    expect(timeline.entries).toEqual([
      expect.objectContaining({ type: 'activity', text: 'DM checks the Campaign Seed' })
    ])
    const wire = JSON.stringify({ timeline, pushed })
    expect(wire).not.toContain('npc:')
    expect(wire).not.toContain('smuggler')
    expect(pushed.every((m) => Object.keys(m).sort().join() === 'campaign,type')).toBe(true)
  })

  it('a failed call shows no line', () => {
    call('narrate', { text: 'Hello.', voice: 'npc:nobody' })
    expect(play.timeline(campaignId, SOLO_PLAYER).entries).toEqual([])
  })
})

describe('End Session', () => {
  it('wakes the DM with one end_session event and leaves awaiting Narration alone', () => {
    play.endSession(campaignId)

    expect(heard).toEqual([{ content: expect.any(String), meta: { kind: 'end_session' } }])
    expect(play.timeline(campaignId, SOLO_PLAYER).awaitingSince).toBeNull()
  })
})

describe('Player labels on what the DM hears', () => {
  /** A Character Claimed by `browser`. */
  function addFor(name: string, browser: string) {
    const party = library.party(campaignId)
    const { id } = party.startDraft({ player: browser })
    return party.saveDraft(id, { draft: fighterDraft(name), step: 'review' }).id
  }

  it('labels each Player by Claimed Characters and marks the Host on a floor event', () => {
    const wren = addFor('Wren', SOLO_PLAYER)
    const ash = addFor('Ash', 'b-1')
    const bram = addFor('Bram', 'b-1')
    const kael = addFor('Kael', 'b-2')
    const floor = library.floor(campaignId)
    floor.send({ character: wren, text: 'I pick the lock.', player: SOLO_PLAYER })
    floor.send({ character: ash, text: 'I scout.', player: 'b-1' })
    play.done(campaignId, 'b-1')
    play.done(campaignId, 'b-2')
    play.done(campaignId, SOLO_PLAYER)

    expect(heard).toHaveLength(1)
    expect(heard[0].content).toBe(
      '[d1 Wren · Host · Player of Wren] I pick the lock.\n[d2 Ash · Player of Ash & Bram] I scout.\npassed: Player of Kael'
    )
    expect(heard[0].meta.players).toBe('Player of Ash & Bram,Player of Kael,Host · Player of Wren')
    expect(heard[0].content).not.toContain('b-1')
    void bram
    void kael
  })

  it('labels the spotlight request', () => {
    addFor('Wren', SOLO_PLAYER)
    const bram = addFor('Bram', 'b-1')
    call('establish', { type: 'place', name: 'The Docks' })
    call('establish', { type: 'place', name: 'Drowned Lantern' })
    call('move', { who: ['char:wren'], to: 'place:drowned-lantern' })
    call('move', { who: ['char:bram'], to: 'place:the-docks' })
    call('set_scene', { place: 'place:drowned-lantern' })

    play.spotlight(campaignId, bram, 'b-1')

    expect(heard[0].meta).toEqual({
      kind: 'spotlight',
      character: 'char:bram',
      player: 'Player of Bram'
    })
  })

  it('tags creation-chat lines before Begin with the sender\'s Characters or "a Player"', () => {
    addFor('Wren', 'b-1')
    play.converse(campaignId, 'Make it grim.', 'b-1')
    play.converse(campaignId, 'Make it silly.', 'b-2')

    expect(heard.map((e) => e.content)).toEqual([
      '[Player of Wren] Make it grim.',
      '[a Player] Make it silly.'
    ])
  })
})

describe('spotlight requests', () => {
  it('asks the DM to cut to a Character elsewhere, without awaiting Narration', () => {
    addFighter('Wren')
    const bram = addFighter('Bram')
    call('establish', { type: 'place', name: 'The Docks' })
    call('establish', { type: 'place', name: 'Drowned Lantern' })
    call('move', { who: ['char:wren'], to: 'place:drowned-lantern' })
    call('move', { who: ['char:bram'], to: 'place:the-docks' })
    call('set_scene', { place: 'place:drowned-lantern' })

    play.spotlight(campaignId, bram, SOLO_PLAYER)

    expect(heard).toEqual([
      {
        content: 'Cut to Bram (char:bram), at place:the-docks',
        meta: { kind: 'spotlight', character: 'char:bram', player: 'Host · Player of Wren & Bram' }
      }
    ])
    expect(play.timeline(campaignId, SOLO_PLAYER).awaitingSince).toBeNull()
  })

  it('is refused for a Character already in the Scene', () => {
    const wren = addFighter('Wren')
    expect(() => play.spotlight(campaignId, wren, SOLO_PLAYER)).toThrow(/already in the Scene/)
    expect(heard).toEqual([])
  })
})

describe('the creation conversation', () => {
  it('hands a pane message to the DM as one conversation event, outside the Floor', () => {
    play.converse(campaignId, 'Can you help with the premise?', SOLO_PLAYER)

    expect(heard).toEqual([
      {
        content: '[Host] Can you help with the premise?',
        meta: { kind: 'conversation', player: 'Host' }
      }
    ])
    expect(library.conversation(campaignId).list()).toEqual([
      expect.objectContaining({
        author: 'player',
        player: 'player',
        text: 'Can you help with the premise?'
      })
    ])
    expect(pushed).toContainEqual({ type: 'conversation', campaign: campaignId })
    expect(library.record(campaignId).timeline('player').awaitingSince).toBeNull()
  })

  it('shows the DM’s reply in the pane', () => {
    play.converse(campaignId, 'Can you help with the premise?', SOLO_PLAYER)
    expect(call('reply', { text: 'Gladly. What draws you to the hills?' }).isError).toBe(false)
    expect(
      library
        .conversation(campaignId)
        .list()
        .map((m) => [m.author, m.text])
    ).toEqual([
      ['player', 'Can you help with the premise?'],
      ['dm', 'Gladly. What draws you to the hills?']
    ])
  })

  it('lands nothing in the Event log or the timeline', () => {
    play.converse(campaignId, 'Hello?', SOLO_PLAYER)
    call('reply', { text: 'Hello.' })
    expect(host.events(folder)).toEqual([])
    expect(library.record(campaignId).timeline('player').entries).toEqual([])
  })

  it('refuses a message while no DM is at the table', () => {
    const away = createPlay({ library, channels: createChannels(), publish: () => {} })
    expect(() => away.converse(campaignId, 'Hello?', SOLO_PLAYER)).toThrow(DmAwayError)
    expect(library.conversation(campaignId).list()).toEqual([])
  })
})

describe('the DM away', () => {
  /** The play module with no DM listening on the Campaign's channel. */
  const awayPlay = () =>
    createPlay({ library, channels: createChannels(), publish: (m) => pushed.push(m) })

  it('refuses every play input: Declarations, Done, rolls and answers, End Session, Cut to', () => {
    const wren = addFighter('Wren')
    const away = awayPlay()

    expect(() => away.floor(campaignId)).toThrow(DmAwayError)
    expect(() => away.done(campaignId, SOLO_PLAYER)).toThrow(DmAwayError)
    expect(() => away.roll(campaignId, 'call', 'part', SOLO_PLAYER)).toThrow(DmAwayError)
    expect(() => away.answer(campaignId, 'call', 'part', 'Left', SOLO_PLAYER)).toThrow(DmAwayError)
    expect(() => away.endSession(campaignId)).toThrow(DmAwayError)
    expect(() => away.spotlight(campaignId, wren, SOLO_PLAYER)).toThrow(DmAwayError)
    expect(host.events(folder).map((e) => e.kind)).toEqual(['change'])
  })

  it('keeps a waiting Floor and an open Call for the next opening', () => {
    const wren = addFighter('Wren')
    play.floor(campaignId).send({ character: wren, text: 'I pick the lock.', player: SOLO_PLAYER })
    call('narrate', {
      text: 'The lock is stiff.',
      call: {
        kind: 'check',
        character: 'char:wren',
        skill: 'sleight-of-hand',
        tier: 'hard',
        reason: 'stiff lock'
      }
    })
    const away = awayPlay()

    expect(() => away.done(campaignId, SOLO_PLAYER)).toThrow(DmAwayError)
    expect(library.floor(campaignId).current(SOLO_PLAYER).declarations).toHaveLength(1)
    expect(away.timeline(campaignId, SOLO_PLAYER).call).not.toBeNull()
  })

  it('lets the console be browsed', () => {
    addFighter('Wren')
    const away = awayPlay()
    expect(away.timeline(campaignId, SOLO_PLAYER).entries).toEqual([])
    expect(away.scene(campaignId, SOLO_PLAYER)).toBeDefined()
  })
})

describe('claims events', () => {
  const GUEST = 'guest-browser'

  it('tells the DM on Let go, Claim and Release, without awaiting Narration', () => {
    const wren = addFighter('Wren')
    const bram = addFighter('Bram')
    play.letGo(campaignId, bram, SOLO_PLAYER)
    claimsHeard.length = 0

    play.claim(campaignId, bram, GUEST)
    play.release(campaignId, bram, SOLO_PLAYER)
    play.letGo(campaignId, wren, SOLO_PLAYER)

    expect(claimsHeard.map((e) => e.content)).toEqual([
      'Bram is now played by Player of Bram',
      'Bram is unclaimed',
      'Wren is unclaimed'
    ])
    expect(library.record(campaignId).timeline().awaitingSince).toBeNull()
  })

  it('stays quiet when no DM is at the table', () => {
    const wren = addFighter('Wren')
    const away = createPlay({ library, channels: createChannels(), publish: () => {} })

    expect(() => away.letGo(campaignId, wren, SOLO_PLAYER)).not.toThrow()
    expect(heard).toEqual([])
  })
})

describe('a Session with no Claims at open', () => {
  it('opens at once, runs a Floor for the one who Claimed, and takes a latecomer at the next Floor', () => {
    const wren = addFighter('Wren')
    const bram = addFighter('Bram')
    play.letGo(campaignId, wren, SOLO_PLAYER)
    play.letGo(campaignId, bram, SOLO_PLAYER)

    expect(play.openSession(campaignId).number).toBe(1)
    expect(play.sessionStart(campaignId)).toContain(
      "Who's at the table: no one has Claimed yet; unclaimed: Wren, Bram."
    )

    play.claim(campaignId, wren, SOLO_PLAYER)
    library.floor(campaignId).send({ character: wren, text: 'I look around.', player: SOLO_PLAYER })
    expect(play.done(campaignId, SOLO_PLAYER).closed).toBe(true)
    expect(heard[0].content).toContain('I look around.')

    call('narrate', { text: 'The room is quiet.' })
    // The latecomer arrives after the Floor closed and decides at the next one.
    play.claim(campaignId, bram, 'late-browser')
    library.floor(campaignId).send({ character: bram, text: 'I join in.', player: 'late-browser' })
    expect(play.done(campaignId, SOLO_PLAYER).closed).toBe(false)
    expect(play.done(campaignId, 'late-browser').closed).toBe(true)
  })
})
