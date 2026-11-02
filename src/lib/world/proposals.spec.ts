import { describe, expect, it } from 'vitest'
import {
  acceptCard,
  dismissCard,
  dismissedNotes,
  emptyConversation,
  failMessage,
  historyOf,
  pendingProposals,
  retryMessage,
  receiveTurn,
  sendMessage
} from './proposals.ts'

describe('conversation state', () => {
  it('turns a reply with proposals into one pending card per field', () => {
    let state = sendMessage(emptyConversation(), 'Draft me a world')
    state = receiveTurn(state, 'Here is a start.', { name: 'Eldoria', scale: 'continent' })

    expect(state.cards.map((c) => [c.field, c.value, c.status])).toEqual([
      ['name', 'Eldoria', 'pending'],
      ['scale', 'continent', 'pending']
    ])
    expect(state.entries.map((e) => [e.role, e.content])).toEqual([
      ['user', 'Draft me a world'],
      ['assistant', 'Here is a start.']
    ])
  })

  it('accepting returns the field value to write and marks the card accepted', () => {
    const state = receiveTurn(sendMessage(emptyConversation(), 'hi'), 'ok', { name: 'Eldoria' })

    const result = acceptCard(state, state.cards[0].id)

    expect(result.write).toEqual({ field: 'name', value: 'Eldoria' })
    expect(result.state.cards[0].status).toBe('accepted')
  })

  it('dismissing records a note for later turns and writes nothing', () => {
    let state = receiveTurn(sendMessage(emptyConversation(), 'hi'), 'ok', {
      genreFlavor: 'dark fantasy'
    })

    state = dismissCard(state, state.cards[0].id)

    expect(state.cards[0].status).toBe('dismissed')
    expect(dismissedNotes(state)).toEqual([{ field: 'genreFlavor', value: 'dark fantasy' }])
  })

  it('acting on a settled card does nothing', () => {
    let state = receiveTurn(sendMessage(emptyConversation(), 'hi'), 'ok', { name: 'A' })
    state = dismissCard(state, state.cards[0].id)

    const result = acceptCard(state, state.cards[0].id)

    expect(result.write).toBeNull()
    expect(result.state.cards[0].status).toBe('dismissed')
  })

  it('history carries only the visible messages, in order', () => {
    let state = sendMessage(emptyConversation(), 'one')
    state = receiveTurn(state, 'two', { name: 'X' })
    state = sendMessage(state, 'three')

    expect(historyOf(state)).toEqual([
      { role: 'user', content: 'one' },
      { role: 'assistant', content: 'two' },
      { role: 'user', content: 'three' }
    ])
  })

  it('keeps a failed message visible but out of the history sent to the model', () => {
    let state = receiveTurn(sendMessage(emptyConversation(), 'one'), 'two', { name: 'X' })
    state = failMessage(state, 'three', 'The assistant could not reply.')
    state = sendMessage(state, 'four')

    expect(state.entries.map((e) => [e.content, e.error])).toEqual([
      ['one', undefined],
      ['two', undefined],
      ['three', 'The assistant could not reply.'],
      ['four', undefined]
    ])
    expect(historyOf(state)).toEqual([
      { role: 'user', content: 'one' },
      { role: 'assistant', content: 'two' },
      { role: 'user', content: 'four' }
    ])
  })

  it('a failed turn adds no cards', () => {
    const state = failMessage(emptyConversation(), 'hi', 'boom')

    expect(state.cards).toEqual([])
  })

  it('retrying removes the failed entry and returns its message to resend', () => {
    const failed = failMessage(emptyConversation(), 'hi', 'boom')

    const { state, message } = retryMessage(failed, failed.entries[0].id)

    expect(message).toBe('hi')
    expect(state.entries).toEqual([])
  })

  it('retrying an entry that did not fail does nothing', () => {
    const sent = sendMessage(emptyConversation(), 'hi')

    const { state, message } = retryMessage(sent, sent.entries[0].id)

    expect(message).toBeNull()
    expect(state).toBe(sent)
  })
})

describe('superseding on feedback', () => {
  const propose = (state: ReturnType<typeof emptyConversation>, proposals: object) =>
    receiveTurn(sendMessage(state, 'msg'), 'reply', proposals)

  it('collapses an older pending card for the same field when a new one lands', () => {
    let state = propose(emptyConversation(), { premise: 'A drowned kingdom.' })
    state = propose(state, { premise: 'A drowned kingdom ruled by frogs.' })

    expect(state.cards.map((c) => [c.value, c.status])).toEqual([
      ['A drowned kingdom.', 'superseded'],
      ['A drowned kingdom ruled by frogs.', 'pending']
    ])
  })

  it('leaves older cards for other fields pending', () => {
    let state = propose(emptyConversation(), { premise: 'P', name: 'N' })
    state = propose(state, { premise: 'P2' })

    expect(state.cards.map((c) => [c.field, c.status])).toEqual([
      ['premise', 'superseded'],
      ['name', 'pending'],
      ['premise', 'pending']
    ])
  })

  it('never touches accepted or dismissed cards', () => {
    let state = propose(emptyConversation(), { premise: 'A', name: 'B' })
    state = acceptCard(state, state.cards[0].id).state
    state = dismissCard(state, state.cards[1].id)
    state = propose(state, { premise: 'A2', name: 'B2' })

    expect(state.cards.slice(0, 2).map((c) => c.status)).toEqual(['accepted', 'dismissed'])
  })

  it('stays pending until the revision lands, and accepting it mid-flight works', () => {
    let state = propose(emptyConversation(), { premise: 'Old' })
    const oldId = state.cards[0].id
    state = sendMessage(state, 'make it darker')
    expect(state.cards[0].status).toBe('pending')

    const accepted = acceptCard(state, oldId)
    expect(accepted.write).toEqual({ field: 'premise', value: 'Old' })

    const landed = receiveTurn(accepted.state, 'darker', { premise: 'Darker' })
    expect(landed.cards.map((c) => c.status)).toEqual(['accepted', 'pending'])
  })

  it('a superseded card cannot be acted on and is not a dismissal note', () => {
    let state = propose(emptyConversation(), { premise: 'Old' })
    state = propose(state, { premise: 'New' })
    const oldId = state.cards[0].id

    expect(acceptCard(state, oldId).write).toBeNull()
    expect(dismissCard(state, oldId).cards[0].status).toBe('superseded')
    expect(dismissedNotes(state)).toEqual([])
  })

  it('lists pending proposals for the model', () => {
    let state = propose(emptyConversation(), { premise: 'P', name: 'N' })
    state = dismissCard(state, state.cards[1].id)
    state = propose(state, { premise: 'P2' })

    expect(pendingProposals(state)).toEqual([{ field: 'premise', value: 'P2' }])
  })
})
