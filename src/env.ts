import { defineEnvVars } from '@sveltejs/kit/env'

export const variables = defineEnvVars({
  DATABASE_URL: { description: 'The database connection string.' },
  DUNGEON_MASTER_HOME: {
    description:
      'The user-level state directory (the Campaign registry). Default ~/.dungeon-master.'
  },
  DUNGEON_MASTER_CAMPAIGNS: {
    description: 'Where new Campaign folders are suggested. Default ~/dm-campaigns.'
  }
})
