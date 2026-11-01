import { fail } from '@sveltejs/kit'
import { db } from '#lib/server/db/index.ts'
import { createWorldService, WorldValidationError } from '#lib/server/world/service.ts'
import type { Actions, PageServerLoad } from './$types'

const worlds = createWorldService(db)

export const load: PageServerLoad = () => ({ worlds: worlds.list() })

export const actions: Actions = {
  createWorld: async ({ request }) => {
    const data = await request.formData()
    const text = (key: string) => String(data.get(key) ?? '')
    // An unset picker submits '', which means unspecified (NULL).
    const optional = (key: string) => text(key) || null
    const values = {
      name: text('name'),
      premise: text('premise'),
      genreFlavor: optional('genreFlavor'),
      scale: optional('scale'),
      magicLevel: optional('magicLevel'),
      techLevel: optional('techLevel')
    }
    try {
      // The service validates enum membership; the cast only bridges raw form strings.
      worlds.create(values as Parameters<typeof worlds.create>[0])
    } catch (error) {
      if (error instanceof WorldValidationError)
        return fail(400, { ...values, error: error.message })
      throw error
    }
  }
}
