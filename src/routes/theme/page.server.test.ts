import { describe, expect, it } from 'vitest'
import { actions } from './+page.server.ts'

async function run(theme: string, redirectTo?: string) {
  const set: [string, string][] = []
  const deleted: string[] = []
  const form = new FormData()
  form.set('theme', theme)
  if (redirectTo !== undefined) form.set('redirectTo', redirectTo)
  const event = {
    request: { formData: async () => form },
    cookies: {
      set: (name: string, value: string) => set.push([name, value]),
      delete: (name: string) => deleted.push(name)
    }
  }
  try {
    await actions.default(event as never)
  } catch (thrown) {
    return { redirect: thrown as { status: number; location: string }, set, deleted }
  }
  throw new Error('expected a redirect')
}

describe('theme action', () => {
  it('stores light and redirects back', async () => {
    const { redirect, set } = await run('light', '/worlds?x=1')
    expect(set).toEqual([['theme', 'light']])
    expect(redirect.status).toBe(303)
    expect(redirect.location).toBe('/worlds?x=1')
  })

  it('clears the cookie for system', async () => {
    const { deleted, set } = await run('system', '/')
    expect(deleted).toEqual(['theme'])
    expect(set).toEqual([])
  })

  it('ignores unknown themes and refuses off-site redirects', async () => {
    const bad = await run('neon', '//evil.example')
    expect(bad.set).toEqual([])
    expect(bad.deleted).toEqual(['theme'])
    expect(bad.redirect.location).toBe('/')
  })
})
