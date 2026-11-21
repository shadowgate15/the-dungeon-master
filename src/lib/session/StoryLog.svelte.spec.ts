import { page } from 'vitest/browser'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import type { SceneNpc, SessionEvent } from './enums.ts'
import StoryLog from './StoryLog.svelte'

const npcs: SceneNpc[] = [
  { id: 'mira', key: 'mira', name: 'Mira', attitude: 'friendly', knowledge: '' }
]

const event = (seq: number, kind: SessionEvent['kind'], text: string): SessionEvent => ({
  id: `e${seq}`,
  sessionId: 's',
  seq,
  role: kind === 'npc-line' ? 'npc' : kind === 'declaration' ? 'player' : 'narrator',
  kind,
  text,
  npcId: kind === 'npc-line' ? 'mira' : null,
  data: null,
  createdAt: 0
})

const events = [
  event(1, 'mode-changed', 'Dialogue with Mira'),
  event(2, 'narration', 'Mira looks up.'),
  event(3, 'npc-line', 'Well met.')
]

describe('StoryLog', () => {
  it('reads as a conversation in dialogue, with narration as a stage direction', async () => {
    render(StoryLog, { props: { events, npcs, mode: 'dialogue' } })

    await expect.element(page.getByText('Well met.')).toBeVisible()
    await expect.element(page.getByText('Mira looks up.')).toHaveAttribute('data-aside')
  })

  it('keeps narration as prose in exploration', async () => {
    render(StoryLog, { props: { events, npcs, mode: 'exploration' } })

    await expect.element(page.getByText('Mira looks up.')).not.toHaveAttribute('data-aside')
  })

  it("shows the Declaration as the player's line and a Call as a subdued note", async () => {
    const log = [
      event(1, 'declaration', 'I pick the lock.'),
      event(2, 'call-raised', 'Roll Sleight of Hand.'),
      event(3, 'call-answered', 'Rolled 14.'),
      event(4, 'narration', 'The lock clicks.')
    ]
    render(StoryLog, { props: { events: log, npcs } })

    await expect.element(page.getByText('I pick the lock.')).toHaveClass(/italic/)
    await expect.element(page.getByText('Roll Sleight of Hand.')).toHaveAttribute('data-call')
    await expect.element(page.getByText('Rolled 14.')).toHaveAttribute('data-call')
  })

  it('shows the thinking indicator until the Reply streams', async () => {
    const { rerender } = render(StoryLog, { props: { events: [], npcs, thinking: true } })
    await expect.element(page.getByRole('status')).toHaveTextContent('thinking')

    await rerender({ events: [], npcs, thinking: true, live: 'The door' })
    await expect.element(page.getByRole('status')).not.toBeInTheDocument()
    await expect.element(page.getByLabelText('Narration in progress')).toHaveTextContent('The door')
  })
})
