# PROTOTYPE: context-cap replay (#233)

Throwaway. Never merged. `node scripts/prototype-context-replay/replay.mjs --sizes 600,2600 --trials 3`.

Model `qwen/qwen3-4b-2507` (262144 ctx) via LM Studio on the dev laptop. Role system prompts copied verbatim from `scene-director/`. Filler is deterministic synthetic history / World memory; "tok" is the prompt tokens the server reported. Raw results: `results/sweep-small.json` (3 trials per case), `results/sweep-large.json` (1 trial).

| prompt tok | Director latency                       | Director valid / good | Narrator TTFT | Narrator needle recall | NPC total     | NPC recall |
| ---------- | -------------------------------------- | --------------------- | ------------- | ---------------------- | ------------- | ---------- |
| ~0.6K      | 0.7s                                   | 100% / 92%            | 1.4s          | 100%                   | 1.1s          | 100%       |
| ~1.2K      | 2.0s                                   | 100% / 100%           | 2.7s          | 100%                   | 2.1s          | 100%       |
| ~2.5K      | 3.8s                                   | 92% / 75%             | 5.2s          | 100%                   | 3.8s          | 100%       |
| ~3.8K      | 6.1s                                   | 92% / 50%             | 8.1s          | 78%                    | (39s outlier) | 100%       |
| ~7.7K      | 13.5s                                  | 92% / 67%             | 18.5s         | 100%                   | 12.5s         | 100%       |
| ~15K       | 32.6s                                  | 75% / 42%             | 46.8s         | 100%                   | 29.8s         | 100%       |
| ~30K       | 89s                                    | 100% / 50% (n=4)      | 135s          | 100% (n=3)             | 80s           | 100%       |
| ~60K       | 275s, 1 failed                         | 50% (n=4)             | all failed    | n/a                    | 246s          | 100% (n=3) |
| ~128K      | all failed (fetch failed / terminated) | n/a                   | n/a           | n/a                    | n/a           | n/a        |

- Prefill is roughly 1.5-2 ms/token up to ~8K and worse beyond (superlinear). There is no prompt caching between calls here.
- Director quality, not just latency, degrades first: "good" pick rate drops from ~100% at 1.2K to ~50% by 4K on this padded-history fixture; invalid answers (bare `marta` instead of `npc-speaks:marta`) appear from 2.5K.
- Narrator and NPC needle recall stayed ~100% to 60K; the model does not lose facts, it gets slow. The one 78% is a single miss in 9.
- NPC isolation: structural builder leaked 0/6 (secret never in the prompt); the control (secret placed in the NPC context) leaked 6/6, so the test can fail.
- Caveats: n is small, "good" is a strict heuristic, filler history is repetitive so Director "good" is probably pessimistic, and one 39s NPC outlier looks like model contention. Latency is for this laptop only.
