import type { Handle } from '@sveltejs/kit/hooks'
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
