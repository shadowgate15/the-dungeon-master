# Inventory of the removed memory, summary, Journal, recap and Beat-progress code

Research for issue #224 (map #223). Facts only; no recommendations.

## Sources and conventions

- Deleted code is read from the parent of the scene-play commit: `git show 8d0c1d3^:<path>`. `8d0c1d3` is "feat: scene-based session play with a director pipeline (#213)". Paths below are given as they were at `8d0c1d3^`, written `old:<path>`.
- Current code is read from `HEAD` of `main` at the time of writing (`8d0c1d3`, no later commits).
- Migrations: `drizzle/0005_session_summary.sql`, `0007_memory.sql`, `0008_arc.sql`, `0009_journal_marker.sql` (creation) and `drizzle/0010_remove_turns.sql`, `0011_scene_event_log.sql` (removal).
- Docs: `GLOSSARY.md` (before and after `8d0c1d3`), `docs/adr/0002-post-turn-extraction-instead-of-in-turn-tools.md`, `docs/adr/0003-scenes-replace-turns.md`.
- "Turn" below means the pre-Scene `turn` table row (one `seq` per player turn or DM turn). Numbers such as caps and budgets are the values in the deleted code.

## 1. What was removed, in one table

| Area                                 | Deleted code (old:)                                                                                                                                                                      | Deleted schema                                                                                             |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Rolling summary                      | `src/lib/server/session/summary.ts`, summary parts of `turn-runner.ts`, `context.ts`, `service.ts`                                                                                       | `session.summary`, `session.summarized_through_seq`                                                        |
| World memory and NPC memory          | `src/lib/memory/enums.ts`, `src/lib/server/memory/{repository,extraction,context}.ts`, `src/lib/server/session/memory-input.ts`                                                          | tables `place`, `faction`, `event`, `npc`, `fact`, `disposition`, `npc_fact`; `session.memory_through_seq` |
| Journal                              | `src/lib/memory/journal.ts`, `src/lib/server/memory/journal.ts`, `src/lib/session/Journal{Button,Overlay}.svelte`, `journalSeen` form action                                             | table `journal_marker`                                                                                     |
| Recap                                | `src/lib/server/session/recap.ts`, `src/routes/api/sessions/[id]/recap/+server.ts`, recap query in the session page                                                                      | none (in-memory cache only)                                                                                |
| Arc Beat progress                    | `src/lib/server/arc/context.ts`, `openBeats` and `transitionBeat` in `src/lib/server/arc/service.ts`, Beat-state UI in `src/lib/arc/ArcSection.svelte`, `src/routes/arc-progress.e2e.ts` | `arc_beat.state`, `arc_beat.source_session_id`, `arc_beat.source_turn_seq`                                 |
| Turn model that fed all of the above | `turn-runner.ts`, `context.ts` (DM context), `lifecycle.ts`, `roll-request.ts`, `/api/sessions/[id]/turn`                                                                                | tables `turn`, `session` (recreated, see section 8)                                                        |

`drizzle/0010_remove_turns.sql` (the whole file, in order): rebuilds `arc_beat` as `id, act_id, position, title, description` copying only those columns from the old table, recreates index `arc_beat_act (act_id, position)`, then `DROP TABLE` for `npc_fact`, `disposition`, `npc`, `fact`, `event`, `faction`, `place`, `journal_marker`, `turn`, `session`, wrapped in `PRAGMA foreign_keys=OFF/ON`. `drizzle/0011_scene_event_log.sql` creates `session`, `session_event`, `session_scene` (section 8).

## 2. Schema that existed (`old:src/lib/server/db/schema.ts`)

### 2.1 Session columns

- `session.summary` text, nullable. Doc comment: rolling summary written by a separate stateless call; a new Session starts from the previous Session's final summary; "Contains no numbers".
- `session.summarized_through_seq` integer not null default 0: last Turn `seq` in this Session the summary covers.
- `session.memory_through_seq` integer not null default 0: last Turn `seq` in this Session that extraction covers (the "watermark").

### 2.2 Common provenance columns on `place`, `faction`, `event`, `npc`, `fact` (`memoryColumns()`)

`id` (text uuid pk), `campaign_id` (fk campaign, cascade), `created_session_id` and `changed_session_id` (fk session, cascade), `created_seq` and `changed_seq` (integer, Turn seq), `retired_at` (integer, nullable), `retired_reason` (text, nullable), `created_at`, `updated_at` (integer ms). Records are retired by flag, never deleted. All cascade with the Campaign.

### 2.3 Tables

- `place`, `faction`, `event`: common columns plus `name` (not null), `description` (nullable). Index `<table>_campaign_idx (campaign_id)`.
- `npc`: common plus `name` not null, `description`, `role` (nullable), `status` (enum `alive|dead|missing|departed`, default `alive`, CHECK `npc_status_check`), `place_id` (nullable fk `place`, set null on delete). Index `npc_campaign_idx`.
- `fact`: common plus `title` not null, `detail` nullable, `world_changing` boolean default false, `superseded_by_id` (self-fk `fact`, set null on delete). Immutable: changes only by being superseded or retired. Index `fact_campaign_idx`.
- `disposition`: pk `(npc_id, character_id)`; `npc_id` fk npc cascade, `character_id` fk character cascade, `stance` enum `hostile|wary|neutral|friendly|allied` (CHECK), `note` nullable, `changed_session_id` fk session cascade, `changed_seq`, `updated_at`.
- `npc_fact`: pk `(npc_id, fact_id)`, both fk cascade. "What an NPC knows"; fact text is never copied per Character.
- `journal_marker`: pk `(campaign_id, character_id)`; `session_id` fk session cascade, `seq`, `updated_at`. "Where the player last looked at the Journal."
- `arc_beat` (columns that existed beyond today's): `state` enum `pending|reached|abandoned` default `pending` (CHECK `arc_beat_state_check`), `source_session_id` (nullable fk session, set null), `source_turn_seq` (nullable integer). Comment: id is stable across edits so progress survives them; `state` leaves `pending` once, then the source Session and Turn seq are stamped.

### 2.4 What no code ever wrote

In `old:src/lib/server/memory/repository.ts` there are create/update functions only for NPCs (`createNpc`, `updateNpc`), facts (`createFact`, `retireFact`, `supersedeFact`), dispositions and NPC-fact links. There is no writer for `place`, `faction` or `event` rows, none that sets `npc.place_id`, and none that retires an NPC (`retired_at` on `npc` is never set; `goneNpcs` and the Journal still filter on it). The extraction prompt and validator (section 4) have no place, faction or event items. The Journal and the context renderer read all five kinds.

## 3. Rolling summary (`old:src/lib/server/session/summary.ts`, `turn-runner.ts`)

- Trigger: after each saved DM turn, `summarizeIfDue(sessionId, turnBudget)`. Due when there are unsummarized Turns (`seq > session.summarized_through_seq`) and their estimated tokens exceed `SUMMARY_THRESHOLD = 0.5` times the DM context's `turnBudget`. All unsummarized Turns count, including ones too old to fit the DM prompt.
- Token estimate: `estimateTokens = ceil(chars / 3)` (`src/lib/server/ai/tokens.ts`, still present).
- One summary job per Session at a time (a `Map` of running promises). Runs in the background; never blocks or fails a turn.
- Call: stateless, free text (`collectText`), `maxTokens = SUMMARY_MAX_TOKENS = 512`, abort after `SUMMARY_TIMEOUT_MS = 60_000`, `threadId = "<sessionId>:summary"`.
- Prompt (`SUMMARY_INSTRUCTIONS`, verbatim): "You keep the running notes of a solo Dungeons & Dragons game for its Dungeon Master. Merge the earlier notes (if any) with the new transcript into one updated summary of the story so far: where the player's Character is, what has happened, who they met, what was promised or left unresolved. Write plain prose in the past tense, under 250 words, with no headings or lists. Never include numbers or digits of any kind: no dice results, hit points, gold, distances, dates or counts. Say "a few", "badly wounded" or "a handful of coins" instead. Reply with the summary text only."
- User message: `Earlier notes:\n<previous summary>` (or `Earlier notes: none.`) then `New transcript:\n` plus unsummarized Turns as lines `DM: ...` / `Player: ...` (a DM roll request is appended as `[The DM asked for a <key> <check> check, DC <n>: <reason>]`; a roll result reads `I rolled <label>.`).
- Validation: result is `undefined` (failure) on a model error, abort/timeout, empty answer, or any digit (`/\d/`) in the text. The 250-word limit is only in the prompt; code does not check length.
- Failure handling: silent. Consecutive failures counted per Session in an in-process `Map`; at `SUMMARY_MAX_FAILURES = 3` the runner stops trying for that Session "for the rest of the process" (the counter is not persisted). On success, the counter is cleared and `sessions.saveSummary(id, summary, lastUnsummarizedSeq)` writes `summary` and `summarized_through_seq`. `saveSummary` is allowed on an ended Session (so one still being written at "end" is what the next Session inherits).
- Carry-over: `sessions.start()` copied `summary` from the newest Session of the Campaign (by `started_at`, then rowid) whose `summary` was not null, into the new `session.summary`. `summarized_through_seq` of the new Session started at 0 (the carried text is "earlier notes" for the first summary call of the new Session).
- Consumers of the summary: the DM context, the recap (section 6). Not shown in any UI.

## 4. World memory and NPC memory: extraction (`old:src/lib/server/memory/extraction.ts`, `turn-runner.ts`, ADR 0002)

### 4.1 Scheduling

- Runs only after a DM turn was durably saved (`extractIfDue` called beside `summarizeIfDue`). A discarded, stopped or failed DM turn never triggers it. A turn that ends in a pending Roll request does.
- Covers every Turn with `seq > session.memory_through_seq` up to and including the last DM turn in that range; a trailing unanswered player action waits. On success the watermark is saved as that DM turn's `seq` (allowed on an ended Session). After a success it re-checks, so Turns saved meanwhile are covered.
- One extraction at a time per Session (a `Map`). The next DM turn never waits on it.
- Failure counter per Session in an in-process `Map`; at `MEMORY_MAX_FAILURES = 3` consecutive failures extraction stops for that Session (not persisted). On failure the watermark does not move, so the next successful call covers all Turns since.
- Starting a Session: the Campaign page's `startSession` form action first awaited `turnRunner.drainMemory()`: waits for running extraction up to `MEMORY_DRAIN_TIMEOUT_MS = 30_000`, then proceeds (extraction keeps running). Starting never called the model.

### 4.2 The call

- Structured call (`callModel` with `outputSchema`), `maxTokens = MEMORY_MAX_TOKENS = 1024`, abort after `MEMORY_TIMEOUT_MS = 60_000`, `threadId = "<sessionId>:memory"`. No retry within a call.
- `runExtraction` returns true when the output parsed (even if every item was later rejected) and false on a model failure, abort/timeout, unparseable output or a thrown error; never throws.
- System prompt (`EXTRACTION_INSTRUCTIONS`, begins with the marker `MEMORY EXTRACTION`): the model "keep[s] the notes of a solo Dungeons & Dragons game", reads the new transcript and proposes JSON lists `npcs`, `facts` and, rarely, `revives`, `supersedes`, `retires`; "Propose only what the story clearly established. Reply with empty lists when nothing changed." Item shapes:
  - `npcs`: new = `{name, description, role, status, stance, note, knows}` with no `id`; update = existing `id` plus only changed fields. `status` in `alive, dead, missing, departed`; `stance` (toward the player's Character) in `hostile, wary, neutral, friendly, allied`; `note` is a short reason; `knows` lists fact ids or the exact title of a fact proposed in the same call. "A dead character stays dead."
  - `revives`: only for an explicit return from death: `{id, reason, status?}` (default alive). Never use `npcs` to change a dead character's status.
  - `supersedes`: `{id, reason, title, detail, worldChanging}` replacing an existing fact. `retires`: `{id, reason}` for a fact that turned out false or irrelevant. "Facts are never edited; only supersede or retire them."
  - `facts`: `{title, detail, worldChanging}`; `worldChanging` true "only when the player's Character changed the world itself". "Never repeat an existing fact."
  - General: keep text short; never invent numbers, dice results, hit points or items; never reuse an existing character's name (update by id).
  - `beats` (section 7): `{id, state}` only when open Beats are listed.
- User message: existing records block (header `Existing notes, each record with its [id]:`, or that header followed by `none`), then the open-Beats list if any, then `New transcript:` with the covered Turns as `DM:` / `Player:` lines.
- Budget for existing records: `remaining = contextLimit - 1024 - tokens(instructions) - tokens(transcript) - tokens(open Beats text)`; records get `floor(max(0, remaining) * EXTRACTION_MEMORY_SHARE)`, share 0.5, using the same renderer as the DM context (section 5) with ids shown, over a mention window of the covered Turns, focus = (Session, last covered `seq`).
- Output schema (zod, deliberately loose): `{npcs: object[], facts: object[], revives?: object[] (default []), supersedes?, retires?, beats?}`; `npcs` and `facts` are required lists. Each item is validated individually afterwards.

### 4.3 Validation (`applyDeltas`), per item; each invalid item is dropped on its own and logged

Log format: `console.warn("[memory] dropped <npc|fact|beat> proposed in turn <seq>: <reason>")`. Rejections never count as a call failure. Nothing the model proposes is written without passing these checks. Order of application: facts, then retires/supersedes, then NPCs, then revives, then Beat transitions.

Text limits (`MEMORY_LIMITS`, `old:src/lib/memory/enums.ts`): `name` 80, `description` 300, `role` 80, `note` 200, `factTitle` 120, `factDetail` 300, `reason` 120. Required text must be a non-empty trimmed string within the limit.

Per-call caps (excess items dropped with reason "over the per-call cap"):

| Constant               | Value | Applies to                                                                              |
| ---------------------- | ----- | --------------------------------------------------------------------------------------- |
| `MAX_NPC_ITEMS`        | 8     | `npcs`                                                                                  |
| `MAX_FACT_CREATES`     | 8     | `facts`                                                                                 |
| `MAX_CORRECTION_ITEMS` | 4     | `supersedes` and `retires` combined, taken alternately (retire, supersede, retire, ...) |
| `MAX_REVIVE_ITEMS`     | 4     | `revives`, separate from the correction cap                                             |
| `MAX_BEAT_TRANSITIONS` | 3     | `beats`                                                                                 |

Fact create: `title` required (120), `detail` optional (300), `worldChanging` if present must be boolean, reject if an existing fact (any state) has the same title after trim/lower-case.
Retire or supersede: target `id` must be an existing fact of this Campaign that is not retired; `reason` required (120). Supersede additionally validates title/detail/worldChanging as a create, rejects a title that matches an existing fact, creates the new fact, flags the old one superseded and retired, and moves every NPC's knowledge link to the new fact. Retire flags the fact retired with the reason and deletes every `npc_fact` row for it.
NPC create (no `id`): `name`, `description` required; `role`, `status`, `stance`, `note` optional; `status` and `stance` must be in their enums; `knows`, if present, must be a list. Reject if an NPC of the Campaign already has the same normalized name ("update it by id"). Create defaults: `role` empty string, `status` alive.
NPC update (`id` given): id must exist and belong to this Campaign; every field optional; a rename to another existing NPC's name is rejected; a status other than `dead` on a dead NPC is rejected ("a dead npc stays dead").
Disposition: if `stance` or `note` is given, upsert `disposition` for (NPC, the Session's Character), keeping the old stance (default `neutral`) or old note when not supplied.
Knowledge: each `knows` entry must be a live fact id or the title of a live (or just-created) fact, else the entry is rejected ("knows names a fact that does not exist") while the rest of the item stands. Links are `npc_fact` rows.
Revive: NPC must exist in this Campaign and be `dead`; `reason` required; `status` optional and must not be `dead` (default alive).
All writes stamp `changed_session_id`, `changed_seq`, `updated_at` (and created_* on insert) with the Session and the last covered Turn's `seq`.

## 5. World memory in the DM context (`old:src/lib/server/memory/context.ts`, `session/context.ts`, `session/memory-input.ts`)

`buildMemoryBlock(input, budgetTokens, options)` was a pure function (no clock, randomness or model). Returns `null` when there is nothing to say (prompt unchanged for a Campaign with no memory).

- Budget: `MEMORY_BUDGET_SHARE = 0.25` of `contextLimit - replyReserve - tokens(fixed prompts + summary)`. Turns get the remaining budget including unused memory budget. `contextLimit` default `DEFAULT_CONTEXT_LIMIT = 4096` (still in `src/lib/server/ai/config.ts`); `DM_REPLY_TOKENS = 1024`.
- System prompt order for a DM call: DM instructions, Campaign Seed block, Worlds block, Arc block (accepted Arc only), Character sheet text, memory block, rolling summary (`The story so far (a summary of earlier play):`). Header of the memory block: "World memory (what the story has established about this Campaign; where it disagrees with the story summary below, memory wins):". The extraction call replaces the header and adds `[id]` prefixes.
- Mention window: text of the newest `MENTION_WINDOW_TURNS = 6` Turns. For a Session with no Turns yet, the window is the previous Session's last 6 Turns and "now" (focus) is that Session's end.
- Mention match: record label (NPC name, fact title, place/faction/event name) matched case-insensitively with Unicode letter/digit word boundaries.
- Records considered: live only (`retired_at` null); facts also exclude superseded.
- Core (always-on) entries, ranked: rank 0 alive NPCs whose stance is allied, friendly or hostile; rank 1 NPCs mentioned in the window; rank 2 world-changing facts.
- Selected entries (not core) scored: mention 8, link to a core or mentioned record 4 (links: NPC to its place and to the facts it knows), recent 2 (changed in the focus Session within `RECENT_CHANGE_TURNS = 10` Turns), created-this-Session 1; entries with score 0 are omitted.
- Gone line: non-alive NPCs not otherwise included, most recently changed first, max `GONE_LINE_MAX = 10`.
- Rendering: sections People, Places, Factions, Events, Facts; NPC line `- Name (status, <stance> toward you), role` plus description, `Note: ...` and `Knows: <fact titles>`; fact and named-record lines `- Title: detail`; final `Gone: Name (status), ...`.
- Overflow order (pinned by tests): drop selected entries lowest score first, then degrade core entries to name-only (lowest rank first), then drop core entries, then drop the gone line. Records never shrink mid-record.
- Stance is shown only for the Character playing (`snapshot(campaignId, characterId)` joins `disposition` on that Character).

## 6. Recap (`old:src/lib/server/session/recap.ts`, route, session page)

- Endpoint: `GET /api/sessions/[id]/recap` returned `{ recap: string | null }`; returned `null` while the runner was generating. Never saved to the database; not a Turn.
- Eligibility inside `recap.get`: Session exists, not ended, has at least one Turn, and the derived Turn state is `awaiting-action`. Otherwise `undefined`.
- Cache: in-process `Map` keyed by Session id holding `{seq, text}`; a hit requires the last Turn `seq` to be unchanged.
- Inputs: the rolling summary (`Notes so far:\n<summary>` or `Notes so far: none.`), the newest Turns fitting `RECAP_TURN_BUDGET = 2000` tokens as transcript lines, and a memory block built with `RECAP_MEMORY_BUDGET = 500` tokens (when memory was wired in).
- Call: free text, `maxTokens = RECAP_MAX_TOKENS = 300`, abort on the caller's signal or after `RECAP_TIMEOUT_MS = 60_000`, `threadId = "<sessionId>:recap"`.
- Prompt (`RECAP_INSTRUCTIONS`): "You are the Dungeon Master of a solo Dungeons & Dragons game, welcoming the player back after a break. In two or three sentences, in the second person, remind them where their Character is and what was just happening, from the notes and the latest transcript below. Do not advance the story, do not ask for dice rolls and never invent numbers or game state. Reply with the recap text only."
- Failure handling: any error, abort, timeout or empty text yields no recap (silent). No validation of the text.
- UI (`old:src/routes/campaigns/[id]/sessions/[sessionId]/+page.svelte`): on mount, if the page was not reached via `?opening`, the Session is open, not generating and awaiting an action, a TanStack query fetched the recap; shown as an `aside` labelled "Recap" with the small heading "Previously" and the text; any model-calling action (send, roll) cancelled it. Query key included the last Turn `seq`.

## 7. Journal (`old:src/lib/memory/journal.ts`, `src/lib/server/memory/journal.ts`, Svelte components)

- Definition (old glossary): the player's read-only view of World memory, grouped by the Session each record first appeared in, with chips for new or changed since the player last looked; cannot be edited.
- Data (`createJournal(db).view(campaignId, characterId)`): entries from live (not retired) NPCs, facts (a superseded fact is also retired, so it is omitted), places, factions and events of the Campaign. `JournalEntry`: `id`, `kind` (`npc|place|faction|event|fact`), `name`, `summary` (description or detail, empty string if none), `session` (1-based ordinal of the Session of `created_session_id`), NPC-only `role`, `status`, `stance` (toward the viewing Character), `knows` (titles of live facts known), `chip`. Story order: by Session ordinal, then by `created_seq`; ties keep kind order (NPCs, facts, places, factions, events).
- Chips: marker position is (Session ordinal, `seq`) of `journal_marker` for (Campaign, Character), compared as `ordinal * 1e9 + seq`; no marker means 0. `created` after marker gives `{type: "new"}`; else `changed` after marker gives `{type: "updated", what}`. NPC `what` is a comma list of `stance` (disposition changed after the marker) and `description` (alive) or `status` (not alive); other kinds have `what` null. NPC "changed" position is the later of the NPC's and its disposition's. Labels: `New`, `Updated: <what>` or `Updated`.
- `unseen` = number of entries with a chip. `through` = the latest position among all entries' changed positions.
- Marker writes: `markSeen(campaignId, characterId, through?)` upserts `journal_marker`, never moves backwards, ignores a Session not in the Campaign. Triggered by the session page's `?/journalSeen` form action when the overlay closes (posting `sessionId` and `seq` of `through`, silently ignoring failure).
- Delivery: the session page's `load` returned `journal: journal.view(...)` for the Session's Character. Opening the overlay called `invalidateAll()` first so recent extraction shows.
- UI: header button `Journal`, or `Journal · N new` when `unseen > 0` (`JournalButton.svelte`). `JournalOverlay.svelte`: modal dialog (`aria-label="Journal"`), Escape closes, index of `Everything (n)`, People, Places, Factions, Events, Facts with counts, entries grouped by Session newest first (heading `Session N`, plus ` · latest` on the highest), each entry name, meta line (kind label, role, status, stance), chip, summary and `Knows: a; b`. Empty state: "A blank page. Everything the Dungeon Master tells you of this world that matters gets written here."
- No Journal write path other than the marker.

## 8. Arc Beat-progress and steering

### 8.1 State and transitions

- `arc_beat.state`: `pending` (default), `reached`, `abandoned`; leaves `pending` once (UPDATE guarded by `state = 'pending'`), stamping `source_session_id` and `source_turn_seq`. No transition back.
- `arcs.openBeats(campaignId)`: only for an accepted Arc; the pending Beats of the current Act (the Act of the first Act containing a pending Beat) and of the next Act; empty when no Arc, a draft, or no pending Beat remains. Each: `{id, title, description, act}`.
- `arcs.transitionBeat(beatId, state, {sessionId, seq})` returned false when the Beat was not pending.
- Extraction side (section 4): `beats` items `{id, state}`; cap 3; `state` must be `reached` or `abandoned`; `id` must be in the set of Beats open at the start of the application (a Beat made reachable by another transition in the same call stays out of reach until the next call); the Beat must still be pending; without an Arc (or `beats` dependency) every Beat proposal is rejected. Prompt text: use `reached` "only when the transcript clearly establishes the Beat's outcome as having happened, never when it is only foreshadowed or attempted"; `abandoned` "only when the story made the Beat impossible or irrelevant"; at most 3; never for a Beat not listed. Beat lines are listed in the extraction user message as `- [<id>] <title>: <description>`.

### 8.2 Steering in the DM context (`old:src/lib/server/arc/context.ts`)

- Only an accepted Arc produced a block. The DM saw the current Act only (first Act with a pending Beat), never the whole outline.
- Block contents: header "The story plan (the Campaign Arc), for your eyes only:", two guidance lines (a private plan to steer by gently, not a script; Beats are outcomes not scenes; never announce a Beat or mention the plan; the player may ignore it), `Title`, `Premise`, `Stakes`, `Current Act: <name>: <purpose>`, `Open Beats:` (pending Beats of that Act), `Already happened:` (titles of all reached Beats), `Next Act begins with:` (first Beat title of the next Act), and, in the last Act, the resolution as "the intended ending, not a Beat". When every Beat was reached or abandoned, the block said the planned resolution is now in play and gave it.
- Drift hint: `ARC_DRIFT_TURNS = 15`. `countQuietTurns` counted DM turns across the Campaign's Sessions (in order) after the latest Beat transition stamp (Session index, then seq); with no transition yet, every DM turn counted. At 15 or more, the block added an advisory line offering to gently hook the player toward an open Beat, "do not railroad".
- Steering was prompt guidance only; no code enforced Beat order.

### 8.3 UI and locking (before `8d0c1d3`)

- Campaign page: `ArcSection.svelte` showed a badge per Beat once a Session had started: `Pending`, `Abandoned`, or `Reached in Session N` (`sessionNumber` computed in the Campaign page `load` from `source_session_id`), and an alert "Arc complete. Every Beat has been reached or abandoned." when an accepted Arc had no pending Beat and structure was locked.
- Lock: once any Session existed, Generate/Regenerate was unavailable (`ArcLockedError`) and Act/Beat structure was locked (`structureLocked`); only text could be edited, and edits preserved Beat ids and state.

### 8.4 What changed for the Arc in `8d0c1d3`

`arc_beat` state columns, `openBeats`, `transitionBeat`, the Arc context module, Beat badges, the "Arc complete" alert, the post-Session lock and `arcAvailability.structureLocked` were removed. Glossary now says the Arc may be edited, structure included, until the Campaign or World is archived, and that "The Director does not read it yet."

## 9. What survives in the current schema and code (`HEAD` = `8d0c1d3`)

### 9.1 Schema (`src/lib/server/db/schema.ts`, migrations 0010/0011)

- `session`: `id`, `campaign_id` (cascade), `character_id` (restrict), `started_at`, `ended_at`; partial unique index `session_one_open_per_campaign` on `campaign_id WHERE ended_at IS NULL`. No summary, watermark or memory columns.
- `session_scene` (one row per Session, pk `session_id`): `location_name`, `location_description`, `exits` (json `{id, name}[]`), `objects` (json `string[]`), `npcs` (json `{id, name, attitude, knowledge}[]`), `mode` (`exploration|dialogue`, CHECK), `dialogue_npc_id`, `pending_roll` (json `{check, dc, reason}`), `updated_at`.
- `session_event`: `id`, `session_id` (cascade), `seq` (unique with session), `role` (`player|director|narrator|npc|code`, CHECK), `kind` (`player-action|narration|npc-line|roll-requested|roll-resolved|scene-changed|mode-changed`, CHECK), `text`, `npc_id`, `data` (json), `created_at`. Event `npc_id` is a plain text column, not a foreign key.
- `arc`, `arc_act`, `arc_beat` (`id`, `act_id`, `position`, `title`, `description`) with their ids intact: `0010` copied the existing `arc_beat` rows' id, act, position, title and description. Beat state and source stamps are gone.
- Unchanged and present: `campaign`, `world` and the world/campaign link tables, `character`, `campaign_character` (links a Character to a Campaign; the link service moved to `campaign/service.ts`).
- Not present anywhere: any table or column for summary text, World memory records, NPC dispositions, NPC-knows-fact links, retired/superseded state, Journal marker, or Beat state. Wiped data is not recoverable (ADR 0003; `0010` drops the tables).

### 9.2 Code

- Scene NPC fields (`src/lib/session/enums.ts`): `id`, `name`, `attitude` (`hostile|wary|neutral|friendly`; the old `allied` stance has no counterpart), `knowledge` (short note, only that NPC's voice sees it). Scene exits and NPC ids are stable ids named by Director menu options (`move:<id>`, `npc-speaks:<id>`).
- `src/lib/server/session/service.ts`: `start()` inserts a `session` row and a `session_scene` row from `seedScene()` called with no argument; no summary or memory is read at start. `seed.ts` holds a hard-coded tavern (`The Sleeping Griffin`, NPCs `marta` and `old-tobb`, exits `front-door`, `cellar-stairs`) and an optional `firstLocation` parameter that no caller passes. `scene-director/places.ts` holds known destinations by exit id.
- `src/lib/server/session/scene-runner.ts`: pipeline context is `{sessionId, sessions, port, signal}`; the pipeline has no Campaign, World, Arc or memory input. `scene-director/prompt.ts` `recentLines(events)` renders the Event log as `Player: ...` / `<role>: ...` lines.
- `src/lib/server/ai/port.ts`: `callModel` (structured output; one attempt, failure typed), `streamText`, `collectText`, and new `callText` (returns text or failure) remain; `src/lib/server/ai/tokens.ts` `estimateTokens` (ceil(chars/3)) and `DEFAULT_CONTEXT_LIMIT = 4096` remain. `docs/ai-context-and-usage.md` documents context limit probing.
- Arc: `src/lib/arc/arc.ts` size ranges per Length (one-shot 1 Act / 3-4 Beats; short 3 / 5-8; medium 3-4 / 9-14; long 4-5 / 14-20), generated Acts 2-4 Beats each, text caps (title 120, premise 600, stakes 600, actName 80, purpose 200, beatTitle 120, beatDescription 400, resolution 600) and `arcProblems`; `src/lib/server/arc/generate.ts` (structured call, one retry naming the problem, 180 s deadline, 3500 max tokens) and `src/lib/server/arc/service.ts` (`get`, `save`, `replaceWithDraft`, `availability`) are present and unchanged in behavior except the removals in 8.4. The Arc generation prompt was not touched by `8d0c1d3`.
- `src/lib/server/character/service.ts`: a Character that has played any Session still cannot be deleted.
- Glossary (`GLOSSARY.md`): **World memory**, **NPC memory** and **Journal** remain as entries marked "(planned, not built yet)"; **NPC** remains; the rolling summary and recap have no entry. **Scene**, **Mode**, **Director**, **Event log** are defined. **Beat** no longer lists "Scene" under _Avoid_; **Scene** states it is not a Beat.
- UI present: `SceneStatePanel.svelte`, `StoryLog.svelte`, `EventInspector.svelte` (dev only), `RollOverlay.svelte`. No Journal button or overlay, no recap block, no Beat badges.
- Tests: the deleted specs (`turn-runner-memory.spec.ts`, `turn-runner-beats.spec.ts`, `turn-runner-arc.spec.ts`, `journal.spec.ts`, memory `context.spec.ts`, `recap.spec.ts`, `JournalOverlay.svelte.spec.ts`, `session-journal.e2e.ts`, `arc-progress.e2e.ts`, `session-resume.e2e.ts`) are recoverable from `git show 8d0c1d3^:<path>`.

## 10. Documented intent (ADRs and glossary)

- ADR 0002 (accepted, implemented in #189, superseded by 0003): memory written only after a saved DM turn by a silent stateless extraction call; the model proposes deltas, code validates ids, enums, lengths, referential integrity, per-call caps and exact-name duplicates and drops each invalid item with a log entry; `memoryThroughSeq` watermark; unparseable output dropped whole and counts as a failure; stop after a few consecutive failures; one extraction per Session; the next DM turn never waits; a new Session drains pending extraction bounded by a timeout. Consequences listed: extraction lags narration; one extra model call per DM turn; the model can miss or misjudge, only later extraction corrects memory, no player override.
- ADR 0003 (accepted, spec #200): Scenes and an Event log replace Turns; Director/Narrator/NPC voice steps; all state changes applied by code. Existing data is wiped with no legacy period. Quote: "Whether a silent extraction call is still needed for World memory is decided during implementation, not by this ADR." Its glossary consequence line: Turn, Roll request and Roll result are removed and are redefined by the tickets that need them.
- Old glossary definitions (preserved in `git show 8d0c1d3^:GLOSSARY.md`): World memory as the structured, Campaign-scoped record of NPCs, places, factions, events and facts, separate from the rolling summary ("where they disagree, memory wins"), records never deleted only retired, each carrying the Session and Turn it came from, nothing carries between Campaigns even in a shared World; NPC memory as a disposition (stance plus note) per NPC and Character with facts kept in World memory; Journal as above. The current glossary rewrites these as planned and replaces "Turn" with "event" in provenance.
