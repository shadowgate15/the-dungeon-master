# Post-turn extraction instead of in-turn memory tools

Status: accepted and implemented (#189).

## Context

The DM needs durable memory of the NPCs and facts it establishes, so they survive across Sessions. The obvious design is in-turn tools: the DM calls `create_npc` or `record_fact` while narrating. The target models are small and local. They already have one tool to use correctly (`request_roll`), and every extra tool call during a turn is a chance to emit invalid arguments, narrate and call at once, or loop. A rejected call inside a turn costs retries against the rejection budget that the player is waiting behind, and a turn that fails after a tool ran leaves memory written for narration that was discarded.

## Decision

Memory is written only after a DM turn is durably saved, by a separate, silent, stateless extraction call (the same shape as the rolling summary job). The DM turn stays narration plus at most one `request_roll`. The extraction call is shown the unextracted Turns and the existing records in compact form with stable ids, and proposes deltas only: NPC create and update by id (with disposition and knowledge) and fact create. Code validates ids, enums, lengths, referential integrity, per-call caps and exact-name duplicates, and drops each invalid item on its own with a server log entry. Nothing a model proposes reaches the database unvalidated.

A `memoryThroughSeq` watermark per Session records the last Turn extraction covers. Each call covers every Turn since it, so a transient failure loses nothing. Unparseable output is dropped whole and counts as a failure; after a few failures in a row extraction stops for that Session. One extraction runs per Session at a time, and the next DM turn never waits on it. A discarded, stopped or failed DM turn is never extracted, so Retry cannot duplicate or orphan records.

## Consequences

- The DM turn path is unchanged and as reliable as before; memory failures are invisible to the player.
- Extraction lags the narration slightly. A new Session must drain pending extraction (bounded by a timeout) before it starts, so it opens with what the last one established.
- One extra model call per DM turn on a local model. Small, stateless prompts keep it cheap, and the failure counter bounds the cost of a model that cannot do it.
- The model can miss or misjudge things. Only later extraction corrects memory; there is no player override.
- Rejections cost nothing in player-visible terms, so validation can be strict.
