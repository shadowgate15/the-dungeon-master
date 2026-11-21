# Context budgets and the manual harnesses

Each role's context has a named, tunable budget in `src/lib/server/session/context/budgets.ts`: Director 1,200 tokens, Narrator 2,600 (ceiling 4,000), Narrator memory sub-budget 800, NPC voice 1,300, verbatim floor 8, over-cap trim floor 4. The Rolling summary's threshold (1,200) and size (400) live in `src/lib/server/memory/summary.ts`. Tokens are estimated (`estimateTokens`, three characters a token), so a prompt never overruns.

## What CI checks

Deterministic specs under `src/lib/server/session/context/`: each role stays under its cap in fixtures, trims in the settled order (World memory by score, then events to the floor of 4, then the summary tail), the NPC builder takes one resolved NPC as its only memory input, and a planted-secrets test asserts no other NPC's note, unknown Fact, place or summary text reaches the NPC context.

## What stays manual (not in CI)

Two model-based harnesses, kept on the unmerged branch `research/context-caps-replay`, run against a real local model (`qwen/qwen3-4b-2507` when the values were set):

- The leak test: whether the model repeats planted secrets despite structural isolation.
- The latency and quality harness: latency, Director valid-pick rate and NPC isolation at several prompt sizes.

Re-run them only when a budget constant or the target model changes. They are not wired into `pnpm test`.

## Exchange model eval (manual, committed)

`scripts/exchange-eval/` scores Adjudication and Effect requests for local models in LM Studio across quants and wire modes. Run it with `pnpm eval:exchange:grid` and `pnpm eval:exchange:report`. Findings and how to re-run are in `docs/research/exchange-model-eval.md`. It is not wired into `pnpm test`.
