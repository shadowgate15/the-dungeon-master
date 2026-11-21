# Exchange model eval: Adjudication and Effect on local Qwen models

Date: 2026-11-20. Harness: `scripts/exchange-eval/` (manual, not run in CI). Raw results: `scripts/exchange-eval/results/*.json`.

## Question

The Exchange splits a turn into two structured requests before the streamed reply:

- **Adjudication**: `{outcome: happens|impossible|check|ask, skill?, difficulty?, question?, choices?}`. `skill` is one of the 18 SRD skills or 6 saves, `difficulty` is `easy|medium|hard|very_hard` and code maps it to DC 10/15/20/25.
- **Effect**: `none | move(exitId) | talk(npcId) | end_talk`, with ids as enums built from the Scene.

Which local model, quant and wire mode can do both reliably? The pass bar is ≥90% schema-valid AND ≥90% expected outcome on the clear-cut and vague categories (the "gate": trivial, move, talk, end_talk, speech, impossible, vague). Checks are scored separately.

## Answer

**Update (fix round, below): the bar is met.** qwen3.5-9b MLX 4bit with the v2-flat contract, reasoning off, passes through the app's own port: 100% schema-valid, 95% gate, 98% Effect, adjudication p50 1.3s. The decision model Clef-Flash was tried as a challenger and does not pass (88% gate, because absent targets are judged `happens`). qwen stays the judge; see "Decision model (Clef)". Round 1's answer follows.

**Round 1: no cell passes.** Every qwen3.5-9b cell with a working wire is 99–100% schema-valid and asks on vague input 95–100% of the time. Gate accuracy, though, sits at 75–79% whatever the quant or format. The misses are judgment, not format:

- **Ordinary movement gets a check.** "I climb down into the cellar" → `check:stealth` in 5/5 runs on nearly every 9b cell. "I go up to my room" behaves the same way.
- **Plain speech in dialogue gets a check.** "What do you know about the smugglers?" → `check:insight`. Speech scores 27–67%.
- **Absent targets get `ask` instead of `impossible`.** "I ask the innkeeper for a room" in an empty clearing gets `ask`.

The prompt already says "never for ordinary walking, talking or handling things". The next lever is prompt and contract work (few-shot examples, or a "who/what resists?" field before `outcome`), not a different quant.

- **8-bit vs 4-bit: no meaningful difference.**
  - Gate accuracy: MLX 4bit 76–78% vs MLX 8bit 76–78%; GGUF Q4_K_M 75–76% vs Q8_0 78–79%.
  - Effect accuracy: 80–82% for all of them.
  - The 8-bit quants cost about 4 GiB more (9.7 vs 5.6–6.1 GiB). The one thing that improves is skill choice on checks: 50–68% at 4-bit vs 72–73% at 8-bit.
- **JSON schema vs native tools: JSON schema wins.**
  - On MLX, `tool_choice: "required"` is ignored. The model answers in prose (JSON-ish text in `content`) 91% of the time, so only 9% of answers are valid.
  - On GGUF, tools mostly work (91–94% valid). The model still sometimes emits a tool call as text with a chatty tail (example below), and gate accuracy drops to 62–71%.
  - Schema mode is 99–100% valid on both formats.
- **Baseline qwen3-4b-2507 (MLX 4bit)** is fastest (0.35s total) but has the lowest gate accuracy (69%). It never asks on "I go over there" and calls `investigation` checks on plain questions.

**Recommended default: qwen3.5-9b MLX 4bit, JSON-schema mode, with `reasoning_effort: "none"` added to the request.** It matches the best quality, is the smallest 9b at 5.6 GiB, and has the lowest 9b latency: adjudication 0.9–1.7s total, TTFT 0.35s. Ship it only after the judgment fixes above, since nothing clears the bar today.

## Fix round

Same model (qwen3.5-9b MLX 4bit), same 32 cases, 5 runs, temperature 0.7, `reasoning_effort: "none"` unless noted. No case or expectation was changed. `climb-wall` still accepts only `athletics`; once the prompt states the SRD skill mapping, the model picks it in every run, so widening the case to acrobatics was not needed.

### Before and after

| Cell                                   | Contract and wire                          | Valid | Gate    | Vague→ask | Skill OK | Stray | Effect  | Adj p50 / p90    | Reasoning tokens | Pass    |
| -------------------------------------- | ------------------------------------------ | ----- | ------- | --------- | -------- | ----- | ------- | ---------------- | ---------------- | ------- |
| `qwen3.5-9b-mlx4-raw-schema` (round 1) | v1, optional fields, raw `response_format` | 100%  | 76%     | 100%      | 61%      | 8%    | 81%     | 0.91 / 1.59s     | 0                | no      |
| `qwen3.5-9b-mlx4-schema` (round 1)     | v1, app port                               | 100%  | 78%     | 100%      | 68%      | 94%   | 81%     | 1.71 / 2.27s     | 0                | no      |
| `fix-v2-prompt-raw-schema`             | (a) principle + examples, optional fields  | 100%  | 89%     | 100%      | 80%      | 6%    | 92%     | 1.01 / 1.76s     | 0                | no      |
| `fix-v2-flat-raw-schema`               | (a) + (c) flat schema                      | 100%  | 95%     | 100%      | 90%      | 0%    | 88%     | 1.20 / 2.10s     | 0                | yes     |
| `fix-v2-flat-raw-schema-effect2`       | same, final Effect prompt                  | 100%  | 94%     | 100%      | 100%     | 0%    | 97%     | 1.35 / 1.98s     | 0                | yes     |
| **`fix-v2-flat-schema`**               | **same, through the app's port**           | 100%  | **95%** | 100%      | 97%      | 0%    | **98%** | **1.32 / 2.16s** | 0                | **yes** |
| `fix-v2-resists-raw-schema`            | (a) + (c) + (b) `resists` first            | 99%   | 92%     | 70%       | 87%      | 0%    | 93%     | 1.57 / 2.37s     | 0                | yes     |
| `fix-v2-resists-schema`                | same, app port                             | 100%  | 91%     | 70%       | 87%      | 0%    | 91%     | 1.25 / 2.17s     | 0                | yes     |
| `fix-thinking-prompt-json` (1 run)     | v2-flat in the prompt, thinking on         | 88%   | 92%     | 100%      | 100%     | 0%    | n/a     | 105 / 182s       | 5,005            | no      |

The three `fix-v2-flat` rows use the same Adjudication prompt, so they are three samples of the winning contract: gate 94–95%.

### What each change contributed

- **(a) Principle plus worked examples: gate 76% → 89%.** The rule moved from a trailing "never for ordinary walking" to the lead: _check only when something in the scene resists AND failure matters_. Each outcome got a definition with the ordinary cases spelled out ("a question in conversation is never a check"), plus a one-line SRD skill mapping. Seven examples sit in other scenes (a mill, a merchant, a cliff), so none restates a test case. Speech went from 67% to 100%, talk from 60% to 100%, and move from 52% to 64%.
- **(c) Flat schema: gate 89% → 95%, stray fields 6% → 0%.** Every field is required and non-null: `skill` and `difficulty` take `"none"`, `question` takes `""` and `choices` takes `[]` when they do not apply. Code (`fromFlat`) then turns the sentinels into absent fields and rejects a `check` without a skill or difficulty, or an `ask` without a question. Move rose from 64% to 96%. The likely reason is that the model no longer chooses _whether_ to emit `skill`; it emits it every time, with `"none"` as a legitimate value. Because the schema has no optional fields, the app's port sends it unchanged, so the round-1 widening problem (94% stray, +0.8s) disappears without touching the port.
- **(b) `resists` before `outcome`: net negative.** Gate fell 3–4 points, and vague→ask fell from 100% to 70%. The model writes `"resists": "nothing"` for "I do the thing" and then concludes `happens`. Impossible improved slightly (absent-innkeeper 2/5 instead of 0/5). It also costs about 0.1–0.4s. Not adopted.

Remaining misses on the winning contract are `absent-innkeeper` ("I ask the innkeeper for a room" in an empty clearing → `ask`, in 9 of 10 runs across the two raw cells) and a few `down-cellar` checks. The `Tobin` example already covers the absent-person rule. Adding a closer example would be fitting the test, so the case stays as a known boundary. A code-side guard (a named person who is not in the Scene) could catch it later if it matters in play.

### Winning contract

Wire schema (`flatAdjudicationSchema(false)`), sent as `response_format: json_schema, strict`:

```ts
z.object({
  outcome: z.enum(['happens', 'impossible', 'check', 'ask']),
  skill: z.enum([...CHECKS, 'none']),
  difficulty: z.enum(['easy', 'medium', 'hard', 'very_hard', 'none']),
  question: z.string(),
  choices: z.array(z.string())
}).strict()
```

The key prompt lines (full text in `contract.ts`, `JUDGMENT` and `FLAT_FIELDS`):

- "call for a check only when something in the scene resists the action (a person who would object or notice, a lock, a hazard, a hard climb) AND failure would matter. Everything ordinary simply happens."
- "happens: … Going through a listed exit, up or down stairs or ladders, starting or ending a conversation with someone present, saying or asking anything in a conversation, and handling ordinary objects all happen. A question in conversation is never a check."
- "impossible: it needs a person or thing that is not in the scene (anyone not listed under People present …)"
- "Skills follow the SRD: climbing, jumping and swimming are athletics; balancing and tumbling are acrobatics; …"
- The seven examples, then "Fill every field", with the sentinel for each field.

### Reasoning on or off: off

| Cell                   | Valid   | Gate (correct of all)       | Adj p50 / p90          | Reasoning tokens (mean) |
| ---------------------- | ------- | --------------------------- | ---------------------- | ----------------------- |
| Off (v2-flat, 3 cells) | 100%    | 94–95%                      | 1.20–1.35 / 1.98–2.16s | 0                       |
| Off + `resists`        | 99–100% | 91–92%                      | 1.25–1.57 / 2.17–2.37s | 0                       |
| Thinking on            | 88%     | 92% (100% of valid answers) | 105 / 182s             | 5,005                   |

**Recommendation: reasoning off (`reasoning_effort: "none"`) for Adjudication.** Thinking makes the judgment better: every one of the 28 answers that arrived was right, and it was the only cell to get `absent-innkeeper` right. It costs about 80× the latency, though, and 4 of 32 requests (12%) never finished within 8,192 tokens. A turn that takes 1–3 minutes, and sometimes fails, is not playable. Reasoning off with the v2 prompt already clears the bar at about 1.3s.

What it took to get thinking to answer at all:

- **With `response_format`**, LM Studio applies the grammar to the reasoning itself. The JSON is emitted in `reasoning_content` after 6 tokens and `content` is empty.
- **Without a wire schema at temperature 0.7**, the reasoning loops until `max_tokens` (2,999 tokens/54s at a 3,000 cap; 7,999/146s at 8,000). `reasoning_effort: "low"`/`"minimal"` does not bound it.
- **What worked:** no wire schema, the JSON Schema appended to the system prompt, Qwen's thinking sampling (temperature 1.0, `presence_penalty` 1.5, `top_p` 0.95, `top_k` 20), `max_tokens` 8192, and the JSON read from `content` (outermost braces). One run per case, because of the time.

### Effect step

Round 1's pattern was speech in dialogue → `talk` to the current partner (15 of 95 Effect answers), plus `climb-wall` → `move`. The v2 Effect prompt gives the same principle-and-examples treatment: speech to the current partner is `none`, only a listed exit is `move`, and `talk` means a new conversation. That cleared most of the speech misses (Effect 81% → 88–92%). It also exposed a gap: "I nod goodbye and step away from the bar." went to `none` 5/5, because no line said what ends a conversation. Defining `end_talk` as "a farewell, thanks that close it, or walking away from the person", with one example in another scene, brought Effect to 97% (raw) and 98% (app port). The remaining misses are scattered single runs.

### Re-running the fix round

```sh
pnpm eval:exchange:grid --round fix     # all fix cells (the default round); thinking takes about 50 min
pnpm eval:exchange --model <loaded-id> --mode schema --contract v2-flat --runs 5 --label fix-v2-flat-schema
```

`--round 1` runs the round-1 grid. `--contract v1|v2-prompt|v2-flat|v2-resists` picks the contract; mode `prompt-json` puts the schema in the prompt instead of on the wire.

## Decision model (Clef)

Challenger: `cloudflare_clef-flash` (bartowski GGUF Q4_K_M, 9.1B, arch `clef`, LM Studio type `decision`). It cannot generate text. It answers typed questions on `POST /v1/systemone` with a choice, a probability for each option, and a confidence.

**Wire (`systemone` mode, `systemone.ts`).** The fix-round v2 contract is mapped onto choice questions, one request per step:

- **Adjudication** is one request with three questions:
  - `outcome` (happens/impossible/check/ask): the v2 principle is in the instructions, and each option's v2 definition is its criterion description.
  - `skill` (the 24 CHECKS): the SRD skill mapping is in the instructions, with one SRD-terms line per skill or save.
  - `difficulty` (easy to very_hard): each criterion is described with its DC.
  - Skill and difficulty are read only when the outcome is `check`.
- **Effect** is one `effect` choice. Its criteria are the Scene's own options (`none`, `move:<exitId>`, `talk:<npcId>`, `end_talk`), each described in words, using the final fix-round Effect principle.
- **State** is the same Scene information the chat prompt gets, as an object: character, location, mode, exits, objects, people_present, recent_events, declaration.
- **`ask`** is scored on the outcome alone. Clef cannot write the question; in the app, the narration model would write it from the Scene and the declaration.

**Load setting.** At LM Studio's default physical batch size (512), every request fails with `http 500: input (1685 tokens) is too large to process. increase the physical batch size`. The Adjudication request is about 1,700 tokens and the Effect about 600. `lms load` and the SDK cannot set this, but the REST load can: `POST /api/v1/models/load {"model": "cloudflare_clef-flash", "context_length": 8192, "eval_batch_size": 4096, "physical_batch_size": 4096}`. The `physical_batch_size` field is not in the docs, but it is accepted and echoed in `load_config`.

**Run.** 32 cases × 5 runs with Clef loaded alone, once with the fix-round worked examples in the `outcome` instructions and once without. **The answers are fully deterministic.** All 5 runs of every case returned the same choices and identical probabilities (maximum difference 0). Each cell is therefore really 32 distinct answers, repeated.

| Metric                   | `clef-systemone` (examples) | `clef-systemone-no-examples` | `fix-v2-flat-schema` (qwen3.5-9b) |
| ------------------------ | --------------------------- | ---------------------------- | --------------------------------- |
| Schema-valid             | 100%                        | 100%                         | 100%                              |
| Outcome (gate)           | **88%**                     | 88%                          | **95%**                           |
| impossible               | 40%                         | 40%                          | 84%                               |
| Other gate categories    | 100%                        | 100%                         | 93–100%                           |
| Vague→ask                | 100%                        | 100%                         | 100%                              |
| Check outcome / Skill OK | 100% / 100%                 | 100% / 100%                  | 100% / 97%                        |
| Stray fields             | n/a                         | n/a                          | 0%                                |
| Effect correct           | 84%                         | 84%                          | 98%                               |
| Adjudication p50 / p90   | 4.32 / 4.68s                | 4.15 / 4.37s                 | 1.32 / 2.16s                      |
| Effect p50               | 1.39s                       | 1.54s                        | 0.83s                             |
| Memory                   | 6.48 GiB                    | 6.48 GiB                     | 5.57 GiB                          |
| Pass                     | no                          | no                           | yes                               |

Clef's latency is the full non-streamed request (it has no TTFT).

**Where Clef fails.** Everything ordinary is right: no check on movement or speech, and correct SRD skills on every check. Every Adjudication miss is in `impossible`:

- "I ask the innkeeper for a room" and "I wake the sleeping dragon" in an empty clearing both get `happens`, at confidence 0.36 and 0.23. People present is an empty list in the state.
- "I fly up over the wall" gets `check:athletics`.

This is not a structural limit: `impossible` is an option, and Clef picks it for "jump to the moon" and "lift the tavern". It is a judgment miss on absent targets, the same weak spot qwen has but worse.

The three Effect misses are `open-door` → `move:exit-north` (the north door is an exit, but opening it is not leaving), `out-front` → `none`, and `hail-guard` → `none`.

**Worked examples did not help.** Every choice is identical with and without them. Only the confidences shift slightly, and the examples add about 0.2s.

### Confidence vs correctness

Because the runs are identical, the counts below are distinct cases. The ×5 tables from `pnpm eval:exchange:report` give the same percentages.

**Adjudication outcome** (examples cell, 32 cases, 3 wrong):

| Confidence | Cases | Accuracy |
| ---------- | ----- | -------- |
| < 0.5      | 8     | 75%      |
| 0.5–0.8    | 14    | 93%      |
| ≥ 0.8      | 10    | 100%     |

| Rule: below X → ask | Errors caught | Correct answers turned into asks | Gate after the rule |
| ------------------- | ------------- | -------------------------------- | ------------------- |
| 0.5                 | 2 of 3        | 3 of 29 (10%)                    | 81%                 |
| 0.6                 | 2 of 3        | 4 of 29 (14%)                    | 77%                 |
| 0.7                 | 3 of 3        | 6 of 29 (21%)                    | 73%                 |
| 0.8                 | 3 of 3        | 15 of 29 (52%)                   | 46%                 |

Confidence is low on the misses, but it is just as low on many right answers. The four vague cases are correct `ask`s at only 0.37–0.52, and "I read the notices" (0.31), "I call out to the guard" (0.30) and "I try to persuade the guard" (0.45) are right but unsure. A rule that turns a low-confidence answer into `ask` therefore never raises the gate: at 0.5 it catches the two absent-person misses, but it asks on three good answers, and `ask` is still the wrong outcome for an absent person. **Do not adopt an "ask when unsure" rule on the outcome.**

**Effect** (19 cases, 3 wrong):

| Confidence | Cases | Accuracy |
| ---------- | ----- | -------- |
| < 0.5      | 3     | 0%       |
| 0.5–0.8    | 8     | 100%     |
| ≥ 0.8      | 8     | 100%     |

Below 0.5, the rule flags all 3 errors and no correct answer (at 0.6 it also flags one correct answer). On this set, Effect confidence separates right from wrong cleanly. With only three errors, that is suggestive rather than proven.

### Recommendation: qwen3.5-9b stays the judge

- **Accuracy first.** qwen with the v2-flat contract passes the bar: 95% gate, 98% Effect. Clef does not: 88% gate, 84% Effect. Clef's `impossible` accuracy (40%) is the decisive gap, and confidence cannot rescue it.
- **Latency second.** qwen is also faster: Adjudication p50 1.3s vs 4.3s, Effect 0.8s vs 1.4s. Clef has to process three long question blocks in one non-streamed request.
- **Clef's advantages are real but secondary:** fully deterministic answers, calibrated probabilities, and no way to emit malformed output. It also needs about 0.9 GiB more memory, plus a non-default load setting.
- **A narrow future use**, if a second model is ever worth keeping resident: Clef's low Effect confidence could serve as a cross-check on structural changes. That alone does not justify it today.

```sh
# Load Clef alone with a batch size large enough for the Adjudication request, then:
pnpm eval:exchange --model cloudflare_clef-flash --mode systemone --runs 5 --label clef-systemone [--no-examples]
```

## Wire mechanism (the app's port)

Request bodies were captured with a `fetch` wrapper.

`callModel(port, {outputSchema})` → TanStack `chat({stream: true, outputSchema})` → the openai-compatible adapter's `structuredOutputStream`. That sends **one streamed `/v1/chat/completions` request with `response_format: {type: "json_schema", json_schema: {name: "structured_output", schema, strict: true}}`**. It is real response_format grammar-constrained decoding, not tools and not prompt-only. Two side effects:

1. **Optional fields are widened to required + nullable**, but the enum is left without `null`:
   ```json
   "skill": {"type": ["string", "null"], "enum": ["acrobatics", ...]},
   "required": ["outcome", "skill", "difficulty", "question", "choices"]
   ```
   Under strict decoding the model therefore has to fill every field, and it can't pick `null` for an enum. 84–100% of schema-mode answers carry stray fields:
   ```json
   {
     "outcome": "happens",
     "skill": "strength_save",
     "difficulty": "easy",
     "question": "Do you want to drink the ale, or do you want to throw it in Voss's face?",
     "choices": ["drink_ale", "throw_in_face"]
   }
   ```
   The Effect gets the same treatment: `{"effect": "none", "exitId": "exit-street", "npcId": "npc-maren"}`. Code that dispatches on `outcome`/`effect` can ignore the extras, and outcome accuracy is the same as raw-schema. The cost is latency: adjudication p50 is 1.7–2.6s in schema mode vs 0.9–1.4s with a raw `response_format` that keeps fields optional (`raw-schema` cells), 1–8% stray. **Fix:** give the Exchange's schemas no optional fields, or use a discriminated union per outcome, or send `response_format` directly.
2. **`modelOptions` are spread into the request body**, so per-request options such as `temperature` and `reasoning_effort` pass straight through.

## qwen3.5-9b is a reasoning model

LM Studio's model.yaml for qwen3.5-9b turns thinking on by default. With thinking on, the grammar-constrained JSON is emitted in `reasoning_content` and `content` stays empty. The port then fails every request with `reasoning-model` (the `qwen3.5-9b-mlx4-thinking-schema` cell: 0% valid):

```
error: reasoning-model: The model returned no answer. ...
reasoning_content: {"outcome": "happens", "skill": "history", "difficulty": "easy", ...}
content: ""
```

`reasoning_effort: "none"` in the body fixes it. These do not work in LM Studio: `chat_template_kwargs.enable_thinking: false`, `reasoning: {effort: "none"}`, and `/no_think` in the prompt. **The app's port must send `modelOptions: {reasoning_effort: 'none'}`** (harmless for qwen3-4b-2507) before qwen3.5-9b can be used. Every other 9b cell here sends it.

## Method

- **Cases** (`cases.ts`): 32 cases on four fixture Scenes (a tavern, the same tavern in dialogue with the barkeep, a rainy harbor wall with a gate guard, an empty forest clearing).
  - Categories: trivial ×4, move ×5 (some loosely named: "go up to my room" → the stairs exit), talk ×3, end_talk ×2, speech ×3, impossible ×5, check ×6 (each with acceptable skills), vague ×4.
  - The character is Mira Ashdown, a level 1 human rogue.
- **Requests** (`contract.ts`): the Adjudication runs on every case. The Effect runs on cases with an expected Effect and assumes the declaration succeeded. Both see the same compact Scene context: character, location, mode, exits with ids, objects, people present with ids, recent events, declaration. The Effect enum leaves out `talk` toward the NPC already in dialogue.
- **Modes** (`run.ts`):
  - `schema`: the app's `createChatPort` + `callModel` with a Zod `outputSchema`.
  - `raw-schema`: direct streamed `response_format: json_schema` with true optional fields.
  - `tools`: one strict function tool with `tool_choice: "required"`; an answer with no tool call counts as invalid.
- **Settings:** temperature 0.7 on every cell (the port sends none, so LM Studio would apply the model preset, 1.0 for qwen3.5-9b). `reasoning_effort: "none"` everywhere except the thinking cell. Max tokens 200 (Adjudication) and 80 (Effect). Context 8192. 5 runs per case per cell.
- **Validation:** strict Zod on the parsed object after dropping `null`s. Schema-valid means it parsed and matched the schema.
- **Models:** one at a time, via the LM Studio SDK (`grid.ts`), because `lms load` cannot pick a variant. Memory is the loaded model's size reported by LM Studio.
- **Hardware:** this Mac (Apple Silicon), LM Studio 0.4.21. TTFT and latency are recorded only, not gated.
- **MLX 8bit:** LM Studio had downloaded only the first of its two weight shards but reported the variant as complete. The missing shard was fetched from Hugging Face (`lmstudio-community/Qwen3.5-9B-MLX-8bit`) and its sha256 checked before the run.

## Failure examples (raw outputs)

**Movement treated as a risky act** (mlx8, raw-schema, `down-cellar`, expected `happens` / `move:exit-cellar`):

```json
{ "outcome": "check", "skill": "stealth", "difficulty": "medium" }
```

**The model invents a reason to roll** (mlx4, schema, `go-to-bed`; nobody in the scene is hostile):

```json
{"outcome": "check", "skill": "stealth", "difficulty": "medium", "question": "Do you want to try to sneak past Sergeant Voss, or just walk normally and risk being stopped?", ...}
```

**Absent person → ask** (mlx4, raw-schema, `go-to-bed`, exits listed with ids):

```json
{"outcome": "ask", "question": "Which path do you take to get to your room? Do you go up the stairs, go through the front door and up there, or something else?", ...}
```

**Native tools on MLX: prose instead of a call** (mlx4, tools, `sip-ale`; content, no `tool_calls`):

```
{"outcome": "happens"}
```

**Native tools on GGUF: the call leaks as text** (q4_k_m, tools, `do-the-thing`):

```
{"outcome":"ask","question":"What do you want to do?","choices":[...]}
</parameter>
</function>
</tool_call>
<user>
Mira Ashdown is a level 1 human rog...
```

**Native tools on GGUF: text with a chatty tail** (q8_0, tools, `moon`):

````
"{\"outcome\": \"impossible\"}\n```json\n{\n  \"outcome\": \"impossible\"\n}\n```\nThe declaration \"I jump to the moon\" is physically absurd ..."
````

(shown as the raw JSON string, since the reply itself contains a Markdown fence)

**Effect is mostly right.** Effect accuracy is 80–83% on every 9b JSON cell. The misses are mostly `move` on the check case `climb-wall` (it picks the docks exit) and `talk` given for speech while already in dialogue. Exit ids for loosely named exits ("my room" → `exit-stairs`, "the water" → `exit-docks`) are right in nearly every run.

**Skill choice.** `climb-wall` ("I climb the rain-slick seawall") gets `acrobatics` far more often than the SRD's `athletics` (climbing is the SRD's Athletics example). That alone accounts for most of the "Skill OK" gap.

## Re-running

```sh
pnpm eval:exchange:grid --round 1       # all round-1 cells, 5 runs each, one model resident at a time
pnpm eval:exchange:grid --round 1 --only qwen3.5-9b-mlx4 --runs 2
pnpm eval:exchange --model <loaded-id> --mode schema|raw-schema|tools --runs 5 [--cases a,b] [--think]
pnpm eval:exchange:report > report.md   # tables from results/*.json
```

LM Studio must be running on `http://localhost:1234` (override with `LM_STUDIO_BASE_URL`). Variant keys come from `lms ls <model> --json`.

## Results

Generated by `pnpm eval:exchange:report`. "Outcome (gate)" is the pass-bar accuracy. "Stray fields" is the share of valid answers carrying fields that don't belong to their outcome. "Skill OK" is scored on check cases the model called a check.

### Summary

| Cell                            | Mode       | Memory                       | Schema-valid | Outcome (all) | Outcome (gate) | Vague→ask | Check outcome | Skill OK | Difficulty on check | Stray fields | Effect valid | Effect correct | Adj TTFT p50 / p90 | Adj total p50 | Effect total p50 | Pass |
| ------------------------------- | ---------- | ---------------------------- | ------------ | ------------- | -------------- | --------- | ------------- | -------- | ------------------- | ------------ | ------------ | -------------- | ------------------ | ------------- | ---------------- | ---- |
| qwen3-4b-2507-mlx4-raw-schema   | raw-schema | 2.12 GiB (safetensors, 4bit) | 100%         | 75%           | 69%            | 75%       | 100%          | 63%      | 100%                | 26%          | 100%         | 74%            | 0.17s / 0.45s      | 0.35s         | 0.39s            | no   |
| qwen3-4b-2507-mlx4-schema       | schema     | 2.12 GiB (safetensors, 4bit) | 100%         | 75%           | 69%            | 75%       | 100%          | 60%      | 100%                | 100%         | 100%         | 74%            | 0.17s / 0.45s      | 0.86s         | 0.58s            | no   |
| qwen3.5-9b-gguf-q4km-raw-schema | raw-schema | 6.10 GiB (gguf, Q4_K_M)      | 100%         | 79%           | 75%            | 100%      | 100%          | 57%      | 100%                | 1%           | 100%         | 81%            | 0.66s / 0.82s      | 1.06s         | 1.30s            | no   |
| qwen3.5-9b-gguf-q4km-schema     | schema     | 6.10 GiB (gguf, Q4_K_M)      | 100%         | 81%           | 76%            | 100%      | 100%          | 50%      | 100%                | 93%          | 100%         | 80%            | 0.74s / 0.85s      | 2.63s         | 1.80s            | no   |
| qwen3.5-9b-gguf-q4km-tools      | tools      | 6.10 GiB (gguf, Q4_K_M)      | 91%          | 68%           | 62%            | 70%       | 93%           | 89%      | 100%                | 29%          | 94%          | 71%            | 0.78s / 0.93s      | 3.34s         | 1.97s            | no   |
| qwen3.5-9b-gguf-q8-raw-schema   | raw-schema | 9.73 GiB (gguf, Q8_0)        | 100%         | 81%           | 78%            | 100%      | 97%           | 72%      | 100%                | 6%           | 100%         | 79%            | 0.68s / 0.78s      | 1.39s         | 1.28s            | no   |
| qwen3.5-9b-gguf-q8-schema       | schema     | 9.73 GiB (gguf, Q8_0)        | 100%         | 83%           | 79%            | 100%      | 97%           | 72%      | 100%                | 84%          | 100%         | 82%            | 0.70s / 0.82s      | 2.36s         | 1.82s            | no   |
| qwen3.5-9b-gguf-q8-tools        | tools      | 9.73 GiB (gguf, Q8_0)        | 94%          | 76%           | 71%            | 100%      | 100%          | 87%      | 100%                | 21%          | 97%          | 83%            | 0.91s / 1.14s      | 2.96s         | 2.00s            | no   |
| qwen3.5-9b-mlx4-raw-schema      | raw-schema | 5.57 GiB (safetensors, 4bit) | 100%         | 79%           | 76%            | 100%      | 93%           | 61%      | 100%                | 8%           | 100%         | 81%            | 0.36s / 0.97s      | 0.91s         | 0.83s            | no   |
| qwen3.5-9b-mlx4-schema          | schema     | 5.57 GiB (safetensors, 4bit) | 100%         | 81%           | 78%            | 100%      | 93%           | 68%      | 100%                | 94%          | 100%         | 81%            | 0.35s / 0.91s      | 1.71s         | 1.01s            | no   |
| qwen3.5-9b-mlx4-thinking-schema | schema     | 5.57 GiB (safetensors, 4bit) | 0%           | 0%            | 0%             | 0%        | 0%            | n/a      | n/a                 | n/a          | 0%           | 0%             | 0.83s / 1.11s      | 1.70s         | 1.10s            | no   |
| qwen3.5-9b-mlx4-tools           | tools      | 5.57 GiB (safetensors, 4bit) | 9%           | 8%            | 2%             | 0%        | 37%           | 73%      | 100%                | 50%          | 91%          | 73%            | 0.92s / 1.83s      | 1.15s         | 1.65s            | no   |
| qwen3.5-9b-mlx8-raw-schema      | raw-schema | 9.74 GiB (safetensors, 8bit) | 100%         | 82%           | 78%            | 100%      | 100%          | 73%      | 100%                | 1%           | 100%         | 82%            | 0.45s / 1.17s      | 1.07s         | 1.03s            | no   |
| qwen3.5-9b-mlx8-schema          | schema     | 9.74 GiB (safetensors, 8bit) | 99%          | 80%           | 76%            | 95%       | 97%           | 72%      | 100%                | 99%          | 100%         | 80%            | 0.49s / 1.20s      | 2.57s         | 1.39s            | no   |

### Outcome accuracy by category

| Cell                            | trivial | move | talk | end_talk | speech | impossible | check | vague |
| ------------------------------- | ------- | ---- | ---- | -------- | ------ | ---------- | ----- | ----- |
| qwen3-4b-2507-mlx4-raw-schema   | 75%     | 40%  | 67%  | 100%     | 33%    | 100%       | 100%  | 75%   |
| qwen3-4b-2507-mlx4-schema       | 75%     | 40%  | 67%  | 100%     | 33%    | 100%       | 100%  | 75%   |
| qwen3.5-9b-gguf-q4km-raw-schema | 100%    | 60%  | 87%  | 100%     | 40%    | 52%        | 100%  | 100%  |
| qwen3.5-9b-gguf-q4km-schema     | 95%     | 60%  | 87%  | 100%     | 53%    | 56%        | 100%  | 100%  |
| qwen3.5-9b-gguf-q4km-tools      | 95%     | 60%  | 53%  | 80%      | 33%    | 44%        | 93%   | 70%   |
| qwen3.5-9b-gguf-q8-raw-schema   | 100%    | 52%  | 87%  | 100%     | 33%    | 80%        | 97%   | 100%  |
| qwen3.5-9b-gguf-q8-schema       | 100%    | 60%  | 67%  | 100%     | 60%    | 76%        | 97%   | 100%  |
| qwen3.5-9b-gguf-q8-tools        | 95%     | 60%  | 73%  | 80%      | 27%    | 60%        | 100%  | 100%  |
| qwen3.5-9b-mlx4-raw-schema      | 85%     | 52%  | 60%  | 100%     | 67%    | 80%        | 93%   | 100%  |
| qwen3.5-9b-mlx4-schema          | 90%     | 56%  | 60%  | 100%     | 53%    | 88%        | 93%   | 100%  |
| qwen3.5-9b-mlx4-thinking-schema | 0%      | 0%   | 0%   | 0%       | 0%     | 0%         | 0%    | 0%    |
| qwen3.5-9b-mlx4-tools           | 0%      | 0%   | 7%   | 0%       | 0%     | 4%         | 37%   | 0%    |
| qwen3.5-9b-mlx8-raw-schema      | 95%     | 56%  | 73%  | 100%     | 33%    | 88%        | 100%  | 100%  |
| qwen3.5-9b-mlx8-schema          | 100%    | 56%  | 73%  | 100%     | 33%    | 80%        | 97%   | 95%   |

### Outcomes per case

| Case             | Expected                        | qwen3-4b-2507-mlx4-raw-schema           | qwen3-4b-2507-mlx4-schema              | qwen3.5-9b-gguf-q4km-raw-schema                                | qwen3.5-9b-gguf-q4km-schema                                                   | qwen3.5-9b-gguf-q4km-tools                                           | qwen3.5-9b-gguf-q8-raw-schema                              | qwen3.5-9b-gguf-q8-schema                                  | qwen3.5-9b-gguf-q8-tools                                   | qwen3.5-9b-mlx4-raw-schema                               | qwen3.5-9b-mlx4-schema                                     | qwen3.5-9b-mlx4-thinking-schema | qwen3.5-9b-mlx4-tools                          | qwen3.5-9b-mlx8-raw-schema                                      | qwen3.5-9b-mlx8-schema                                         |
| ---------------- | ------------------------------- | --------------------------------------- | -------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------- | ---------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------- |
| sip-ale          | happens                         | happens×5                               | happens×5                              | happens×5                                                      | happens×5                                                                     | happens×5                                                            | happens×5                                                  | happens×5                                                  | happens×4 INVALID×1                                        | happens×5                                                | happens×5                                                  | INVALID×1                       | INVALID×5                                      | happens×5                                                       | happens×5                                                      |
| open-door        | happens                         | happens×5                               | happens×5                              | happens×5                                                      | happens×5                                                                     | happens×4 INVALID×1                                                  | happens×5                                                  | happens×5                                                  | happens×5                                                  | happens×5                                                | happens×5                                                  | INVALID×1                       | INVALID×5                                      | happens×5                                                       | happens×5                                                      |
| read-notices     | happens                         | happens×5                               | happens×5                              | happens×5                                                      | happens×5                                                                     | happens×5                                                            | happens×5                                                  | happens×5                                                  | happens×5                                                  | check:insight×1 happens×4                                | happens×5                                                  | INVALID×1                       | INVALID×5                                      | happens×5                                                       | happens×5                                                      |
| take-lantern     | happens                         | check:dexterity_save×5                  | check:arcana×1 check:dexterity_save×4  | happens×5                                                      | happens×4 check:sleight_of_hand×1                                             | happens×5                                                            | happens×5                                                  | happens×5                                                  | happens×5                                                  | check:sleight_of_hand×1 happens×3 check:stealth×1        | check:sleight_of_hand×1 happens×3 check:dexterity_save×1   | INVALID×1                       | INVALID×5                                      | happens×4 check:sleight_of_hand×1                               | happens×5                                                      |
| out-front        | happens                         | happens×5                               | happens×5                              | happens×5                                                      | happens×5                                                                     | happens×5                                                            | happens×5                                                  | happens×5                                                  | happens×5                                                  | happens×5                                                | happens×5                                                  | INVALID×1                       | INVALID×5                                      | happens×5                                                       | happens×5                                                      |
| down-cellar      | happens                         | check:acrobatics×5                      | check:arcana×1 check:acrobatics×4      | check:stealth×5                                                | check:stealth×5                                                               | check:stealth×1 check:strength_save×2 check:athletics×1 impossible×1 | check:stealth×4 ask×1                                      | check:stealth×5                                            | check:stealth×4 impossible×1                               | check:strength_save×2 check:stealth×2 ask×1              | check:stealth×4 check:acrobatics×1                         | INVALID×1                       | INVALID×5                                      | check:stealth×5                                                 | check:dexterity_save×1 check:stealth×3 ask×1                   |
| go-to-bed        | happens                         | happens×5                               | happens×5                              | check:stealth×5                                                | check:stealth×5                                                               | check:stealth×4 happens×1                                            | check:stealth×4 ask×1                                      | check:stealth×4 ask×1                                      | check:stealth×4 happens×1                                  | ask×1 check:stealth×4                                    | check:stealth×3 ask×1 check:perception×1                   | INVALID×1                       | INVALID×4 check:stealth×1                      | check:stealth×5                                                 | check:stealth×3 check:perception×1 ask×1                       |
| to-the-water     | happens                         | check:stealth×4 check:acrobatics×1      | check:stealth×5                        | happens×5                                                      | happens×5                                                                     | happens×5                                                            | happens×5                                                  | happens×5                                                  | happens×5                                                  | happens×4 impossible×1                                   | happens×5                                                  | INVALID×1                       | INVALID×5                                      | happens×5                                                       | happens×5                                                      |
| toward-tower     | happens                         | ask×5                                   | ask×5                                  | happens×5                                                      | happens×5                                                                     | happens×4 INVALID×1                                                  | check:perception×1 happens×3 check:stealth×1               | happens×5                                                  | happens×4 ask×1                                            | happens×4 check:perception×1                             | happens×4 impossible×1                                     | INVALID×1                       | INVALID×5                                      | happens×4 check:perception×1                                    | happens×4 check:stealth×1                                      |
| chat-maren       | happens                         | happens×5                               | happens×5                              | happens×5                                                      | happens×5                                                                     | happens×5                                                            | happens×5                                                  | happens×5                                                  | happens×4 INVALID×1                                        | happens×5                                                | happens×5                                                  | INVALID×1                       | INVALID×5                                      | happens×5                                                       | happens×5                                                      |
| greet-sergeant   | happens                         | happens×5                               | happens×5                              | check:sleight_of_hand×2 happens×3                              | happens×3 check:insight×1 check:deception×1                                   | check:persuasion×4 happens×1                                         | happens×3 impossible×1 check:persuasion×1                  | check:deception×5                                          | happens×5                                                  | check:deception×2 ask×3                                  | check:deception×2 check:persuasion×2 check:stealth×1       | INVALID×1                       | INVALID×4 happens×1                            | check:deception×2 check:insight×1 happens×1 check:perception×1  | check:stealth×2 check:perception×1 check:deception×1 happens×1 |
| hail-guard       | happens                         | check:deception×3 check:intimidation×2  | check:deception×4 check:intimidation×1 | happens×5                                                      | happens×5                                                                     | check:deception×1 ask×2 happens×2                                    | happens×5                                                  | happens×5                                                  | check:deception×3 happens×2                                | happens×4 check:insight×1                                | happens×4 check:insight×1                                  | INVALID×1                       | INVALID×5                                      | happens×5                                                       | happens×5                                                      |
| leave-maren      | happens                         | happens×5                               | happens×5                              | happens×5                                                      | happens×5                                                                     | happens×3 INVALID×1 ask×1                                            | happens×5                                                  | happens×5                                                  | INVALID×1 happens×4                                        | happens×5                                                | happens×5                                                  | INVALID×1                       | INVALID×5                                      | happens×5                                                       | happens×5                                                      |
| nod-goodbye      | happens                         | happens×5                               | happens×5                              | happens×5                                                      | happens×5                                                                     | happens×5                                                            | happens×5                                                  | happens×5                                                  | happens×4 INVALID×1                                        | happens×5                                                | happens×5                                                  | INVALID×1                       | INVALID×5                                      | happens×5                                                       | happens×5                                                      |
| last-night       | happens                         | check:investigation×5                   | check:investigation×5                  | ask×3 check:insight×2                                          | ask×3 happens×1 check:insight×1                                               | check:insight×3 INVALID×1 check:deception×1                          | check:insight×5                                            | happens×4 ask×1                                            | ask×4 INVALID×1                                            | happens×4 check:insight×1                                | check:insight×2 happens×3                                  | INVALID×1                       | INVALID×5                                      | check:perception×1 check:insight×2 check:stealth×1 impossible×1 | ask×1 check:perception×1 check:insight×2 check:stealth×1       |
| smugglers        | happens                         | check:investigation×5                   | check:investigation×5                  | ask×1 happens×1 check:insight×3                                | check:insight×3 happens×2                                                     | check:history×1 check:insight×2 check:investigation×1 INVALID×1      | ask×4 check:deception×1                                    | ask×4 check:insight×1                                      | check:insight×4 ask×1                                      | check:insight×4 happens×1                                | check:insight×4 ask×1                                      | INVALID×1                       | INVALID×5                                      | check:persuasion×1 check:insight×3 ask×1                        | ask×3 check:insight×2                                          |
| another-ale      | happens                         | happens×5                               | happens×5                              | happens×5                                                      | happens×5                                                                     | happens×5                                                            | happens×5                                                  | happens×5                                                  | happens×4 INVALID×1                                        | happens×5                                                | happens×5                                                  | INVALID×1                       | INVALID×5                                      | happens×5                                                       | happens×5                                                      |
| moon             | impossible                      | impossible×5                            | impossible×5                           | impossible×3 ask×2                                             | impossible×5                                                                  | impossible×3 check:acrobatics×1 INVALID×1                            | impossible×5                                               | impossible×5                                               | INVALID×1 impossible×4                                     | impossible×5                                             | impossible×5                                               | INVALID×1                       | INVALID×5                                      | impossible×5                                                    | impossible×5                                                   |
| absent-innkeeper | impossible                      | impossible×5                            | impossible×5                           | ask×5                                                          | ask×4 impossible×1                                                            | INVALID×1 ask×3 impossible×1                                         | impossible×4 ask×1                                         | impossible×2 ask×3                                         | impossible×2 INVALID×1 ask×2                               | ask×3 impossible×2                                       | ask×1 impossible×4                                         | INVALID×1                       | INVALID×5                                      | impossible×4 ask×1                                              | ask×3 impossible×2                                             |
| absent-dragon    | impossible                      | impossible×5                            | impossible×5                           | ask×4 impossible×1                                             | ask×3 impossible×2                                                            | impossible×2 ask×2 INVALID×1                                         | ask×2 impossible×3                                         | impossible×4 ask×1                                         | impossible×1 ask×4                                         | impossible×3 ask×2                                       | impossible×5                                               | INVALID×1                       | INVALID×5                                      | impossible×4 ask×1                                              | impossible×4 ask×1                                             |
| fly-wall         | impossible                      | impossible×5                            | impossible×5                           | impossible×4 ask×1                                             | ask×1 impossible×2 check:acrobatics×2                                         | check:acrobatics×1 INVALID×2 impossible×2                            | check:acrobatics×2 impossible×3                            | impossible×3 check:acrobatics×1 ask×1                      | ask×1 impossible×4                                         | impossible×5                                             | impossible×3 ask×1 check:acrobatics×1                      | INVALID×1                       | INVALID×5                                      | impossible×4 check:acrobatics×1                                 | impossible×4 check:acrobatics×1                                |
| lift-tavern      | impossible                      | impossible×5                            | impossible×5                           | impossible×5                                                   | impossible×4 ask×1                                                            | impossible×3 ask×1 INVALID×1                                         | impossible×5                                               | impossible×5                                               | INVALID×1 impossible×4                                     | impossible×5                                             | impossible×5                                               | INVALID×1                       | INVALID×4 impossible×1                         | impossible×5                                                    | impossible×5                                                   |
| climb-wall       | check:athletics                 | check:acrobatics×4 check:arcana×1       | check:acrobatics×4 check:arcana×1      | check:acrobatics×4 check:athletics×1                           | check:acrobatics×4 check:strength_save×1                                      | check:athletics×3 check:acrobatics×2                                 | check:acrobatics×4 check:strength_save×1                   | check:acrobatics×4 check:athletics×1                       | check:acrobatics×3 check:athletics×1 check:strength_save×1 | check:stealth×1 check:acrobatics×3 check:strength_save×1 | check:acrobatics×4 check:strength_save×1                   | INVALID×1                       | INVALID×1 check:athletics×1 check:acrobatics×3 | check:acrobatics×5                                              | check:acrobatics×5                                             |
| sneak-guard      | check:stealth                   | check:stealth×5                         | check:stealth×5                        | check:stealth×5                                                | check:stealth×5                                                               | check:stealth×5                                                      | check:stealth×5                                            | check:stealth×5                                            | check:stealth×5                                            | check:stealth×4 check:sleight_of_hand×1                  | check:stealth×5                                            | INVALID×1                       | check:stealth×2 INVALID×3                      | check:stealth×5                                                 | check:stealth×5                                                |
| persuade-guard   | check:persuasion                | check:persuasion×4 check:intimidation×1 | check:persuasion×5                     | check:insight×5                                                | check:insight×5                                                               | check:persuasion×5                                                   | ask×1 check:insight×1 check:persuasion×2 check:deception×1 | check:deception×2 check:persuasion×1 check:insight×1 ask×1 | check:persuasion×5                                         | ask×1 check:insight×4                                    | check:insight×2 ask×1 check:persuasion×1 check:deception×1 | INVALID×1                       | INVALID×4 check:persuasion×1                   | check:persuasion×3 check:deception×2                            | check:persuasion×5                                             |
| lie-sergeant     | check:deception                 | check:deception×5                       | check:persuasion×2 check:deception×3   | check:deception×3 check:persuasion×1 check:insight×1           | check:deception×4 check:insight×1                                             | check:deception×3 INVALID×1 ask×1                                    | check:deception×5                                          | check:deception×5                                          | check:deception×5                                          | check:deception×4 check:persuasion×1                     | check:insight×1 ask×1 check:deception×3                    | INVALID×1                       | INVALID×5                                      | check:insight×1 check:deception×4                               | check:deception×4 check:intimidation×1                         |
| pick-chest       | check:sleight_of_hand/stealth   | check:arcana×5                          | check:arcana×5                         | check:stealth×2 check:sleight_of_hand×2 check:dexterity_save×1 | check:stealth×2 check:arcana×1 check:dexterity_save×1 check:sleight_of_hand×1 | check:sleight_of_hand×5                                              | check:sleight_of_hand×4 check:dexterity_save×1             | check:dexterity_save×1 check:sleight_of_hand×4             | check:sleight_of_hand×5                                    | check:sleight_of_hand×4 ask×1                            | check:sleight_of_hand×5                                    | INVALID×1                       | check:sleight_of_hand×4 INVALID×1              | check:sleight_of_hand×5                                         | check:sleight_of_hand×3 ask×1 check:deception×1                |
| cross-log        | check:acrobatics/dexterity_save | check:acrobatics×5                      | check:acrobatics×5                     | check:acrobatics×4 check:strength_save×1                       | check:athletics×2 check:acrobatics×3                                          | check:acrobatics×4 check:athletics×1                                 | check:acrobatics×5                                         | check:acrobatics×5                                         | check:acrobatics×5                                         | check:acrobatics×5                                       | check:acrobatics×5                                         | INVALID×1                       | INVALID×5                                      | check:acrobatics×5                                              | check:acrobatics×4 check:athletics×1                           |
| do-the-thing     | ask                             | ask×5                                   | ask×5                                  | ask×5                                                          | ask×5                                                                         | ask×3 INVALID×1 check:deception×1                                    | ask×5                                                      | ask×5                                                      | ask×5                                                      | ask×5                                                    | ask×5                                                      | INVALID×1                       | INVALID×5                                      | ask×5                                                           | ask×5                                                          |
| over-there       | ask                             | check:stealth×4 check:acrobatics×1      | check:stealth×5                        | ask×5                                                          | ask×5                                                                         | ask×4 check:stealth×1                                                | ask×5                                                      | ask×5                                                      | ask×5                                                      | ask×5                                                    | ask×5                                                      | INVALID×1                       | INVALID×5                                      | ask×5                                                           | ask×5                                                          |
| use-it           | ask                             | ask×5                                   | ask×5                                  | ask×5                                                          | ask×5                                                                         | ask×3 check:stealth×1 INVALID×1                                      | ask×5                                                      | ask×5                                                      | ask×5                                                      | ask×5                                                    | ask×5                                                      | INVALID×1                       | INVALID×5                                      | ask×5                                                           | ask×4 INVALID×1                                                |
| try-something    | ask                             | ask×5                                   | ask×5                                  | ask×5                                                          | ask×5                                                                         | ask×4 INVALID×1                                                      | ask×5                                                      | ask×5                                                      | ask×5                                                      | ask×5                                                    | ask×5                                                      | INVALID×1                       | INVALID×5                                      | ask×5                                                           | ask×5                                                          |
