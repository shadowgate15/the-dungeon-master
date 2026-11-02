import { parseTheme, THEME_COOKIE } from '#lib/theme/theme.ts'
import type { LayoutServerLoad } from './$types'

export const load: LayoutServerLoad = ({ cookies }) => {
  return { theme: parseTheme(cookies.get(THEME_COOKIE)) }
}
