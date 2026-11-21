# Scenes replace Turns, run by a director pipeline

Status: accepted (spec #200). Supersedes the Turn model and ADR 0002 (post-turn extraction instead of in-turn tools). Its Director pipeline is superseded by ADR 0005 (Exchanges replace the Director pipeline); the Scene, Mode and Event log stand.

## Context

Play was a chat: the player typed, the DM replied with one streamed block, and Turns alternated in a transcript. Everything the player needs to know (where they are, who is present, what is possible) was buried in that scrolling log, so the UI could not show it. The target models are small and local, and one call was asked to do too much: narrate, voice every NPC, decide when to ask for a roll and call tools. ADR 0002 moved memory out of the turn to keep that call reliable, but the turn itself stayed one overloaded agent.

## Decision

Play is a Scene that code owns and the UI renders, and the record of play is an Event log instead of Turns. The Turn model is removed, along with Roll request and Roll result as Turn-shaped terms.

The model stops being one agent holding tools and becomes narrow steps in a pipeline that code runs. The Director picks the next step from a short menu code builds from the Scene and answers with a short enum value. The Narrator streams scene prose. The NPC voice streams one NPC's line from only that NPC's context. Code validates every pick (one retry, then a code-chosen fallback), applies every state change (moves, dialogue, NPC arrival, roll DCs from a bounded table, the d20 roll itself), and decides when control returns to the player: when the Director yields, when a roll is requested, or at a tunable step cap. Steps run strictly in sequence. Events are typed, append-only and tagged with their producing role; a stopped or failed in-flight event is discarded.

This supersedes ADR 0002. Its reasoning (keep the model's per-call job small and make every model-proposed change pass code validation) is carried further here: Director picks and code-applied changes update state directly. Whether a silent extraction call is still needed for World memory is decided during implementation, not by this ADR.

## Existing data is wiped

There is no legacy period. Existing Turn data, and the Sessions that held it, are removed rather than migrated or kept readable beside events. The project is pre-release with no data worth preserving, and a Turn transcript does not map onto typed, role-tagged events: converting it would invent roles and structure the old data never had, and keeping both models alive would double the code paths for no user. The Session retains its place as the unit of play, owning an Event log and a Scene.

## Consequences

- The player always sees location, exits, objects, present NPCs and mode without scrolling.
- A weak local model has small, validatable jobs, and a bad pick costs a retry or a fallback rather than a stalled turn. Retries, fallbacks and cap hits are counted so a real-model session shows how well it copes; the retry and cap defaults are unproven until then.
- More model calls run per player action, in sequence.
- Old Sessions and transcripts are lost for good. The existing rule that a Character that has played any Session cannot be deleted applies to the new Sessions.
- The glossary gains Scene, Mode, Director and Event log. Turn, Roll request and Roll result are removed and are redefined by the tickets that need them.
