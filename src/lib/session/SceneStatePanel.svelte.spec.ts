import { page } from 'vitest/browser'
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-svelte'
import type { SceneView, SessionEvent } from './enums.ts'
import SceneStatePanel from './SceneStatePanel.svelte'

const scene: SceneView = {
  location: { name: 'The Rusty Flagon', description: 'A smoky tavern.' },
  exits: [{ id: 'door', name: 'Front door' }],
  objects: ['Hearth'],
  npcs: [
    { id: 'mira', key: 'mira', name: 'Mira', attitude: 'friendly', knowledge: 'Knows the key.' }
  ],
  mode: 'exploration',
  dialogueNpcId: null,
  openCall: null
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

  it('shows the open Call by skill and reason, never its DC', async () => {
    render(SceneStatePanel, {
      scene: {
        ...scene,
        openCall: {
          kind: 'check',
          skill: 'athletics',
          difficulty: 'hard',
          declaration: { seq: 1, text: 'I climb the wall.' }
        }
      },
      log: []
    })

    const call = page.getByRole('region', { name: 'Open Call' })
    await expect.element(call).toHaveTextContent('Athletics check')
    await expect.element(call).toHaveTextContent('I climb the wall.')
    await expect.element(call).not.toHaveTextContent(/DC|hard/)
  })

  it('declares a clicked exit or NPC at once, carrying its Effect', async () => {
    const ondeclare = vi.fn()
    const onpick = vi.fn()
    render(SceneStatePanel, { scene, log: [], onpick, ondeclare })

    await page.getByRole('button', { name: 'Front door' }).click()
    await page.getByRole('button', { name: 'Mira' }).click()

    expect(ondeclare.mock.calls).toEqual([
      ['I head to Front door.', { effect: 'move', exitId: 'door' }],
      ['I talk to Mira.', { effect: 'talk', npcId: 'mira' }]
    ])
    expect(onpick).not.toHaveBeenCalled()
  })

  it('pre-fills a clicked object instead, since examining has no Effect', async () => {
    const ondeclare = vi.fn()
    const onpick = vi.fn()
    render(SceneStatePanel, { scene, log: [], onpick, ondeclare })

    await page.getByRole('button', { name: 'Hearth' }).click()

    expect(onpick).toHaveBeenCalledWith('I examine Hearth.')
    expect(ondeclare).not.toHaveBeenCalled()
  })
})
