import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ResolveOptions } from '@sveltejs/kit/hooks'
import { handle } from './hooks.server'
import { lanAccess } from '#lib/server/lan-access.ts'

const HTML = '<!doctype html><html lang="en" %app.theme%><body></body></html>'

async function request(
  url: string,
  {
    method = 'GET',
    host,
    origin,
    cookie,
    browserCookie
  }: {
    method?: string
    host?: string
    origin?: string
    cookie?: string
    browserCookie?: string
  } = {}
) {
  const headers = new Headers()
  headers.set('host', host ?? new URL(url).host)
  if (origin) headers.set('origin', origin)
  const sets: { name: string; value: string; options: Record<string, unknown> }[] = []
  const locals: { browser?: string } = {}
  const event = {
    url: new URL(url),
    request: new Request(url, { method, headers }),
    cookies: {
      get: (name: string) =>
        name === 'theme' ? cookie : name === 'browser' ? browserCookie : undefined,
      set: (name: string, value: string, options: Record<string, unknown>) =>
        void sets.push({ name, value, options })
    },
    locals: locals as { browser?: string }
  }
  const response = await handle({
    event: event as never,
    resolve: async (_event: unknown, opts?: ResolveOptions) =>
      new Response((await opts?.transformPageChunk?.({ html: HTML, done: true })) ?? HTML)
  })
  last = { sets, locals }
  return response
}

let last: {
  sets: { name: string; value: string; options: Record<string, unknown> }[]
  locals: { browser?: string }
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

describe('browser id', () => {
  it('is SOLO_PLAYER on the locals of a localhost request', async () => {
    const locals: { browser?: string } = {}
    const headers = new Headers({ host: 'localhost:4777' })
    await handle({
      event: {
        url: new URL('http://localhost:4777/'),
        request: new Request('http://localhost:4777/', { headers }),
        cookies: { get: () => undefined },
        locals
      } as never,
      resolve: async () => new Response('')
    })
    expect(locals.browser).toBe('player')
  })
})

describe('LAN mode', () => {
  const LAN = 'http://192.168.1.20:4777'
  const remote = (path: string, opts: Parameters<typeof request>[1] = {}) =>
    request(`${LAN}${path}`, opts)

  afterEach(() => lanAccess.reset())

  it('refuses a non-localhost Host outside LAN mode', async () => {
    expect((await remote('/campaigns/abc')).status).toBe(403)
  })

  describe('with a LAN Campaign', () => {
    beforeEach(() => {
      lanAccess.set({ lan: true, campaign: 'abc' })
    })

    it('gives a remote browser a persistent non-Secure HttpOnly SameSite=Lax browser-id cookie', async () => {
      await remote('/campaigns/abc')
      const cookie = last.sets.find((c) => c.name === 'browser')
      expect(cookie?.value).toMatch(/^[0-9a-f-]{36}$/)
      expect(cookie?.options).toMatchObject({
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: false
      })
      expect(cookie?.options.maxAge as number).toBeGreaterThan(60 * 60 * 24 * 30)
      expect(last.locals.browser).toBe(cookie?.value)
    })

    it('keeps a browser id it already issued', async () => {
      const id = '123e4567-e89b-12d3-a456-426614174000'
      await remote('/campaigns/abc', { browserCookie: id })
      expect(last.locals.browser).toBe(id)
      expect(last.sets.find((c) => c.name === 'browser')).toBeUndefined()
    })

    it('does not accept a cookie that claims to be the Host', async () => {
      await remote('/campaigns/abc', { browserCookie: 'player' })
      expect(last.locals.browser).not.toBe('player')
    })

    it('never sets a cookie for the localhost Host', async () => {
      await request('http://localhost:4777/campaigns/abc')
      expect(last.sets).toEqual([])
      expect(last.locals.browser).toBe('player')
    })

    it('reaches the LAN Campaign pages and APIs', async () => {
      for (const path of [
        '/campaigns/abc',
        '/campaigns/abc/play',
        '/api/campaigns/abc/floor',
        '/api/events',
        '/_app/immutable/x.js'
      ]) {
        expect((await remote(path)).status, path).toBe(200)
      }
    })

    it('refuses the library and other Campaigns', async () => {
      for (const path of [
        '/campaigns',
        '/campaigns/other',
        '/campaigns/abcd',
        '/api/campaigns/other/floor',
        '/api/server/stop',
        '/api/dev/report-issue'
      ]) {
        expect((await remote(path, { method: 'POST' })).status, path).toBe(403)
      }
      expect((await remote('/campaigns')).status).toBe(403)
    })

    it('sends the bare root to the LAN Campaign', async () => {
      const res = await remote('/')
      expect(res.status).toBe(303)
      expect(res.headers.get('location')).toBe('/campaigns/abc')
    })

    it('accepts a write from its own LAN origin and from localhost, not from another site', async () => {
      const post = (host: string, origin: string) =>
        request(`http://${host}/api/campaigns/abc/floor/done`, { method: 'POST', host, origin })
      expect((await post('192.168.1.20:4777', 'http://192.168.1.20:4777')).status).toBe(200)
      expect((await post('localhost:4777', 'http://localhost:4777')).status).toBe(200)
      expect((await post('192.168.1.20:4777', 'http://evil.example')).status).toBe(403)
    })

    it('still lets the localhost Host reach the library', async () => {
      expect((await request('http://localhost:4777/campaigns')).status).toBe(200)
    })
  })

  it('shows a remote browser a waiting page while the Host has opened no Campaign', async () => {
    lanAccess.set({ lan: true, campaign: undefined })
    const res = await remote('/campaigns/abc')
    expect(res.status).toBe(503)
    expect(await res.text()).toContain('waiting for the Host to open a Campaign')
  })
})
