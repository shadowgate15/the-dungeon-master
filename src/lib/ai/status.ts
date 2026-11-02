/** What the AI panel needs to know. Never carries the base URL. */
export type AiStatus =
  | { state: 'not-configured' }
  | { state: 'unreachable'; model: string }
  | { state: 'model-unavailable'; model: string }
  | { state: 'ready'; model: string; contextLength: number | null }
  /** A turn showed the model returns no answer content; controls stay off until re-probe. */
  | { state: 'reasoning-model'; model: string }

/** Shown in the chat and the AI panel when the model returns no answer content. */
export const REASONING_MODEL_MESSAGE =
  'The model returned no answer. This usually means a reasoning model. Switch to a non-reasoning model such as qwen3-4b-2507, restart the server, then check the connection.'
