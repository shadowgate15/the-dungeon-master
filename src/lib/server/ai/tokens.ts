/** A deliberately pessimistic estimate (three characters a token), so a prompt never overruns. */
export const estimateTokens = (text: string) => Math.ceil(text.length / 3)
