# Research: TanStack AI with LM Studio

Issue: shadowgate15/the-dungeon-master#13 (child of #12, "Map: World creation"). Researched 2026-11-01.
Scope: facts and gaps only. The choice of TanStack AI and LM Studio is not reopened.

## Short answer

Yes, with caveats. TanStack AI has a documented path for LM Studio (the generic `openaiCompatible` adapter over Chat Completions). Streaming and tool calling are supported on both sides. Schema-shaped output is supported by LM Studio (non-streamed documented), but whether TanStack AI _streams_ structured output through this adapter is not documented. That is the main gap.

## 1. Connecting TanStack AI to LM Studio

- LM Studio serves an OpenAI-compatible API at `http://localhost:1234/v1`, with `/v1/models`, `/v1/chat/completions`, `/v1/responses`, `/v1/embeddings` and `/v1/completions`. Existing OpenAI clients work by changing the base URL. Source: https://lmstudio.ai/docs/developer/openai-compat
- The server is started from the Developer tab or `lms server start`. Source: https://lmstudio.ai/docs/developer/openai-compat/structured-output
- TanStack AI ships one generic adapter, `openaiCompatible` from `@tanstack/ai-openai/compatible`, for "any server that speaks `/chat/completions`". LM Studio is named in its docs, and it needs no dedicated package. Source: https://github.com/TanStack/ai/blob/main/docs/adapters/openai-compatible.md
- Documented config:

```ts
import { openaiCompatible } from '@tanstack/ai-openai/compatible'

const lmstudio = openaiCompatible({
  name: 'lmstudio',
  baseURL: 'http://localhost:1234/v1',
  apiKey: 'lm-studio', // placeholder
  models: ['local-model']
})
// chat({ adapter: lmstudio("local-model"), messages })
```

- The adapter reads no env var; `apiKey` is always passed explicitly (a placeholder for local servers). Same source.
- The default wire API is Chat Completions; `api: "responses"` selects the Responses API. LM Studio implements both endpoints, but only Chat Completions is the documented LM Studio path. Same source.
- Model list: bare strings get optimistic default capabilities (text and image input, streaming, function calling, structured outputs). `createModel(name, {input, features})` declares exact capabilities. The types do not read `features`, and "function tools and structured output are always allowed on this path", so a model that cannot do them fails at run time. Same source.
- Svelte: `@tanstack/ai-svelte` provides Svelte 5 factories for chat. License MIT. The repo page does not state a stability level or version. Source: https://github.com/TanStack/ai

## 2. Streaming

- TanStack AI: `chat()` returns a stream. `toServerSentEventsResponse(stream)` turns it into an SSE response. Source: https://github.com/TanStack/ai/blob/main/docs/structured-outputs/streaming.md
- LM Studio: Chat Completions with `stream=true` is supported. Streamed tool calls arrive in fragments that the client must accumulate. Source: https://lmstudio.ai/docs/developer/openai-compat/tools

## 3. Structured output

- LM Studio: `POST /v1/chat/completions` with `response_format: { type: "json_schema", json_schema: { name, strict?, schema } }`. The JSON comes back as a string in `choices[0].message.content` and must be parsed. GGUF models use llama.cpp grammar-based sampling; MLX models use Outlines. Models under about 7B may handle it poorly, and support varies by model. Source: https://lmstudio.ai/docs/developer/openai-compat/structured-output
- LM Studio's page only shows `stream: false` and does not say whether structured output works while streaming.
- TanStack AI: `chat({ adapter, messages, outputSchema: ZodSchema })` gives typed output; with `stream: true` it yields events plus a terminal `structured-output.complete` carrying the parsed object. Source: https://github.com/TanStack/ai/blob/main/docs/structured-outputs/streaming.md
- Per that page, every adapter accepts `outputSchema` with `stream: true`, but only adapters implementing `structuredOutputStream` stream the JSON deltas. Others run non-streaming and emit the whole object at once. The page lists named adapters (OpenAI, OpenRouter, Grok, Groq, etc., using Chat Completions `response_format: json_schema`) as native streamers. `openaiCompatible` is not listed either way.
- The Chat Completions adapter row in the OpenAI docs shows structured output as `response_format: { type: "json_schema", strict: true }`, which matches what LM Studio accepts. Source: https://github.com/TanStack/ai/blob/main/docs/adapters/openai.md
- Tool calling: via `toolDefinition(...).server(...)` passed to `chat({ tools })`, for models that support function calling. LM Studio supports OpenAI-format tool calls. Models with native tool support (e.g. Qwen, Llama 3.1/3.2, Mistral, shown with a hammer badge) do better. Others use a default injected prompt format, and small models may produce unparseable calls. Sources: TanStack openai-compatible.md; https://lmstudio.ai/docs/developer/openai-compat/tools

## 4. Fit with the README's thin provider interface

- The `adapter` passed to `chat()` is the provider seam. Callers write `chat({ adapter, messages, tools, outputSchema })` and switching providers is a different adapter value (`openaiText`, `anthropicText`, `geminiText`, `ollamaText`, `openaiCompatible(...)`). Source: https://github.com/TanStack/ai/blob/main/docs/advanced/runtime-adapter-switching.md
- The docs show runtime switching with a map of adapter factories keyed by provider name. The app could keep that map behind its own small module, so the rest of the code never imports a provider package.
- Dedicated adapters exist for hosted providers (OpenAI, Anthropic, Gemini, OpenRouter, etc.), so hosted backends can be swapped in later without rewriting call sites.
- Leaks to watch: per-model capability differences (structured output streaming, tool support, reasoning) are not hidden by the adapter, and `createModel` capability declarations are not enforced by types.

## Gaps and risks (not resolved by primary docs)

1. Does `openaiCompatible` implement `structuredOutputStream` (streamed structured output)? Docs do not say. Needs a spike against a real LM Studio server, or a read of `@tanstack/ai-openai` source.
2. Does LM Studio honor `response_format` json_schema together with `stream: true`? Undocumented on its side.
3. Behavior of structured output plus tools in a single call on LM Studio models. Undocumented.
4. Package stability and version for TanStack AI are not stated on the repo page; check npm before committing.
5. Model quality: structured output and tool calling depend on the chosen local model (see caveats above).
6. A summarizing fetch of the LM Studio OpenAI-compat page listed `/v1/decisions`; this looks like an extraction artifact and was not relied on.

Method note: TanStack AI facts come from its docs repo via Context7 (`/tanstack/ai`) and the GitHub docs pages. LM Studio facts come from lmstudio.ai/docs pages. Page contents were read through a summarizing fetch tool, so verbatim quotes are limited.
