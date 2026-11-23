# Hybrid knowledge model, with visibility as data

Status: accepted (spec #313). Supersedes the World memory of ADR 0002 and ADR 0003: post-turn extraction, scored memory selection pushed into every prompt, NPC memory and NPC stance.

## Context

The old DM kept the story in World memory: NPC and Fact records written by a silent extraction call after each turn, scored, and pushed into every prompt. The story still drifted. NPCs forgot what they knew, secrets leaked because "who knows what" was a line of prompt text the model had to obey, and the model did arithmetic it shouldn't have. The rebuild runs the DM as one Claude Code agent that changes state only through the game's MCP tools (ADR 0006) and plays over many sittings, where the Claude Code transcript doesn't carry over. Continuity and secrecy have to live in the server, and they have to be checkable by code.

## Decision

Knowledge has two layers, both in the Campaign's SQLite database and written only through tools.

- **The World layer is the DM-only truth.** Every Entity (NPC, Place, Faction, Topic) has three parts, and each piece of truth has exactly one owner:
  - **Typed rows** for everything code enforces or the UI computes: HP, NPC status and whereabouts, inventory, a Place's exits, Beat state, the clock. Rows hold current state only. History is the Event log. A row field is never also restated in a Fact or Page text, and `lint` flags it when it is.
  - **One prose Page per Entity**, free text with `[[links]]` resolved to readable handles on write. Every revision is kept, and Pages are full-text indexed. They aren't markdown files.
  - **Facts**, append-only and bi-temporal: in-fiction `valid_from`/`valid_to`, plus the Session and event that recorded them. A Fact is never edited and never false. It changes only by supersession, which the DM names and code closes at the new Fact's `valid_from`, or by retirement with a reason. Nothing invalidates a Fact automatically.
- **The Knowledge layer is who knows what.** A **Belief** belongs to a Holder (a Character or an NPC) and points at a Fact, at an Entity's existence, or at a field's value as it was when learned. It can also carry its own claim and source, for lies and rumours. Code computes whether a Belief is outdated against the live World and never stores the result. A new Belief on the same target replaces the Holder's older one, which is kept as history.

Visibility is data, not a prompt rule. A Player sees only what their Characters believe: the Journal, "What <Character> knows" and the pitch after Begin are read from Beliefs, with the World-layer truth stripped out. The DM voices an NPC by reading that NPC's Beliefs (`beliefs_of`), which flag outdated ones beside the truth, so the NPC can be wrong on purpose. `reveal` is the only way a Holder learns something, and its default Holders are the Characters in the Scene.

The DM pulls what it needs (`search`, `open`, `beliefs_of`, `history`) instead of having memory pushed at it. Each sitting starts from a small core block, and every read returns per-Entity versions that every write must pass back, so the DM never overwrites what it didn't see.

## Considered options

- **Keep World memory with post-turn extraction.** Its constraints existed for small local models. It lags play, misses things, and still leaves secrecy to the prompt.
- **Facts only, with no Pages.** Facts are precise but fragmentary. Describing an NPC or a Place in a dozen claims is clumsy to write and to read, so each Entity needs one prose home.
- **Pages only, as markdown files in the Campaign folder.** Easy to read and diff, but nothing can supersede a claim, ask who knows it or check a link, and a file the Player can open is no place for secrets.
- **A visibility flag per Fact** (public or secret). It can't say which Holder knows what, can't represent a lie, and can't show a Character holding an outdated Belief.

## Consequences

- Secrets are enforced at the tool boundary. A Player-visible payload is built from Beliefs, so tests can assert that World-layer truth never reaches the browser.
- Deception works: an NPC who was told a lie keeps believing it until a `reveal` replaces it, and a Character keeps an outdated Belief until they learn the truth.
- The DM does more bookkeeping (`establish`, `add_fact`, `reveal`, `edit_page`). Near-duplicate refusal, version checks and `lint` keep that honest, and fixing what `lint` finds is the DM's job through ordinary tools.
- Supersession and retirement are explicit, so the World never quietly changes. A Fact the DM forgot to supersede stays current until `lint` or the DM notices.
- Rows and the Event log already cover numbers and history, so Facts and Pages hold only what has no fixed field. The single-owner rule is checked by `lint`, not by the schema.
