# One DM agent with tools replaces the Exchange pipeline

Status: accepted. Supersedes the code-driven pipeline of ADR 0005 (Adjudication, Effect, Reply as three fixed model requests). The Exchange, Declaration, Check and the rule that every Declaration gets a Reply stand.

## Context

ADR 0005 ran each Exchange as three narrow, code-sequenced model requests because "one agent with tools" was not viable on local models: LM Studio on MLX ignores forced tool choice. The rebuild as a Claude Code plugin drops local models entirely: all game AI runs in one Claude Code session acting as DM, reached by player input through channels and changing state only through the game's MCP tools.

## Decision

The DM is one Claude Code agent (a plugin agent started by the launcher with `--agent`) that follows the table rhythm by judgment and calls tools. Code no longer sequences the steps of an Exchange. What ADR 0005 guaranteed by construction is guaranteed by tool contracts and hooks instead:

- **Checks** are rolled only by a tool, which maps the difficulty tier to the SRD DC and rolls the d20. The model never produces a number.
- **State changes** go only through tools that validate them. Writes carry the per-entity version they read, and a stale write is refused with an instruction to re-read.
- **Every Declaration gets a Reply.** The server tracks a Declaration that has arrived and not yet been answered by the `reply` tool, and a Stop hook refuses to end the DM's turn while one is open. On a second attempt it lets the turn end and the UI shows an error, so the hook cannot loop.
- **A Call** is no longer a persisted, suspended pipeline: it is a Reply that asks a question or for a roll and ends the turn. The player's next input continues the conversation.

## Considered options

- **Keep the pipeline, with Claude as the model.** Its constraints existed only for local models, and it costs three requests per Exchange and cannot handle a Declaration that needs several Effects.
- **A subagent per NPC.** It was already rejected in ADR 0005 as a hard boundary a real table does not have. The DM voices NPCs in its own thread after looking up what that NPC believes.

## Consequences

- Fewer model requests per Exchange, but the rhythm is held by instruction and enforced only at its edges (tools, the Stop hook). Play quality is judged by playing.
- One Reply can now combine an NPC speaking and the room changing, which ADR 0005 left as future work.
- The invariants live in the MCP tool surface and the plugin's hooks, so those are where tests go.
