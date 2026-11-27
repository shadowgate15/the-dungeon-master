import { parseTheme, THEME_COOKIE } from '#lib/theme/theme.ts'
import { isLocalHost } from '#lib/server/lan.ts'
import type { LayoutServerLoad } from './$types'

export const load: LayoutServerLoad = async ({ cookies, request }) => {
  // The Host is the browser on the machine running the server; remote browsers never get the
  // join URLs, so the Join panel's data is not even sent to them.
  const isHost = isLocalHost(request.headers.get('host'))
  const { lan, joinUrls } = isHost
    ? await import('#lib/server/bridge/index.ts').then((m) => m.lanStatus())
    : { lan: false, joinUrls: [] }
  return { theme: parseTheme(cookies.get(THEME_COOKIE)), isHost, lan, joinUrls }
}
