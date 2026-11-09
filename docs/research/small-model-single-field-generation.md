# Research: small local models and single-field generation

Issue: shadowgate15/the-dungeon-master#130 (child of #129; blocks #133).
Date: 2026-11-09. Sources are first-party docs, model cards and this repo's code. Nothing here was run against a live model; see Gaps.

## Question

What do small local models (the kind run in LM Studio) do reliably for one-shot, single-field generation? Cover structured output support and strictness, practical prompt and context sizes, following a short prose instruction (a 300-400 character premise) and a feedback instruction against a current value, known failure modes, and what the existing adapter already relies on.

## What the adapter already relies on

- `src/lib/server/ai/adapter.ts`: `openaiCompatibleText` from `@tanstack/ai-openai/compatible` pointed at LM Studio's `/v1`; dummy API key. It is the only provider seam.
- `src/lib/server/ai/conversation-engine.ts` (`createChatPort`): calls TanStack AI `chat()` with `outputSchema` (a Zod object), `stream: true`, and `modelOptions: { max_tokens }`. Constants: `MAX_TOKENS = 600` for a turn, `SUMMARY_MAX_TOKENS = 500` for compaction. No temperature or other sampling options are set, so LM Studio's defaults apply.
- Failure handling already exists: `structured-output-validation-failed`, `structured-output-parse-failed` and `max_tokens` map to a retryable `invalid-output`; `structured-output-missing-result` maps to `reasoning-model`.
- `src/lib/server/ai/world-conversation.ts`: the premise instruction is prose in the system prompt ("ideally 300 to 400 characters and never more than ${PREMISE_SOFT_CAP}"), while the schema only caps it with `z.string().max(PREMISE_MAX)` (`PREMISE_MAX = 600`, `src/lib/world/seed.ts`). So the 300-400 target is advisory; only the hard cap is in the schema.
- Context: the probe reads `loaded_context_length` from `GET /api/v0/models` (best effort); the fallback is `DEFAULT_CONTEXT_LIMIT = 4096` (`src/lib/world/context.ts`).
- Existing tooling answers earlier questions: `docs/research/local-model-structured-output.md` (branch `research/local-model-structured-output`, #14) and `research/world-creation-model` (#21), which also records the live spike (#17): grammar-constrained shape held at every size, 5/5, even for qwen2.5-1.5b; reasoning models failed 0/5 (empty `content`); quality was the weak point at small sizes.

## Findings

### 1. Structured output in LM Studio and how strictly it is enforced

- Send `response_format` with a `json_schema` to `/v1/chat/completions`; LM Studio says this "will cause the LLM to respond in valid JSON conforming to the schema provided". The JSON comes back as a string to be parsed. GGUF models use llama.cpp grammar-based sampling; MLX models use Outlines. Source: https://lmstudio.ai/docs/developer/openai-compat/structured-output
- Same page: "Not all models are capable of structured output, particularly LLMs below 7B parameters", and to check the model card. It does not explain `strict` (the curl example sets `"strict": "true"`, the Python example omits it) and does not say what happens on non-conforming output.
- Enforcement is token-level constraint, so it is hard for complete generations: "constraining the model to only generate tokens that conform to the provided schema", but "Schema compliance is only guaranteed for complete, successful generations." Interruption (cancellation, reaching `maxTokens`) "will likely violate the schema". Smaller models "may occasionally get stuck in an unclosed structure", so "always include a `maxTokens` parameter". Source: https://lmstudio.ai/docs/typescript/llm-prediction/structured-response
- llama.cpp converts the schema to a GBNF grammar and "Unsupported features are skipped silently"; the schema "is only used to constrain the model output and is not injected into the prompt". An example in that README shows `maxLength: 100` becoming `char{1,100}`, which implies a string length cap is enforced by the grammar (the page does not state this support in words). Source: https://github.com/ggml-org/llama.cpp/blob/master/grammars/README.md
- Implication for one field: a one-string schema is the easiest case for the grammar. Shape is guaranteed; content (length target, relevance, novelty) is not. A hard `maxLength` is likely to be enforced by the grammar but is a cutoff, not a target: it can end the string mid-thought rather than make the model write to length (inference; verify, see Gaps).

### 2. Prompt and context sizes

- LM Studio's chat-completions page lists supported params: `model, top_p, top_k, messages, temperature, max_tokens, stream, stop, presence_penalty, frequency_penalty, logit_bias, repeat_penalty, seed`, and defers semantics to OpenAI's docs. It says nothing on context overflow or `finish_reason`. Source: https://lmstudio.ai/docs/developer/openai-compat/chat-completions
- Context length is a load-time setting in LM Studio (`contextLength` is a load parameter), not a per-request one. Source: https://lmstudio.ai/docs/typescript/llm-prediction/parameters
- Model cards give ceilings, not working sizes: Qwen3-4B-Instruct-2507 supports 262,144 natively and suggests 32,768 if memory is short. Source: https://huggingface.co/Qwen/Qwen3-4B-Instruct-2507
- Practical sizing for a single field is small. A premise of 300-400 characters is roughly 100 tokens (the repo's own estimate is about 3 characters per token). The prompt for one field is the system prompt, the other seed fields as context, the current value and the feedback line: low hundreds of tokens up to about 1-2K. `max_tokens` of a few hundred is ample; 600 (the current turn cap) is already generous. The app's 4096-token fallback context comfortably fits a one-shot call (arithmetic and inference, not a measured result).

### 3. Following a short prose instruction and a feedback instruction

- No first-party doc or model card quantifies how well small models obey "write 300-400 characters" or "revise this value per this feedback". The Qwen3-4B card only advises standardizing output format through the prompt (it shows an example of naming the JSON field in the prompt) and recommends temperature 0.7, top_p 0.8, top_k 20, min_p 0, and `presence_penalty` 0 to 2 against endless repetition. Source: the Qwen3-4B card above.
- What can be said from the sources: because the schema is not shown to the model, the prompt must itself say what the field is and the length target. The repo already does this in prose.
- The in-repo spike (#17) found 1.5B models produced generic, sometimes incoherent content while 4B and larger were more coherent. That is eyeballed, n=5, on a 7-field seed, and was about quality of picks, not length or feedback adherence.

### 4. Known failure modes, and which are documented

Documented by first-party sources:

- Truncation at `max_tokens` breaks the schema; stuck/unclosed structures on small models (LM Studio SDK docs).
- Reasoning models put their output in `reasoning_content`, so the structured `content` is empty (found by the repo spike #17, not an LM Studio doc). The adapter already detects this.
- Silent skipping of unsupported schema keywords (llama.cpp README), so do not rely on exotic constraints such as `pattern`, `uniqueItems` or `not`.
- Models under 7B may not support structured output at all (LM Studio).

Commonly expected but NOT documented by any source reviewed (treat as risks to test, not facts):

- Ignoring the length target (writing well under or over 300-400 characters).
- Echoing the current value back unchanged, or changing only a word, when asked to revise with feedback.
- Wrapping the text (quotes, "Here is a premise:", markdown). Under a grammar-constrained single-string schema the wrapper can still appear inside the string value; a plain-text (unconstrained) call would be more exposed.

## Implications for the single-field feature (#133)

Inferences, not tested.

- Use the existing structured path with a one-field schema (for example `{ value: string }` with `max(PREMISE_MAX)`), reusing the existing engine, failure kinds and `max_tokens`. No adapter change is indicated; the seam in `adapter.ts` is sufficient.
- State the length target and the field's meaning in the prompt (the schema is invisible to the model). Show the current value and the feedback explicitly, and tell the model to return the revised value and not to repeat the old one.
- Validate in code, not the prompt: trim, strip surrounding quotes, reject empty, and detect an unchanged value (exact or normalized equality) and retry once or surface it to the user. The existing `invalid-output` retry path can host this.
- Keep `max_tokens` modest but above the longest valid value, so truncation is a real error rather than routine.
- Do not set a `minLength`/`maxLength` as a substitute for the length target; use `maxLength` only as a backstop.
- The 4B tier from #21 remains the minimum sensible model; the sub-7B warning from LM Studio and the weak 1.5B quality both argue for warning rather than blocking.

## Gaps

- No live testing. A short spike is the cheapest way to close the undocumented failure modes: for 2-3 models (qwen3-4b-2507, one 1.5B, one 14B+), run 20 premise generations plus 20 feedback revisions and record length distribution, unchanged-value rate and wrapper text.
- Whether llama.cpp/Outlines enforce `maxLength` as a grammar constraint in LM Studio's build is inferred from a README example, not stated.
- Behaviour of `finish_reason` and context overflow in LM Studio's OpenAI-compat endpoint is undocumented on the pages reviewed.
- Sampling defaults used by LM Studio when the app sends none were not found in the docs reviewed; the model-card recommendations are not applied by the app today.
