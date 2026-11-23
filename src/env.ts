import { defineEnvVars } from '@sveltejs/kit/env'

export const variables = defineEnvVars({
  DATABASE_URL: { description: 'The database connection string.' },
  DUNGEON_MASTER_HOME: {
    description:
      'The user-level state directory (the Campaign registry). Default ~/.dungeon-master.'
  },
  DUNGEON_MASTER_PORT: {
    description:
      'The localhost port the game server listens on, written to its runtime file for the bridge. Default 4777.'
  },
  DUNGEON_MASTER_CAMPAIGNS: {
    description: 'Where new Campaign folders are suggested. Default ~/dm-campaigns.'
  }
})
