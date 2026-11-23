import type { Handle, ServerInit } from '@sveltejs/kit/hooks'
import { isStoredTheme, THEME_COOKIE } from '#lib/theme/theme.ts'

// The `theme` cookie (light | dark) is written into the server-rendered <html>
// so the first paint is correct without JS. No cookie means follow the OS.
export const handle: Handle = async ({ event, resolve }) => {
  const theme = event.cookies.get(THEME_COOKIE)
  const attr = isStoredTheme(theme) ? `data-theme="${theme}"` : ''
  return resolve(event, {
    transformPageChunk: ({ html }) => html.replace('%app.theme%', attr)
  })
}

// The bridge finds this server through the runtime file in the user-level state directory.
// Loaded on start, so importing the handle (as its spec does) needs no server environment.
export const init: ServerInit = async () => {
  const { announceServer } = await import('#lib/server/bridge/index.ts')
  announceServer()
}
