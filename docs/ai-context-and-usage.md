# Context length and token usage (verification for #33)

## Loaded context length: confirmed, best effort

LM Studio's REST API lists models at `GET /api/v0/models` (checked against the LM Studio developer docs through Context7). Each entry documents `max_context_length`, the most the model supports. `loaded_context_length` is the context the model was actually loaded with. The docs excerpt we could retrieve shows only `max_context_length`, so `loaded_context_length` is read from LM Studio's response by the #29 probe (`src/lib/server/ai/probe.ts`) and is treated as best effort.

- The probe returns `contextLength: number | null`. It is `null` when the model is not loaded, when LM Studio is old, or when the server is not LM Studio.
- When `contextLength` is `null` the meter uses the configured fallback limit and a character estimate (about 3 characters per token plus a fixed prompt overhead). `LM_STUDIO_CONTEXT_LIMIT` (server-only, default 4096) sets the fallback. The server adds it to the ready status as `fallbackContextLength`.
- An estimate is shown with a `~` prefix.

## Token usage: confirmed through TanStack AI

`chat()` with `stream: true` emits a `RUN_FINISHED` event whose `usage` is either AG-UI's `usage[]` (`inputTokens`, `outputTokens`, `totalTokens`) or TanStack's `TokenUsage` (`promptTokens`, `completionTokens`, `totalTokens`). Both shapes are read by `readUsage` in `src/lib/server/ai/world-conversation.ts`.

End to end, with the real `openaiCompatibleText` adapter against the fake LM Studio server (which sends a final usage chunk), `runTurn` returns `usage: { promptTokens, completionTokens, totalTokens }` (see the "surfaces usage end to end" spec). If a provider reports no usage the field is omitted and the client falls back to the estimate.

The meter's "used" value is the last turn's `totalTokens` (prompt plus reply, which is what the next prompt will contain at least). It is dropped after a compaction, because it no longer describes the compacted prompt; the meter then shows an estimate until the next turn reports a fresh count.
