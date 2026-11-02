import type { SeedField } from './seed.ts'

/**
 * Client-safe, UI-free state for the World creation conversation. Every function is
 * pure: it takes a state and returns a new one. The transcript lives only in memory.
 *
 * Card lifecycle: `pending` -> `accepted` | `dismissed` | `superseded`. A pending card
 * is superseded inside `receiveTurn` when a new proposal for the same field lands, so an
 * older card stays acceptable while a revision is in flight. Settled cards never change.
 */

export type CardStatus = 'pending' | 'accepted' | 'dismissed' | 'superseded'

export interface ProposalCard {
  id: string
  /** The turn (assistant entry) that produced this card. */
  turn: number
  field: SeedField
  value: string
  status: CardStatus
}

export interface ChatEntry {
  id: string
  role: 'user' | 'assistant'
  content: string
  /** For assistant entries: the turn number, matching `ProposalCard.turn`. */
  turn?: number
  /** For user entries whose turn failed: what went wrong. Such entries are not history. */
  error?: string
}

export interface ConversationState {
  entries: ChatEntry[]
  cards: ProposalCard[]
  /** Counter for ids and turns. Monotonic. */
  nextId: number
}

export interface DismissedNote {
  field: SeedField
  value: string
}

export function emptyConversation(): ConversationState {
  return { entries: [], cards: [], nextId: 1 }
}

export function sendMessage(state: ConversationState, content: string): ConversationState {
  return {
    ...state,
    nextId: state.nextId + 1,
    entries: [...state.entries, { id: `m${state.nextId}`, role: 'user', content }]
  }
}

/** Records a message whose turn failed: visible, retryable, never sent to the model. */
export function failMessage(
  state: ConversationState,
  content: string,
  error: string
): ConversationState {
  return {
    ...state,
    nextId: state.nextId + 1,
    entries: [...state.entries, { id: `m${state.nextId}`, role: 'user', content, error }]
  }
}

/** Removes a failed entry and returns its message so the caller can send it again. */
export function retryMessage(state: ConversationState, id: string) {
  const entry = state.entries.find((e) => e.id === id)
  if (!entry || entry.error === undefined) return { state, message: null }
  return {
    state: { ...state, entries: state.entries.filter((e) => e.id !== id) },
    message: entry.content
  }
}

/** Adds the assistant reply and one pending card per proposed field. */
export function receiveTurn(
  state: ConversationState,
  reply: string,
  proposals: Partial<Record<SeedField, string>>
): ConversationState {
  const turn = state.nextId
  const cards: ProposalCard[] = (Object.entries(proposals) as [SeedField, string][]).map(
    ([field, value], i) => ({
      id: `c${turn}-${i}`,
      turn,
      field,
      value,
      status: 'pending'
    })
  )
  const revised = new Set(cards.map((c) => c.field))
  const older = state.cards.map((c) =>
    c.status === 'pending' && revised.has(c.field) ? { ...c, status: 'superseded' as const } : c
  )
  return {
    entries: [...state.entries, { id: `m${turn}`, role: 'assistant', content: reply, turn }],
    cards: [...older, ...cards],
    nextId: turn + 1
  }
}

function settle(state: ConversationState, id: string, status: CardStatus) {
  const card = state.cards.find((c) => c.id === id)
  if (!card || card.status !== 'pending') return { card: null, state }
  return {
    card,
    state: { ...state, cards: state.cards.map((c) => (c.id === id ? { ...c, status } : c)) }
  }
}

/** Accepts a pending card. `write` is what the caller must put on the seed card. */
export function acceptCard(state: ConversationState, id: string) {
  const { card, state: next } = settle(state, id, 'accepted')
  return {
    state: next,
    write: card ? { field: card.field, value: card.value } : null
  }
}

export function dismissCard(state: ConversationState, id: string): ConversationState {
  return settle(state, id, 'dismissed').state
}

export function dismissedNotes(state: ConversationState): DismissedNote[] {
  return state.cards
    .filter((c) => c.status === 'dismissed')
    .map(({ field, value }) => ({ field, value }))
}

/** Proposals still awaiting a decision, so the model can revise them on feedback. */
export function pendingProposals(state: ConversationState): DismissedNote[] {
  return state.cards
    .filter((c) => c.status === 'pending')
    .map(({ field, value }) => ({ field, value }))
}

export function historyOf(state: ConversationState) {
  return state.entries
    .filter((e) => e.error === undefined)
    .map(({ role, content }) => ({ role, content }))
}
