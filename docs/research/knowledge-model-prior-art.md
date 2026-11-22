# Prior art: knowledge models for an LLM game master

Date: 2026-11-22. Ticket: #292 (parent map #288, feeds grilling ticket #293).

## Question

What approaches exist for giving an LLM game master durable knowledge of a world and story, and how do they compare? Covers an entity-relation graph exposed through MCP tools, a linked-document store (Obsidian-style markdown with wiki links), and hybrids (structured tables for mechanics plus linked narrative notes). For each approach, the questions are how the model reads and writes it, how it handles "who knows what", how it deals with consistency and contradiction, how querying scales, and how a UI can render it.

The setting is the reimagined project: Claude Code is the DM, with a large context and strong tool use, and an MCP server owns state and knowledge. Today's World memory (Places, NPCs, Facts, NPC memory, World memory selection and the Rolling summary in `GLOSSARY.md`, plus ADR 0002 and ADR 0005) was designed for a small local model with a tight budget.

## Answer

1. **Every published LLM-GM system that got more consistent did it by moving state out of the model into a tracked external store.** Free narration alone stays inconsistent even with frontier models. FIREBALL, the Labyrinth function-calling GM, ChatRPG v2's Archivist and NCP-Bench all show this (see "LLM game master prior art").
2. **Pure entity-relation graphs are what the generic agent-memory tools converged on.** Examples are the reference MCP `memory` server, the Neo4j memory server, Graphiti/Zep and AriGraph. The cheap versions (the reference server) have no time, no provenance, no visibility and only naive search. The strong versions (Graphiti) add exactly what a DM needs: bi-temporal validity, invalidation instead of deletion, and episodes linked to the facts derived from them. They pay for it with an LLM-heavy ingest pipeline. Contradiction handling needs explicit validity intervals. None of the graph tools models "who knows what".
3. **Linked markdown documents are what large-context agents handle best.** Examples are Basic Memory, Karpathy's "LLM Wiki" and Anthropic's memory tool. They are the most legible to both the model and a human, and they render for free (Obsidian graph view, backlinks). They are weak at mechanics, at enforcing invariants and at fine-grained visibility. Contradictions are found by a periodic "lint" pass, not prevented.
4. **Hybrid is what human-GM tools already do, and it fits this project's principles best.** Foundry VTT, Kanka and World Anvil use typed records with permissions plus rich linked text with inline secret blocks. Concretely: rows in SQLite for mechanics and anything code must enforce (HP, status alive/dead, location, inventory, Beat state), and linked narrative documents for lore, NPC personality and history. A typed link and visibility layer sits over both. The research on "who knows what" (ReverieMem's visibility-tagged facts, Generative Agents' per-agent memory streams, TimeChara and the NPC secret-leak papers) points to visibility as a first-class field on each knowledge item that code filters on. A prompt instruction is not enough.

## How this compares to today's World memory

Today's model is already a small typed graph:

- Place, NPC and Fact are nodes. Exits and "NPC is placed at" are edges.
- Facts are never edited, only superseded or retired, which is the same idea as Graphiti's invalidation.
- Provenance is recorded (Session and event).
- The Journal is a visibility-filtered projection for the player.

What it lacks compared with the prior art:

- Long-form narrative per entity. A Fact is a short claim, so there is no NPC page, no location page and no history.
- Per-holder knowledge. NPC memory is a stance plus a note, and the Narrator is told "never what an individual NPC knows".
- Explicit valid-time.
- Model-driven retrieval. World memory selection is a scored, budgeted push, built because the local model could not pull.

With Claude as DM, pull (search and open by link) replaces push (selection by budget). That pattern is described in Anthropic's context-engineering guidance and the memory tool docs.

## Approaches

### 1. Entity-relation graph through MCP tools

**Reference MCP `memory` server** ([modelcontextprotocol/servers, src/memory][mcp-memory])

- **Data model:** entities (`name`, `entityType`, `observations[]`), directed relations (`from`, `to`, `relationType`, "always stored in active voice") and observations (atomic strings, "one fact per observation").
- **Read and write:**
  - Writes: `create_entities`, `create_relations`, `add_observations`, `delete_entities` (cascades to relations), `delete_observations`, `delete_relations`.
  - Reads: `read_graph` (the whole graph by default), `search_nodes` (matches names, types and observation text) and `open_nodes` by name.
- **Storage:** one `memory.jsonl` file. "Every write tool reads the whole memory file, changes the graph and writes the whole file back."
- **Gaps for a DM:**
  - No timestamps, provenance or visibility.
  - Deletion is the only way to correct anything.
  - Observations are untyped strings, so "HP 12" and "fears fire" look the same.
  - Search ranking is unspecified, and results come back "in stored order".

**Neo4j memory server** ([mcp-neo4j-memory][neo4j-memory]): the same tool surface (`create_entities`, `search_nodes`, `find_nodes`, …) backed by Neo4j. It gives a real database and Cypher internally, but the model-facing tools are the same thin interface.

**Graphiti / Zep** ([Rasmussen et al. 2025, arXiv 2501.13956][zep]): the most developed graph design, and the closest to what a DM needs.

- **Three tiers:**
  - Episode subgraph: raw input stored losslessly.
  - Semantic entity subgraph: entities and fact edges extracted from episodes.
  - Community subgraph: clusters of entities with summaries.
- **Bi-temporal.** Each fact edge carries `t_valid` and `t_invalid` (when it held true in the world) and `t'_created` and `t'_expired` (when the system learned and retracted it). For a DM, the first pair is in-fiction time and the second is the Session or event.
- **Contradiction handling.** An LLM compares a new edge with semantically related existing edges. For contradictions that overlap in time, it sets the old edge's `t_invalid` to the new edge's `t_valid`, so history is kept while current state stays accurate. "Graphiti consistently prioritizes new information."
- **Entity resolution.** Embedding search plus full-text search finds candidate duplicates, and an LLM decides on merges. Edge deduplication only searches edges between the same pair of entities.
- **Retrieval.** Cosine, BM25 and breadth-first search over n hops run in parallel. The results are reranked with RRF, MMR, episode-mention frequency, node distance or a cross-encoder.
- **Results:** 94.8% on DMR against MemGPT's 93.4%, and up to 18.5% better accuracy on LongMemEval.

**AriGraph** ([Anokhin et al. 2024, arXiv 2407.04363][arigraph]): a knowledge-graph world model for LLM agents in text games (TextWorld).

- An LLM extracts (subject, relation, object) triplets each step.
- A second prompt flags outdated triplets for replacement, keeping the existing one when unsure.
- Each full observation is an episodic vertex linked to its triplets.
- Retrieval runs semantic search over triplets with BFS expansion, then scores the episodic vertices those triplets link to.
- Normalized scores against RAG and summary baselines:

| Task | AriGraph | RAG | Summary |
|---|---|---|---|
| Treasure Hunt | 1.0 | 0.33 | 0.33 |
| Cooking | 1.0 | 0.36 | 0.52 |
| Cleaning | 0.79 | 0.39 | 0.35 |

  This is the clearest evidence that a structured world graph beats both summaries and plain RAG for tracking game state.

**GraphRAG** ([Microsoft][graphrag]): offline extraction of entities, relationships and claims, Leiden community clustering and bottom-up community summaries. It has global, local and DRIFT query modes. It is built for static corpora, so it is relevant to rendering world overviews ("what are the factions?") but not to turn-by-turn updates.

**Comparison against the five questions:**

| Axis | Graph |
|---|---|
| Model read/write | Small, typed CRUD tools. The model must split narration into atoms. Easy to validate in code. |
| Who knows what | Not built into any of these tools. It can be modelled as `knows` edges (NPC → fact), or as a visibility property on edges, but each holder needs its own edges. |
| Consistency | Only as good as the update rule. The reference server has delete only. Graphiti has validity intervals plus LLM-judged invalidation. AriGraph has LLM-judged replacement. Identity (one NPC, not two "Mira"s) needs explicit entity resolution. |
| Scale | Hybrid search (BM25 + vector + graph hops) scales well. Reading the whole graph does not. |
| UI | Node-link graph views, entity cards and timelines (from validity intervals). Atomic observations read poorly as prose. |

### 2. Linked-document store (Obsidian-style)

**Basic Memory** ([basicmachines-co/basic-memory][basic-memory]): "a knowledge graph written in plain Markdown".

- Each file is an entity with frontmatter (title, type, permalink, tags).
- Observations are list items with a category, tags and context, for example `- [tip] Grind medium-fine for V60 #brewing`.
- Relations are wiki links with a type: `- pairs_well_with [[Chocolate Desserts]]`. A bare `[[Target]]` is indexed as `links_to`.
- **Tools:** `bm_write`, `bm_read`, `bm_edit`, `bm_move`, `bm_delete`, `bm_search`, `bm_list`, `bm_find`, `bm_context` (graph context) and schema tools (`bm_schema_validate`, `bm_schema_infer`, `bm_schema_diff`).
- **Indexing:** a local SQLite index with full-text plus vector (FastEmbed) ranking. "Just files plus a local SQLite index."
- Obsidian can open the same folder, and its graph view shows the links.
- This is the clearest existing example of a document store that is also a typed graph.

**Karpathy, "LLM Wiki"** ([gist, 2026-04-04][llm-wiki]): a pattern for an agent-maintained knowledge base.

- **Three layers:** immutable raw sources, an LLM-owned wiki of markdown pages, and a schema file (CLAUDE.md or AGENTS.md) defining conventions.
- **Operations:**
  - Ingest: one source "may touch 10–15 pages", and the agent notes "where new data contradicts old claims".
  - Query: the agent reads `index.md` first, then drills down.
  - Lint: periodic checks for "contradictions between pages, stale claims that newer sources have superseded".
- `log.md` is "an append-only record of what happened and when".
- **Scale:** the index-first approach "works surprisingly well at moderate scale (~100 sources, ~hundreds of pages)", and a search tool is needed beyond that.
- **Mapping to a campaign:** raw sources are the event log, the wiki is the world bible, and the schema is the DM rules.

**Anthropic memory tool** ([platform docs][memory-tool]): a client-side `/memories` directory with the commands `view`, `create`, `str_replace`, `insert`, `delete` and `rename`.

- The API injects "ALWAYS VIEW YOUR MEMORY DIRECTORY BEFORE DOING ANYTHING ELSE … ASSUME INTERRUPTION".
- It is meant to pair with compaction: "memory preserves the information that must survive summarization."
- [Effective context engineering][ctx-eng] describes the same pattern as "structured note-taking", with Claude playing Pokémon keeping progress notes across context resets. It recommends "lightweight identifiers (file paths, stored queries, web links)" loaded just in time.
- This is the first-party evidence that Claude-class models are trained and prompted to work this way.

**Obsidian** ([links help][obsidian-links]):

- Links can be wikilinks or markdown links, and can point to headings (`#`) or blocks (`#^id`).
- Linking to a note that does not exist creates it on click. This is how a DM can name a place before it is described.
- Links update automatically on rename.

**Comparison against the five questions:**

| Axis | Documents |
|---|---|
| Model read/write | Native to a large-context coding agent: read a page, edit a section, follow links. Prose holds nuance (motives, voice, history) that atoms lose. Writes are unvalidated free text unless a schema is enforced (Basic Memory's schema tools). |
| Who knows what | File or folder granularity only (for example `secrets/` versus `public/`). Inline secrets are just text, so filtering needs a parser, like Foundry's secret blocks. |
| Consistency | Nothing prevents a contradiction. They are found by lint or ingest-time review (LLM Wiki). Pages are edited in place, so history lives in git or an append-only log, not in the store. |
| Scale | An index file works up to hundreds of pages, and a full-text plus vector index is needed beyond that (Basic Memory, qmd). Link traversal gives cheap neighbourhood context. |
| UI | The best of the three: rendered markdown pages, backlinks, Obsidian-style graph view. A human can edit the same files. |

### 3. Hybrid: structured records for mechanics, linked notes for narrative

Tools built for human GMs settled on this shape.

- **Foundry VTT journals** ([Foundry docs][foundry-journal]):
  - Journal entries hold typed pages.
  - Per-user ownership has four levels: None, Limited, Observer and Owner.
  - "Show Players" shares a whole entry or one page.
  - A **Secret** text block is "visible only to the GM or the entry's Owner", with a reveal button.
  - Content links use stable IDs, `@UUID[DocumentType.ID]{Label}`, and "clicking a link opens the linked document only if the viewing user has permission to see it."
  - Mechanics (actors, items, combat) are separate typed documents, not journal text.
- **Kanka** ([permissions docs][kanka-perms]): typed entities (characters, locations, organisations, …) with permissions per role and per member, a privacy flag limiting an entry to admins, and a separate visibility setting on elements attached to an entry.
- **ChatRPG v2** ([arXiv 2502.19519, 2025][chatrpg]):
  - A Narrator agent plus an **Archivist** agent that reads the Narrator's output and records new or changed characters (name, description, type, health) and environments as JSON rows in a database. It gets the full existing world state as input, so it can decide between creating and updating.
  - The earlier version, which put the whole state in one long prompt, had drifting counts and forgotten items.
  - v2 scored significantly higher on "coherent story" (2.25 against 1.00, p = 0.040, N = 12), though the study does not isolate the Archivist's contribution.
- **Letta memory blocks** ([Letta docs][letta-blocks]): labelled, size-limited blocks pinned in context, which can be read-only and shared across agents (last write wins). Large archival memory is searched on demand. This is a useful pattern for "always in context" campaign state (current Scene, party, active quests) beside a searched store.

**Comparison against the five questions:**

| Axis | Hybrid |
|---|---|
| Model read/write | Mechanics through typed, validated tools (the project principle that "the LLM never invents numbers"). Narrative through document tools. Links tie the two together, for example an NPC row id inside an NPC page. |
| Who knows what | The best fit. Visibility is a field on rows, links and secret blocks, and code filters what the player UI shows and what an NPC "knows" (Foundry's pattern, and ReverieMem's below). |
| Consistency | Invariants (dead stays dead, HP, location) are enforced by code on rows. Narrative contradictions are linted. Supersession and validity can live on rows and on fact or claim items. |
| Scale | SQL for mechanics, full-text plus vector plus links for narrative. Both are local-first on SQLite (Basic Memory shows the pattern). |
| UI | A typed side panel (character sheet, combat tracker, NPC card) plus rendered notes with backlinks and a graph view, each filtered by viewer. |

Cost: two models to keep in sync. Anything that exists both as a row and as a page (an NPC) needs one owner per field, or the two drift.

### 4. Related: keyword-triggered lorebooks and agent memory streams

These are less relevant with a large context, but they are where most hobby LLM-RPG practice lives.

- **SillyTavern World Info** ([docs][st-worldinfo]):
  - Entries are injected when trigger keys appear within a scan depth of recent messages.
  - Entries can trigger other entries recursively.
  - Entries can be constant (always inserted) or vectorized (inserted by embedding similarity).
  - A token budget applies, with constant entries first, and "inclusion groups" where only one entry of a group is inserted.
- **AI Dungeon Story Cards** ([help][aid-cards]):
  - A card's entry is injected when one of its triggers appears in input or output.
  - "The AI doesn't know cards exist."
  - Cards are among the first things dropped when the context fills.
  - "Contains spoilers" hides a card from the scenario page but "does not stop the AI from using the card", which is a visibility gap.
- **Generative Agents** ([Park et al. 2023, arXiv 2304.03442][gen-agents]):
  - Each agent has its own natural-language memory stream.
  - Retrieval is a weighted sum of recency (decay 0.995 per game hour), LLM-rated importance (1–10) and embedding relevance.
  - Reflections are synthesized when summed importance passes 150, and they cite the memories they came from.
  - Because memory belongs to each agent, information spread can be measured. Knowledge of the party went from 4% to 52% of agents over two days, with no hallucinated knowledge on check.
  - There was embellishment: one agent added an announcement that never happened. About 1.3% of relationship claims were hallucinated.
  - This is the canonical "who knows what" design: each holder has a log, rather than a shared fact table with tags.

## Who knows what: the specific evidence

- **ReverieMem** ([Tang et al. 2026, arXiv 2606.25632][reveriemem]):
  - Three layers: episodic (first-person scenes the character experienced), semantic (facts **tagged with visibility**) and personality.
  - It targets "Factual Overreach", where shared retrieval or parametric memory lets a character use facts outside its perspective.
  - Knowledge Boundary Fidelity is up 34.6 points over the strongest of six baselines on KBF-QA (4,386 questions).
  - The abstract does not say how the tags are enforced.
- **TimeChara** ([arXiv 2405.18027][timechara]): characters answer with knowledge they should not have yet, and this persists in GPT-4o. Prompting a character with its own boundary is not enough.
- **Tricking LLM-Based NPCs into Spilling Secrets** ([arXiv 2508.19288][npc-secrets]): prompt injection can make LLM NPCs reveal hidden background secrets. Whatever is in context can leak.

Implication for this project:

- The DM (Claude) legitimately knows everything, so the risk is not the DM knowing a secret. The risks are the DM voicing an NPC with knowledge that NPC lacks, and the player UI showing what the Character has not learned.
- Both are best served by visibility as data: per item, a holder set or "known by" links, plus a "revealed to player" marker. Code filters on it for the Journal. A per-NPC view the DM fetches before voicing them ("what does Mira know?") replaces prompt rules.

## LLM game master prior art

- **FIREBALL** ([Zhu et al. 2023, arXiv 2305.01528][fireball]): nearly 25,000 sessions of real D&D play through the Avrae Discord bot, with true game state. Adding Avrae state information improves generated turns, by automated metrics and human judgment.
- **Labyrinth function-calling GM** ([Song, Zhu, Callison-Burch, Wordplay @ ACL 2024, arXiv 2409.06949][labyrinth]): game-specific controls exposed as functions improve narrative quality and consistency of state updates, by human evaluation and unit tests.
- **PAYADOR** ([Góngora et al. 2025, arXiv 2504.07304][payador]): grounds the LLM in a *minimal* structured world representation and predicts the outcomes of actions instead of enumerating actions. This argues for keeping the enforced core small.
- **NCP-Bench** ([arXiv 2608.08160, ICML 2026][ncp-bench]):
  - Narrative Commitment Preservation measured over 100 environments.
  - The best model (GPT-5.2) keeps its commitments in only 42% of runs after 20 turns.
  - Fact-conflict rates are 40–68%.
  - "High linguistic quality does not guarantee commitment preservation."
  - This is strong evidence that a large context alone does not make a model consistent.
- **ChatRPG v2 Archivist** (above): a separate background agent writing world state.

## Implications for the grilling ticket (#293)

Questions the grilling should settle, with the prior art that bears on each:

1. **Source of truth per field.** Code-enforced mechanics (HP, alive/dead, location, inventory, Beat state) stay in SQLite rows, as every successful GM system and the project's principles require. The open question is whether narrative lore is rows (graph) or pages (documents). The evidence favours pages for prose, held by a store that also indexes typed links (Basic Memory's model).
2. **Contradiction policy.** Choose between append-only with supersession and validity (today's Fact, Graphiti) and edit-in-place with history in git or the log (LLM Wiki). Graphiti's split of world time from system time maps cleanly onto in-fiction time and Session/event provenance.
3. **Visibility model.** Choose between one "known by" relation used for both NPCs and the player Character (Generative Agents and ReverieMem style) and secret blocks inside pages (Foundry style). The UI and the DM both need the same filter.
4. **Read path.** With Claude as DM, retrieval moves from code-scored push (World memory selection) to pull through tools (search, open, follow link). Keep a small always-in-context block (Letta core memory, CLAUDE.md-style) for the current Scene and party.
5. **Write path.** Choose between inline DM tool calls and a background Archivist pass (ChatRPG, ADR 0002's post-turn extraction). With strong tool use, inline is viable. A periodic lint pass (LLM Wiki) still catches drift.

## Sources

Primary sources fetched for this note. Several papers were read from the arXiv abstract only, and this is noted in the text where it matters.

- [mcp-memory]: https://github.com/modelcontextprotocol/servers/tree/main/src/memory
- [neo4j-memory]: https://github.com/neo4j-contrib/mcp-neo4j/tree/main/servers/mcp-neo4j-memory
- [zep]: https://arxiv.org/abs/2501.13956 (full text: https://arxiv.org/html/2501.13956)
- [arigraph]: https://arxiv.org/abs/2407.04363
- [graphrag]: https://microsoft.github.io/graphrag/
- [basic-memory]: https://github.com/basicmachines-co/basic-memory
- [llm-wiki]: https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f
- [memory-tool]: https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool
- [ctx-eng]: https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- [obsidian-links]: https://obsidian.md/help/links
- [foundry-journal]: https://foundryvtt.com/article/journal/
- [kanka-perms]: https://docs.kanka.io/en/latest/features/permissions.html
- [chatrpg]: https://arxiv.org/abs/2502.19519
- [letta-blocks]: https://docs.letta.com/guides/agents/memory-blocks
- [st-worldinfo]: https://docs.sillytavern.app/usage/core-concepts/worldinfo/
- [aid-cards]: https://help.aidungeon.com/faq/story-cards
- [gen-agents]: https://arxiv.org/abs/2304.03442
- [reveriemem]: https://arxiv.org/abs/2606.25632
- [timechara]: https://arxiv.org/abs/2405.18027
- [npc-secrets]: https://arxiv.org/abs/2508.19288
- [fireball]: https://arxiv.org/abs/2305.01528
- [labyrinth]: https://arxiv.org/abs/2409.06949
- [payador]: https://arxiv.org/abs/2504.07304
- [ncp-bench]: https://arxiv.org/abs/2608.08160

Secondary index used only to find papers: Arcanum AI RPG Research Index, https://arcanumrpgs.com/research/

[mcp-memory]: https://github.com/modelcontextprotocol/servers/tree/main/src/memory
[neo4j-memory]: https://github.com/neo4j-contrib/mcp-neo4j/tree/main/servers/mcp-neo4j-memory
[zep]: https://arxiv.org/abs/2501.13956
[arigraph]: https://arxiv.org/abs/2407.04363
[graphrag]: https://microsoft.github.io/graphrag/
[basic-memory]: https://github.com/basicmachines-co/basic-memory
[llm-wiki]: https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f
[memory-tool]: https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool
[ctx-eng]: https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
[obsidian-links]: https://obsidian.md/help/links
[foundry-journal]: https://foundryvtt.com/article/journal/
[kanka-perms]: https://docs.kanka.io/en/latest/features/permissions.html
[chatrpg]: https://arxiv.org/abs/2502.19519
[letta-blocks]: https://docs.letta.com/guides/agents/memory-blocks
[st-worldinfo]: https://docs.sillytavern.app/usage/core-concepts/worldinfo/
[aid-cards]: https://help.aidungeon.com/faq/story-cards
[gen-agents]: https://arxiv.org/abs/2304.03442
[reveriemem]: https://arxiv.org/abs/2606.25632
[timechara]: https://arxiv.org/abs/2405.18027
[npc-secrets]: https://arxiv.org/abs/2508.19288
[fireball]: https://arxiv.org/abs/2305.01528
[labyrinth]: https://arxiv.org/abs/2409.06949
[payador]: https://arxiv.org/abs/2504.07304
[ncp-bench]: https://arxiv.org/abs/2608.08160
