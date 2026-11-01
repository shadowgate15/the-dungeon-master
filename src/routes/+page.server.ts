import { fail } from '@sveltejs/kit'
import { db } from '#lib/server/db/index.ts'
import { createWorldService, WorldValidationError } from '#lib/server/world/service.ts'
import type { Actions, PageServerLoad } from './$types'

const worlds = createWorldService(db)

export const load: PageServerLoad = () => ({ worlds: worlds.list() })

export const actions: Actions = {
  createWorld: async ({ request }) => {
    const name = String((await request.formData()).get('name') ?? '')
    try {
      worlds.create({ name })
    } catch (error) {
      if (error instanceof WorldValidationError) return fail(400, { name, error: error.message })
      throw error
    }
  }
}
