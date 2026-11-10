# Context length and token usage (verification for #33)

## Result

| Item                                                                                      | Status                                                                                                               | Where it comes from                         |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| LM Studio exposes `max_context_length` per model                                          | Confirmed in the LM Studio developer docs (checked through Context7)                                                 | `GET /api/v0/models`                        |
| LM Studio exposes `loaded_context_length` (the context the model is actually loaded with) | **Not confirmed in the docs.** The excerpt we could retrieve shows only `max_context_length`. Treated as best effort | Read from the same listing by the probe     |
| TanStack AI surfaces token usage                                                          | Confirmed, end to end against the fake LM Studio server                                                              | `RUN_FINISHED.usage` on a streamed `chat()` |

The fake LM Studio server used in tests returns `loaded_context_length`, so the tests prove the code reads the field when present. They do not prove that a real LM Studio sends it. Check a real instance with `curl http://localhost:1234/api/v0/models` and look for `loaded_context_length`.

## Loaded context length: best effort, with a fallback

The #29 probe (`src/lib/server/ai/probe.ts`) reads `loaded_context_length` for the configured model from `GET <origin>/api/v0/models`.

How the code degrades when the field is missing:

- The probe returns `contextLength: number | null`. It is `null` when the field is absent or not a number, when the model is not loaded, when LM Studio is old, when the request fails or times out, or when the server is not LM Studio. The probe never fails because of it.
- With `contextLength` `null`, the server uses the configured fallback limit (`LM_STUDIO_CONTEXT_LIMIT`, server-only, default 4096), which the server adds to the ready status as `fallbackContextLength`.

## Token usage: confirmed through TanStack AI

`chat()` with `stream: true` emits a `RUN_FINISHED` event whose `usage` is either AG-UI's `usage[]` (`inputTokens`, `outputTokens`, `totalTokens`) or TanStack's `TokenUsage` (`promptTokens`, `completionTokens`, `totalTokens`). Both shapes are read by `readUsage` in `src/lib/server/ai/port.ts`.

Per-field AI calls are stateless: each one sends the form's current values and nothing from earlier calls, so there is no transcript to measure or compact and no context meter. The usage count is read by the port but not shown; the probed (or fallback) context length stays on the AI status for the per-field prompt budget.
