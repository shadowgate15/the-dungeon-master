import { expect, type Page } from '@playwright/test'

/** The Arc section starts collapsed on the Campaign page; open it if it is not already. */
export async function expandArc(page: Page) {
  const toggle = page.getByRole('button', { name: 'Arc', exact: true })
  await expect(toggle).toBeVisible()
  await expect(async () => {
    if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true', { timeout: 1000 })
  }).toPass({ timeout: 10_000 })
}

/** The model's answers for one Arc: the skeleton, then one Beats answer per Act. */
export const arcAnswers = (
  acts: number,
  beats: number,
  title = 'The Ember Crown',
  delayMs?: number
) => [
  {
    content: {
      title,
      premise: 'A relic wakes.',
      stakes: 'The valley burns.',
      acts: Array.from({ length: acts }, (_, a) => ({
        name: `Act ${a + 1} name`,
        purpose: 'Things escalate.'
      })),
      resolution: 'The relic is destroyed.'
    },
    delayMs
  },
  ...Array.from({ length: acts }, (_, a) => ({
    content: {
      beats: Array.from({ length: beats }, (_, b) => ({
        title: `Beat ${a + 1}.${b + 1}`,
        description: 'Something happens.'
      }))
    }
  }))
]
