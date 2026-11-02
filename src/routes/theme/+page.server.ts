import { redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'

const ONE_YEAR = 60 * 60 * 24 * 365

// Only same-site paths: a leading single slash, never protocol-relative.
function safePath(value: FormDataEntryValue | null): string {
  return typeof value === 'string' && /^\/(?![/\\])/.test(value) ? value : '/'
}

// This route exists for its action; a plain visit goes home.
export const load: PageServerLoad = () => redirect(303, '/')

export const actions = {
  default: async ({ request, cookies }) => {
    const form = await request.formData()
    const theme = form.get('theme')
    if (theme === 'light' || theme === 'dark') {
      cookies.set('theme', theme, { path: '/', maxAge: ONE_YEAR, sameSite: 'lax' })
    } else {
      cookies.delete('theme', { path: '/' })
    }
    redirect(303, safePath(form.get('redirectTo')))
  }
} satisfies Actions
