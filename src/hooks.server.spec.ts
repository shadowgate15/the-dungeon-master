import { describe, expect, it } from 'vitest'
import type { ResolveOptions } from '@sveltejs/kit/hooks'
import { handle } from './hooks.server'

const HTML = '<!doctype html><html lang="en" %app.theme%><body></body></html>'

function request(
  url: string,
  {
    method = 'GET',
    host,
    origin,
    cookie
  }: { method?: string; host?: string; origin?: string; cookie?: string } = {}
) {
  const headers = new Headers()
  headers.set('host', host ?? new URL(url).host)
  if (origin) headers.set('origin', origin)
  const event = {
    url: new URL(url),
    request: new Request(url, { method, headers }),
    cookies: { get: (name: string) => (name === 'theme' ? cookie : undefined) }
  }
  return handle({
    event: event as never,
    resolve: async (_event: unknown, opts?: ResolveOptions) =>
      new Response((await opts?.transformPageChunk?.({ html: HTML, done: true })) ?? HTML)
  })
}

async function render(cookie: string | undefined) {
  const response = await request('http://localhost:4777/', { cookie })
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

describe('localhost gate', () => {
  it('serves a request addressed to localhost or 127.0.0.1', async () => {
    expect((await request('http://localhost:4777/')).status).toBe(200)
    expect((await request('http://127.0.0.1:4777/api/campaigns/x/floor')).status).toBe(200)
  })

  it('refuses a request whose Host is a foreign name, as after DNS rebinding', async () => {
    const res = await request('http://localhost:4777/api/campaigns/x/floor/done', {
      method: 'POST',
      host: 'evil.example:4777'
    })
    expect(res.status).toBe(403)
  })

  it('refuses a write whose Origin is another site', async () => {
    const res = await request('http://localhost:4777/api/campaigns/x/permission', {
      method: 'POST',
      origin: 'http://evil.example:4777'
    })
    expect(res.status).toBe(403)
  })

  it('allows a write from its own origin', async () => {
    const res = await request('http://localhost:4777/api/campaigns/x/permission', {
      method: 'POST',
      origin: 'http://localhost:4777'
    })
    expect(res.status).toBe(200)
  })

  it('leaves the token-gated bridge routes to their own check', async () => {
    const res = await request('http://localhost:4777/api/bridge/tools', { host: 'evil.example' })
    expect(res.status).toBe(200)
  })
})
