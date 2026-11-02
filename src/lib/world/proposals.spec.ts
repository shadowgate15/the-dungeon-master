import { describe, expect, it } from 'vitest'
import {
  acceptCard,
  dismissCard,
  dismissedNotes,
  emptyConversation,
  historyOf,
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
})
