import { fail, redirect } from '@sveltejs/kit'
import { db } from '#lib/server/db/index.ts'
import { createWorldService, WorldNotFoundError } from '#lib/server/world/service.ts'
import type { Actions, PageServerLoad } from './$types'

const worlds = createWorldService(db)

export const load: PageServerLoad = () => ({ worlds: worlds.listArchived() })

export const actions: Actions = {
  restore: async ({ request }) => {
    const id = String((await request.formData()).get('id') ?? '')
    try {
      worlds.restore(id)
    } catch (e) {
      if (e instanceof WorldNotFoundError) return fail(404, { error: e.message })
      throw e
    }
    redirect(303, '/worlds/archived')
  }
}
