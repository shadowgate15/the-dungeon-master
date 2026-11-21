import { page } from 'vitest/browser'
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-svelte'
import type { CallView } from './call.ts'
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

  it("shows the Declaration as the player's line", async () => {
    render(StoryLog, { props: { events: [event(1, 'declaration', 'I pick the lock.')], npcs } })
    await expect.element(page.getByText('I pick the lock.')).toHaveClass(/italic/)
  })

  describe('a Check Call', () => {
    const call: CallView = {
      kind: 'check',
      skill: 'sleight_of_hand',
      difficulty: 'hard',
      declaration: { seq: 1, text: 'I pick the lock.' }
    }
    const raised = [
      event(1, 'declaration', 'I pick the lock.'),
      {
        ...event(2, 'call-raised', 'Sleight of hand check: I pick the lock.'),
        role: 'code' as const
      }
    ]

    it('shows the open Check inline with its skill, its reason and a Roll button, and no DC', async () => {
      const onroll = vi.fn()
      render(StoryLog, { props: { events: raised, npcs, openCall: call, onroll } })

      const check = page.getByRole('group', { name: 'Check' })
      await expect.element(check).toHaveTextContent('Sleight of hand check')
      await expect.element(check).toHaveTextContent('I pick the lock.')
      await expect.element(check).not.toHaveTextContent(/DC|\b20\b/)
      await page.getByRole('button', { name: 'Roll' }).click()
      expect(onroll).toHaveBeenCalledOnce()
    })

    it('disables the Roll button while it cannot be answered', async () => {
      render(StoryLog, { props: { events: raised, npcs, openCall: call } })
      await expect.element(page.getByRole('button', { name: 'Roll' })).toBeDisabled()
    })

    it('shows the roll result line once answered, and no Roll button', async () => {
      const answered = {
        ...event(3, 'call-answered', 'Sleight of hand: 14 + 2 = 16, failure'),
        data: {
          kind: 'check',
          skill: 'sleight_of_hand',
          die: 14,
          modifier: 2,
          total: 16,
          success: false
        }
      }
      render(StoryLog, { props: { events: [...raised, answered], npcs, openCall: null } })

      await expect
        .element(page.getByText('Sleight of hand: 14 + 2 = 16, failure'))
        .toHaveAttribute('data-roll', 'failure')
      await expect.element(page.getByRole('button', { name: 'Roll' })).not.toBeInTheDocument()
    })

    it('shows a withdrawn Check subdued', async () => {
      const withdrawn = {
        ...event(3, 'call-answered', 'Sleight of hand check withdrawn'),
        data: { kind: 'check', skill: 'sleight_of_hand', withdrawn: true }
      }
      render(StoryLog, { props: { events: [...raised, withdrawn], npcs, openCall: null } })

      await expect
        .element(page.getByText('Sleight of hand check withdrawn'))
        .toHaveAttribute('data-withdrawn')
      await expect
        .element(page.getByText('Sleight of hand check: I pick the lock.'))
        .toHaveAttribute('data-withdrawn')
    })
  })

  it('shows the thinking indicator until the Reply streams', async () => {
    const { rerender } = render(StoryLog, { props: { events: [], npcs, thinking: true } })
    await expect.element(page.getByRole('status')).toHaveTextContent('thinking')

    await rerender({ events: [], npcs, thinking: true, live: 'The door' })
    await expect.element(page.getByRole('status')).not.toBeInTheDocument()
    await expect.element(page.getByLabelText('Narration in progress')).toHaveTextContent('The door')
  })
})
