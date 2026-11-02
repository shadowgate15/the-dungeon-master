/** What the AI panel needs to know. Never carries the base URL. */
export type AiStatus =
  | { state: 'not-configured' }
  | { state: 'unreachable'; model: string }
  | { state: 'model-unavailable'; model: string }
  | { state: 'ready'; model: string; contextLength: number | null }
