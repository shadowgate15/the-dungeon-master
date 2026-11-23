import { DUNGEON_MASTER_CAMPAIGNS, DUNGEON_MASTER_HOME } from '$app/env/private'
import { createCampaignLibrary } from './library'
import { defaultCampaignRoot, userStateDir } from './paths'

const env = { DUNGEON_MASTER_HOME, DUNGEON_MASTER_CAMPAIGNS }

/** The server's Campaign library, over the registry in the user-level state directory. */
export const library = createCampaignLibrary({ home: userStateDir(env) })

/** The default root the New Campaign dialog suggests folders under. */
export const campaignRoot = defaultCampaignRoot(env)
