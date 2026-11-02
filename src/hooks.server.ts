import type { Handle } from '@sveltejs/kit/hooks'

// The `theme` cookie (light | dark) is written into the server-rendered <html>
// so the first paint is correct without JS. No cookie means follow the OS.
export const handle: Handle = async ({ event, resolve }) => {
  const theme = event.cookies.get('theme')
  const attr = theme === 'light' || theme === 'dark' ? `data-theme="${theme}"` : ''
  return resolve(event, {
    transformPageChunk: ({ html }) => html.replace('%app.theme%', attr)
  })
}
