import { describe, expect, it } from 'vitest'
import type { ResolveOptions } from '@sveltejs/kit/hooks'
import { handle } from './hooks.server'

const HTML = '<!doctype html><html lang="en" %app.theme%><body></body></html>'

async function render(cookie: string | undefined) {
  const event = {
    cookies: { get: (name: string) => (name === 'theme' ? cookie : undefined) }
  }
  const response = await handle({
    event: event as never,
    resolve: async (_event: unknown, opts?: ResolveOptions) =>
      new Response((await opts?.transformPageChunk?.({ html: HTML, done: true })) ?? HTML)
  })
  return response.text()
}

describe('theme cookie', () => {
  it('renders data-theme="dark" for theme=dark', async () => {
    expect(await render('dark')).toContain('<html lang="en" data-theme="dark">')
  })

  it('renders data-theme="light" for theme=light', async () => {
    expect(await render('light')).toContain('<html lang="en" data-theme="light">')
  })

  it('renders no data-theme without a cookie so the OS preference applies', async () => {
    const html = await render(undefined)
    expect(html).toMatch(/<html lang="en" ?>/)
    expect(html).not.toContain('data-theme')
  })

  it('ignores unknown cookie values', async () => {
    expect(await render('neon')).not.toContain('data-theme')
  })
})
