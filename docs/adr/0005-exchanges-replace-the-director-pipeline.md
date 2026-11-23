# Exchanges replace the Director pipeline

Status: accepted. Supersedes the Director pipeline of ADR 0003; the Scene, Mode and Event log stand.

Superseded by ADR 0006 (one DM agent with tools replaces the Exchange pipeline).

## Context

ADR 0003 made the model a menu-picker: after a player action, the Director chose the next step (narrate, NPC speaks, roll, move, yield) until it yielded or hit a step cap. That kept each model request small, but nothing owned the question the game turns on: what happens when the player tries this? The Director could yield with no reply, so the player acted and nothing came back. Rolls came from a menu rather than from the action. A clicked exit only pre-filled text. Play felt like operating a system, not talking to a DM.

The 5e loop is a conversation with a fixed rhythm: the DM describes, the player declares, the DM resolves and narrates, and the floor returns to the player.

## Decision

The unit of play is the Exchange: one Declaration, resolved and answered. Code runs it as fixed steps, each a narrow model request with one job:

1. **Adjudication.** The model rules on the Declaration: it happens, it is impossible, it is uncertain (a Check: a skill or save plus a difficulty tier), or it is unclear (a question, with optional choices). Code maps the tier to the SRD DC and rolls the d20. A Check or a question becomes a Call that suspends the Exchange and is persisted; the player's answer resumes it. A clarifying answer is merged into the Declaration and adjudicated again, with no cap.
2. **Effect.** This step runs only when the Declaration happened or its Check succeeded. The model picks one state change from options code builds out of the Scene: none, move through an exit, begin or end a conversation. Code validates and applies it. A click on an exit or an NPC already carries its Effect, so it skips this step but is still adjudicated.
3. **Reply.** Every Exchange ends with streamed prose, including impossible actions and failed Checks, and the floor returns to the player. Code picks the voice by Mode: in dialogue the NPC being spoken to answers, otherwise the Narrator.

The player always talks to the DM. Mode changes how a Declaration is read (in dialogue, words are speech to that NPC) and who voices the Reply. It never changes who receives the Declaration. Free text is always valid: typing while a Call is open withdraws the Call and starts a new Exchange, and buttons are shortcuts, never locks. The DC is never shown.

Adjudication and Effect use strict JSON-schema responses, not the provider's tool API. LM Studio ignores `tool_choice: "required"` on MLX builds (qwen3-4b-2507 answered with prose 10 times out of 10 when forced), and a schema gives the same contract: code treats the result like a tool call, round-trips through the UI and feeds the answer onward. A committed eval of Adjudication and Effect on the target local models gates the build.

## Considered options

- **Keep the Director and force a reply.** This fixes the silent yield but keeps a menu-picker that cannot rule on what the player said.
- **One agent with tools.** This is fluid, but it is the overloaded model request that ADR 0002 and ADR 0003 moved away from, and native tool forcing is unavailable on MLX.
- **Route input to a per-Mode agent** (the NPC agent receives everything in dialogue). This was rejected because it is a hard boundary a real table does not have ("I punch him mid-sentence"). The NPC voice survives as the Reply's speaker.

## Consequences

- Every Declaration gets a Reply, by construction.
- Three model requests per Exchange (two when a click skips Effect), plus the Check or question round trip. Latency is measured but not yet a constraint.
- A failed Check changes no state for now. Failure consequences ("fail forward") need systems that do not exist yet.
- A Reply has one voice. A Reply where an NPC speaks and the room also changes is future work.
- Things the Director did unprompted, such as an NPC arriving, come back through the Arc and Beat checks, not through per-action menus.
- Memory extraction, the rolling summary and the Beat check run after each completed Exchange. An Exchange waiting on a Call is not complete.
