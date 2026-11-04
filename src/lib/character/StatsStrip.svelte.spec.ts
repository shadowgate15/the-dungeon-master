import { page } from 'vitest/browser'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import type { DerivedStats } from '#lib/rules/derive-stats.ts'
import StatsStrip from './StatsStrip.svelte'

const pending = (...missing: string[]) => ({ status: 'pending' as const, missing })
const ability = (score: number, modifier: number) => ({
  status: 'ok' as const,
  value: { base: score, racialBonus: 0, score, modifier }
})
const empty = {
  abilities: {
    str: pending('race'),
    dex: pending('race'),
    con: pending('race'),
    int: pending('race'),
    wis: pending('race'),
    cha: pending('race')
  },
  hitPoints: pending('class'),
  unarmoredAc: pending('score:dex'),
  speed: pending('race')
} as unknown as DerivedStats

describe('StatsStrip', () => {
  it('shows dashes with the reason while stats are pending', async () => {
    render(StatsStrip, { stats: empty })

    await expect.element(page.getByRole('group', { name: 'HP' })).toHaveTextContent('—')
    await expect
      .element(page.getByRole('group', { name: 'HP' }))
      .toHaveAttribute('title', 'Needs class')
    await expect.element(page.getByRole('group', { name: 'STR' })).toHaveTextContent('—')
  })

  it('fills in the stats that are known and leaves the rest pending', async () => {
    const stats = {
      ...empty,
      abilities: { ...empty.abilities, str: ability(8, -1), dex: ability(16, 3) },
      speed: { status: 'ok', value: 25 },
      unarmoredAc: { status: 'ok', value: { value: 13, source: 'unarmored', formula: '10 + DEX' } }
    } as unknown as DerivedStats
    render(StatsStrip, { stats })

    await expect.element(page.getByRole('group', { name: 'STR' })).toHaveTextContent(/8\s*-1/)
    await expect.element(page.getByRole('group', { name: 'DEX' })).toHaveTextContent(/16\s*\+3/)
    await expect.element(page.getByRole('group', { name: 'Speed' })).toHaveTextContent('25')
    await expect
      .element(page.getByRole('group', { name: 'AC (unarmored)' }))
      .toHaveTextContent('13')
    await expect.element(page.getByRole('group', { name: 'HP' })).toHaveTextContent('—')
  })
})
