import { defineEnvVars } from '@sveltejs/kit/env'

/** Optional variable: unset or blank reads as undefined. Never sent to the browser. */
const optional = (value: string | undefined) => value?.trim() || undefined

export const variables = defineEnvVars({
  DATABASE_URL: { description: 'The database connection string.' },
  LM_STUDIO_BASE_URL: {
    description: 'The LM Studio OpenAI-compatible endpoint. Defaults to http://localhost:1234/v1.',
    schema: optional
  },
  LM_STUDIO_MODEL: {
    description: 'The model id to use. When unset, the AI is treated as not configured.',
    schema: optional
  }
})
