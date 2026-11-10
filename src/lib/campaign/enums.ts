// Single source for the Campaign seed enums. Feeds the form, the DB schema
// (CHECK constraints) and the AI structured-output schema.

/** The mood of play. Unordered. */
export const TONES = ['heroic', 'lighthearted', 'tense', 'dark', 'mysterious', 'epic'] as const

/**
 * Story scope, not hours. Ordered: one-shot (a single sitting), short (a few sessions),
 * medium (a season of play), long (an open-ended saga).
 */
export const LENGTHS = ['one-shot', 'short', 'medium', 'long'] as const

export type Tone = (typeof TONES)[number]
export type Length = (typeof LENGTHS)[number]

/** The service rejects a premise longer than this, the ceiling the field request accepts. */
export const PREMISE_SERVICE_MAX = 2000
