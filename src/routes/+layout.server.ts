import type { LayoutServerLoad } from './$types'

export const load: LayoutServerLoad = ({ cookies }) => {
  const cookie = cookies.get('theme')
  const theme: 'system' | 'light' | 'dark' =
    cookie === 'light' || cookie === 'dark' ? cookie : 'system'
  return { theme }
}
