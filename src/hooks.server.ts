import type { Handle, ServerInit } from '@sveltejs/kit/hooks'
import { SOLO_PLAYER } from '#lib/character/enums.ts'
import { isStoredTheme, THEME_COOKIE } from '#lib/theme/theme.ts'

// The `theme` cookie (light | dark) is written into the server-rendered <html>
// so the first paint is correct without JS. No cookie means follow the OS.
export const handle: Handle = async ({ event, resolve }) => {
  if (!fromLocalhost(event.request, event.url)) return new Response('Forbidden', { status: 403 })
  // Every localhost browser is the solo Player; later tickets resolve other browsers here.
  event.locals.browser = SOLO_PLAYER
  const theme = event.cookies.get(THEME_COOKIE)
  const attr = isStoredTheme(theme) ? `data-theme="${theme}"` : ''
  return resolve(event, {
    transformPageChunk: ({ html }) => html.replace('%app.theme%', attr)
  })
}

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]'])

function isLocal(host: string | null): boolean {
  if (!host) return false
  try {
    return LOCAL_HOSTNAMES.has(new URL(`http://${host}`).hostname)
  } catch {
    return false
  }
}

/**
 * The browser routes are only for a page served from this machine: a request whose Host is
 * another name (a DNS-rebound page) is refused, and so is a write whose Origin is another site.
 * The bridge routes carry their own token check, so they are left to it.
 */
function fromLocalhost(request: Request, url: URL): boolean {
  if (url.pathname.startsWith('/api/bridge/')) return true
  const host = request.headers.get('host')
  if (!isLocal(host)) return false
  const origin = request.headers.get('origin')
  if (request.method === 'GET' || request.method === 'HEAD' || !origin) return true
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

// The bridge finds this server through the runtime file in the user-level state directory.
// Loaded on start, so importing the handle (as its spec does) needs no server environment.
export const init: ServerInit = async () => {
  const { announceServer } = await import('#lib/server/bridge/index.ts')
  announceServer()
}
