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
  role: kind === 'npc-line' ? 'npc' : 'narrator',
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
})
