import { openaiCompatibleText } from '@tanstack/ai-openai/compatible'

/**
 * The provider swap seam. Everything that talks to a model passes the value returned
 * here as the `adapter` of TanStack AI's `chat()`. Moving to a hosted backend means
 * returning a different adapter from this function; no other module imports a provider.
 */
export function createChatAdapter(config: { baseUrl: string; model: string }) {
  return openaiCompatibleText(config.model, {
    name: 'lmstudio',
    baseURL: config.baseUrl,
    // LM Studio ignores the key, but the client requires one.
    apiKey: 'lm-studio'
  })
}
