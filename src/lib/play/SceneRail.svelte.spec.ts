import { page } from 'vitest/browser'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import SceneRail from './SceneRail.svelte'

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
})
