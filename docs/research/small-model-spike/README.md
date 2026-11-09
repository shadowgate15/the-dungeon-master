# Small-model generate and revise spike

Live spike against LM Studio (2026-11-09), `response_format: json_schema` with a one-field schema `{premise: string}`, `max_tokens` 600, temperature 0.7. 20 one-shot generations (varied name/genre/scale/magic/tech) and 20 feedback revisions (revising generation i with a distinct note) per model.

Models: `qwen2.5-1.5b-instruct-mlx`, `qwen/qwen3-4b-2507`, `ornith-1.0-9b-mlx` (reasoning model).

Variants (1.5B and 4B only): `spike.mjs` baseline (existing prompt wording, schema `maxLength: 600`); `spike_nomax.mjs` baseline prompt, no `maxLength`; `spike_strong.mjs` no `maxLength`, prompt says "exactly 3 sentences, about 350 characters (roughly 55 words), never more than 450".

Run: `node spike.mjs <model> <out.json>`; summarize with `node an.mjs` (reads `res-*.json`). Raw outputs are in `results/`. Throwaway branch, never merged.
