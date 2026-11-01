# Research: local model reliability for structured creative output

Issue: shadowgate15/the-dungeon-master#14 (child of #12, "Map: World creation"; blocks #16).
Date: 2026-11-01. Sources are first-party docs only. Nothing here was tested against a live model; see Gaps.

## Question

How reliably do small models served by LM Studio produce schema-shaped creative output (World seed: name, tone, themes, etc.)? Which mechanisms exist, what are the failure modes, and what does it imply for per-field "suggest" and one-prompt "draft"?

## Findings

### 1. LM Studio mechanisms

- **JSON schema via `response_format`.** Send `response_format: { type: "json_schema", json_schema: { name, strict, schema } }` to `/v1/chat/completions`. LM Studio says this makes the model "respond in valid JSON conforming to the schema provided" and that it follows OpenAI's Structured Output format. The result is a string in `choices[0].message.content`; the caller parses it. Source: https://lmstudio.ai/docs/developer/openai-compat/structured-output
- **Enforcement is grammar-based sampling, by engine.** GGUF models use llama.cpp's grammar-based sampling; MLX models use Outlines (https://github.com/lmstudio-ai/mlx-engine). Same page.
- **Model caveat (official).** "Not all models are capable of structured output, particularly LLMs below 7B parameters." The page points to the model card for support and does not list supported models. Same page.
- **No separate grammar parameter documented.** The chat-completions page lists supported params: `model, top_p, top_k, messages, temperature, max_tokens, stream, stop, presence_penalty, frequency_penalty, logit_bias, repeat_penalty, seed`. `response_format` is not in that list (it is documented on the structured-output page). No raw GBNF input is documented in the OpenAI-compat docs. Source: https://lmstudio.ai/docs/developer/openai-compat/chat-completions
- **LM Studio TypeScript SDK** (`.respond()` with zod/JSON schema) is an alternative and states output "conforms to the schema". Source: https://lmstudio.ai/docs/typescript/llm-prediction/structured-response. Not the path in use (TanStack AI); noted for completeness.

### 2. Documented failure modes

- **Truncation / cancellation.** "Schema compliance is only guaranteed for complete, successful generations." If generation is cancelled or hits the token limit, output will likely break the schema. (LM Studio TS SDK docs, URL above.)
- **Stuck generation.** "Models (especially smaller ones) may occasionally get stuck in an unclosed structure"; LM Studio recommends setting `maxTokens` to prevent infinite generation. (Same page.) This is the documented runaway/repetition risk.
- **Grammar limits (llama.cpp, the GGUF engine).** JSON Schema is converted to GBNF; unsupported keywords are skipped silently. Mixing `properties` with `anyOf`/`oneOf` is unsupported; `prefixItems` is broken; `minimum`/`maximum` work only for `integer`; nested `$ref` is broken; `pattern` must be anchored `^...$`; `patternProperties`, `uniqueItems`, `contains`, `not` are unsupported. Source: https://github.com/ggml-org/llama.cpp/blob/master/grammars/README.md
- **Schema is not shown to the model.** "The JSON schema is only used to constrain the model output and is not injected into the prompt", so the prompt should describe the fields too (same source).
- **Grammar performance.** Repetition forms can cause "extremely slow sampling"; objects default to no additional properties; `additionalProperties: true` may allow keys with unescaped newlines (same source).
- **Syntactic vs semantic.** The constraint guarantees shape only. Quality of creative content (coherent tone, non-generic names) is not addressed by any doc reviewed. LM Studio does not describe behaviour when a model fails to conform.

### 3. TanStack AI

- **Local servers:** use `openaiCompatible` from `@tanstack/ai-openai/compatible`, e.g. `baseURL: "http://localhost:1234/v1"`, placeholder `apiKey`, `models: [...]`. It targets Chat Completions. Source: https://github.com/tanstack/ai/blob/main/docs/adapters/openai-compatible.md (via Context7 `/tanstack/ai`).
- **`outputSchema` on `chat()`** accepts Standard Schema (Zod v4.2+, ArkType, Valibot) or raw JSON Schema; `chat()` then returns `Promise<T>` and ignores `stream`. Adapters pick their own strategy (OpenAI `response_format: json_schema`, Anthropic tool extraction, Gemini `responseSchema`, Ollama JSON mode). Source: docs/migration/migration-from-vercel-ai.md in the same repo.
- **Validation:** the engine validates the result once; on failure it throws (non-streaming) with code `structured-output-validation-failed` and the raw text; the message names the failing fields. Sources: docs/structured-outputs/one-shot.md; `packages/ai/src/activities/chat/index.ts`.
- **No partial-object streaming yet** (migration doc). Streaming structured output uses a native single-request stream only for a listed set of adapters; others (anthropic, gemini, ollama, ...) fall back to a non-streaming call emitting one `structured-output.complete` event (docs/structured-outputs/streaming.md). `openaiCompatible` is not in that table.

## Implications for "suggest" and "draft"

Inferences from the above, not tested.

- **Per-field "suggest"** uses small schemas (one string, or a short list). That fits the documented grammar subset and keeps the runaway-generation window small. It should be the more reliable mode on small models.
- **One-prompt "draft"** is a larger object with arrays (themes). It has more exposure to truncation and unclosed structures. Set `maxTokens` generously, keep the schema simple (flat fields, `items` arrays, string enums; avoid `anyOf` with `properties`, nested `$ref`, `pattern`), and bound array sizes.
- Both modes need handling of `structured-output-validation-failed`: retry once, then fall back to asking the user (or degrade draft to per-field suggestions).
- Describe fields in the prompt as well as the schema, since the schema is not injected.
- Expect no incremental streaming of the object in either mode via TanStack AI on this adapter; the UI should show a pending state.
- Models under 7B are officially flagged as unreliable; the app should surface a model-capability warning or recommendation.

## Gaps

- Not verified: whether `openaiCompatible` actually sends `response_format: json_schema` to LM Studio or falls back to prompting (Context7 results on that path were inconclusive). Needs a source read or a spike.
- No first-party failure-rate data for small models on creative content; LM Studio gives only the "<7B" caveat. Needs an empirical spike with candidate models.
- Behaviour on non-conforming output (HTTP error vs malformed string) is undocumented by LM Studio.
- MLX/Outlines-specific schema limits not reviewed.
- Whether LM Studio's `strict` flag changes behaviour is unexplained (its examples differ: `"true"` string vs omitted).
