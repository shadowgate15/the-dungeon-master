# Research: which local model for World creation

Issue: shadowgate15/the-dungeon-master#21 (child of #12, "Map: World creation").
Date: 2026-11-01. Inputs: closed tickets #14 (reliability research) and #17 (live spike), plus model cards (Hugging Face, Qwen org) and LM Studio docs.

## Question

Which non-reasoning local model(s) should World creation recommend or default to, and is a minimum-viable vs recommended split worth it?

## Evidence

### Live spike (ticket #17, 5 runs each, streaming, simple 7-field seed schema)

| Model | On disk (`lms ls`) | Field | Seed | Median seed time |
|---|---|---|---|---|
| qwen2.5-1.5b-instruct (MLX) | 0.88 GB | 5/5 | 5/5 | 0.5 s |
| qwen3-4b-2507 | 2.28 GB | 5/5 | 5/5 | 1.2 s |
| qwen2.5-coder-14b | 8.33 GB | 5/5 | 5/5 | 2.7 s |
| qwen3-coder-30b (MoE) | 17.19 GB | 5/5 | 5/5 | 1.6 s |
| ornith-1.0-9b (MLX, reasoning) | 10.45 GB | 0/5 | 0/5 | n/a (empty `content`) |

- Shape is guaranteed by grammar-constrained decoding at every size, even 1.5B. Quality differed and was only eyeballed: the 1.5B gave generic, sometimes incoherent picks (`techLevel: stone` for a necromancer empire); larger models were more coherent. (#17)
- Reasoning models are unusable: the grammar is applied to `reasoning_content`. (#17)
- Arrays must be bounded (`maxItems`) and `max_tokens` set via `modelOptions`. (#17)
- LM Studio docs warn models under 7B may not support structured output. Held for quality, not shape, in the spike. (#14, https://lmstudio.ai/docs/developer/openai-compat/structured-output)
- Speed numbers are from one macOS machine; hardware specs were not recorded. Memory use at long context was not measured.

### Model cards (first-party)

| Model | Params | Native context | Non-reasoning | License | Source |
|---|---|---|---|---|---|
| Qwen3-4B-Instruct-2507 | 4.0B | 262,144 | Yes, non-thinking only, no `<think>` blocks | Apache 2.0 | https://huggingface.co/Qwen/Qwen3-4B-Instruct-2507 |
| Qwen3-30B-A3B-Instruct-2507 (base family of the coder variant is a sibling, see Gaps) | 30.5B total, 3.3B active | 262,144 | Yes, non-thinking only | Apache 2.0 | https://huggingface.co/Qwen/Qwen3-30B-A3B-Instruct-2507 |
| Qwen2.5-14B-Instruct | 14.7B | 131,072 claimed; default config 32,768, longer needs YaRN | Yes (no thinking mode) | Apache 2.0 | https://huggingface.co/Qwen/Qwen2.5-14B-Instruct |
| Qwen2.5-1.5B-Instruct | 1.54B | 32,768 | Yes | Apache 2.0 | https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct |

- Qwen3-4B-2507 card recommends temperature 0.7, top_p 0.8, top_k 20, min_p 0, and notes 32,768 context is a reasonable setting if memory is short.
- The 14B card claims improved JSON/structured output generation. 
- The tested `qwen2.5-coder-14b` and `qwen3-coder-30b` are code-tuned variants; their cards were not fetched, so context windows for those exact builds are unverified here.

### Obtaining models

`lms get <model>` downloads; `@<quant>` picks a quantization; `--mlx` / `--gguf` filter format; no name shows staff picks. Source: https://lmstudio.ai/docs/cli/get

## Ranked recommendation

Among models actually tested:

1. **qwen3-4b-2507: default and minimum viable.** 2.28 GB, 1.2 s seed, 5/5 shape, non-thinking only by design, 262K native context (the history-plus-compaction design is not context-limited), Apache 2.0. Best size/speed/quality balance; runs on any Apple Silicon Mac.
2. **qwen3-coder-30b: recommended upgrade for machines with roughly 24 GB+ unified memory.** Only 3.3B-class active params explain the 1.6 s seed time despite 17 GB on disk; more coherent creative output. The memory figure is an inference from file size, not measured. Caveat: code-tuned; try the general Qwen3-30B-A3B-Instruct-2507 sibling first (untested).
3. **qwen2.5-coder-14b: fallback.** Works 5/5 but is slower (2.7 s) than the larger MoE and has a 32K default window; no advantage over #1 or #2.
4. **qwen2.5-1.5b-instruct: not recommended.** Shape is fine, but content is generic and incoherent. Acceptable only as a last resort on very constrained hardware, with a quality warning.
- **Reject all reasoning models** (ornith-1.0-9b failed 0/5). Detect `structured-output-missing-result` and tell the user to switch.

Min-viable vs recommended split: worth it. Two tiers (4B default, 30B-class upgrade) is enough; do not hard-block the 1.5B but warn.

## Gaps

- Creative quality was eyeballed, n=5, simple schema; no scoring and no multi-turn (conversation plus compaction) test.
- Not tested: general Qwen3-30B-A3B-Instruct-2507, other families (Gemma, Llama, Mistral). A bake-off with a rubric would settle default vs upgrade.
- Hardware specs, RAM use and KV-cache cost at long context were not measured.
