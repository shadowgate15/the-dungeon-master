import { error, fail } from '@sveltejs/kit'
import { CAMPAIGN_SEED_FIELDS, CampaignSeedError } from '#lib/campaign/seed.ts'
import { library, sessions } from '#lib/server/campaign/index.ts'
import { CampaignArchivedError, CampaignMissingError } from '#lib/server/campaign/library.ts'
import { SeedLockedError } from '#lib/server/creation/begin.ts'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = ({ params }) => {
  const entry = library.get(params.id)
  if (!entry) error(404, 'Campaign not found')
  return {
    campaign: {
      id: entry.id,
      name: entry.name,
      path: entry.path,
      status: entry.status
    },
    seed: entry.status === 'missing' ? null : library.seed(entry.id),
    dmFields: entry.status === 'missing' ? [] : library.dmSeedFields(entry.id),
    begun: entry.status !== 'missing' && library.creation(entry.id).state === 'begun',
    conversation: entry.status === 'missing' ? [] : library.conversation(entry.id).list(),
    attached: sessions.list()
  }
}

export const actions: Actions = {
  saveSeed: async ({ request, params }) => {
    const data = await request.formData()
    const card = Object.fromEntries(
      CAMPAIGN_SEED_FIELDS.map((f) => [f, String(data.get(f) ?? '')])
    ) as Record<(typeof CAMPAIGN_SEED_FIELDS)[number], string>
    try {
      library.saveSeed(params.id, card)
    } catch (e) {
      if (
        e instanceof CampaignSeedError ||
        e instanceof CampaignArchivedError ||
        e instanceof SeedLockedError ||
        e instanceof CampaignMissingError
      )
        return fail(400, { seed: card, error: e.message })
      throw e
    }
    return { saved: true }
  }
}
