import { page } from 'vitest/browser'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import type { SceneState, SessionEvent } from './enums.ts'
import SceneStatePanel from './SceneStatePanel.svelte'

const scene: SceneState = {
  location: { name: 'The Rusty Flagon', description: 'A smoky tavern.' },
  exits: [{ id: 'door', name: 'Front door' }],
  objects: ['Hearth'],
  npcs: [
    { id: 'mira', key: 'mira', name: 'Mira', attitude: 'friendly', knowledge: 'Knows the key.' }
  ],
  mode: 'exploration',
  dialogueNpcId: null,
  pendingRoll: null
}

const line = (seq: number, text: string): SessionEvent => ({
  id: `e${seq}`,
  sessionId: 's',
  seq,
  role: 'npc',
  kind: 'npc-line',
  text,
  npcId: 'mira',
  data: null,
  createdAt: 0
})

describe('SceneStatePanel', () => {
  it('shows the full location and no conversation focus in exploration', async () => {
    render(SceneStatePanel, { scene, log: [line(1, 'Hello.')] })

    await expect.element(page.getByRole('region', { name: 'Conversation' })).not.toBeInTheDocument()
    await expect.element(page.getByText('A smoky tavern.')).toBeVisible()
  })

  it('foregrounds the NPC with their latest line and attitude in dialogue', async () => {
    render(SceneStatePanel, {
      scene: { ...scene, mode: 'dialogue', dialogueNpcId: 'mira' },
      log: [line(1, 'Hello.'), line(2, 'The key is below.')]
    })

    const focus = page.getByRole('region', { name: 'Conversation' })
    await expect.element(focus).toHaveTextContent('Mira')
    await expect.element(focus).toHaveTextContent('friendly')
    await expect.element(focus).toHaveTextContent('The key is below.')
    await expect.element(focus).not.toHaveTextContent('Hello.')
  })

  it('shrinks the location to a backdrop in dialogue', async () => {
    render(SceneStatePanel, {
      scene: { ...scene, mode: 'dialogue', dialogueNpcId: 'mira' },
      log: []
    })

    await expect.element(page.getByText('The Rusty Flagon')).toBeVisible()
    await expect.element(page.getByText('A smoky tavern.')).not.toBeInTheDocument()
  })
})
