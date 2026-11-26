import { page } from 'vitest/browser'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import SceneRail from './SceneRail.svelte'
import type { SceneView } from './scene'

describe('SceneRail', () => {
  it('shows the time large with the day below, the Place and who is present', async () => {
    render(SceneRail, {
      scene: {
        clock: { minute: 3260, day: 3, time: '14:20' },
        place: { name: 'Drowned Lantern' },
        present: [{ id: 'c-wren', name: 'Wren' }],
        elsewhere: [{ id: 'c-bram', name: 'Bram', whereabouts: 'The Docks' }]
      }
    })

    const rail = page.getByRole('region', { name: 'Clock and Scene' })
    await expect.element(rail.getByText('14:20')).toBeVisible()
    await expect.element(rail.getByText('day 3')).toBeVisible()
    await expect.element(rail.getByText('Drowned Lantern')).toBeVisible()
    await expect
      .element(rail.getByRole('list', { name: 'Present' }).getByRole('listitem'))
      .toHaveTextContent('Wren')
  })

  it('says the Scene is not set before play begins', async () => {
    render(SceneRail, {
      scene: {
        clock: { minute: 0, day: 1, time: '08:00' },
        place: null,
        present: [],
        elsewhere: []
      }
    })

    await expect.element(page.getByText('The Scene is set once play begins.')).toBeVisible()
  })

  it('lists the initiative order with the round, the current turn and foes as a state', async () => {
    render(SceneRail, {
      scene: {
        clock: { minute: 0, day: 1, time: '08:00' },
        place: { name: 'Ruined Chapel' },
        present: [{ id: 'c-wren', name: 'Wren' }],
        elsewhere: [],
        combat: {
          round: 2,
          waiting: [],
          order: [
            {
              key: 'a',
              name: 'Wren',
              kind: 'character',
              characterId: 'c-wren',
              initiative: 20,
              current: false,
              state: null
            },
            {
              key: 'b',
              name: 'Goblin 1',
              kind: 'creature',
              characterId: null,
              initiative: 12,
              current: true,
              state: 'bloodied'
            }
          ]
        }
      }
    })

    const rail = page.getByRole('region', { name: 'Initiative' })
    await expect.element(rail.getByText('Round 2')).toBeVisible()
    const rows = rail.getByRole('list', { name: 'Initiative order' }).getByRole('listitem')
    await expect.element(rows.nth(0)).toHaveTextContent(/20\s*Wren/)
    await expect.element(rows.nth(1)).toHaveTextContent(/12\s*Goblin 1\s*bloodied/)
    await expect.element(rows.nth(1)).toHaveAttribute('aria-current', 'true')
    await expect.element(rows.nth(0)).not.toHaveAttribute('aria-current')
  })

  it('says who is still rolling initiative before the first round', async () => {
    render(SceneRail, {
      scene: {
        clock: { minute: 0, day: 1, time: '08:00' },
        place: { name: 'Ruined Chapel' },
        present: [],
        elsewhere: [],
        combat: { round: 0, waiting: ['Wren', 'Ash'], order: [] }
      }
    })

    const rail = page.getByRole('region', { name: 'Initiative' })
    await expect.element(rail.getByText('Rolling initiative: Wren, Ash')).toBeVisible()
  })

  it('shows no initiative outside Combat', async () => {
    render(SceneRail, {
      scene: {
        clock: { minute: 0, day: 1, time: '08:00' },
        place: null,
        present: [],
        elsewhere: []
      }
    })

    await expect.element(page.getByRole('region', { name: 'Initiative' })).not.toBeInTheDocument()
  })

  it('scrolls the current combatant into view inside the initiative card when the turn moves', async () => {
    const combat = (current: number): SceneView => ({
      clock: { minute: 0, day: 1, time: '08:00' },
      place: { name: 'Ruined Chapel' },
      present: [],
      elsewhere: [],
      combat: {
        round: 1,
        waiting: [],
        order: Array.from({ length: 30 }, (_, i) => ({
          key: `g${i}`,
          name: `Goblin ${i + 1}`,
          kind: 'creature' as const,
          characterId: null,
          initiative: 30 - i,
          current: i === current,
          state: null
        }))
      }
    })
    const { rerender } = render(SceneRail, { scene: combat(0) })
    const rows = page.getByRole('list', { name: 'Initiative order' }).getByRole('listitem')
    await expect.element(rows.nth(0)).toBeInViewport()
    // Component tests load no stylesheet, so give the card body the scroll box the layout gives it.
    const body = page.getByRole('region', { name: 'Initiative' }).getByTestId('rail-card-body')
    Object.assign((body.element() as HTMLElement).style, { height: '120px', overflowY: 'auto' })
    await expect.element(rows.nth(25)).not.toBeInViewport()

    await rerender({ scene: combat(25) })
    await expect.element(rows.nth(25)).toBeInViewport()
    expect(document.scrollingElement!.scrollTop).toBe(0)
  })
})
