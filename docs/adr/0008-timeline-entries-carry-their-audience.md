# Timeline entries carry their audience

Status: accepted (Map: Multiplayer, #373). Extends ADR 0007's rule that visibility is data from Beliefs to the Timeline itself.

## Context

With several Players at one table, each browser must see only what its own Characters witnessed. Today a Timeline entry (a Narration, Declaration, Call, roll, answer, `⚙ DM` line or error) is either shown to the Player or marked DM-only, and a Session has a single summary. A split Party breaks that: the Characters at the docks and the Characters at the inn must not read each other's play. Players have no record of their own; a browser is known only by the Characters it has Claimed.

## Decision

Every Timeline entry and every Session summary carries an **Audience**: a set of Characters, stored on the entry when it is written and never recomputed. A browser sees an entry when its Audience includes any Character the browser has Claimed. A Character's history comes with its Claim, and the Host's browser has no all-seeing view.

- **Default.** Code sets the Audience to the Characters in the Scene at the moment the entry is written. A spotlight change in a split Party only changes who the default resolves to; no entry is ever re-addressed.
- **Narration.** `narrate` takes an optional `to` (Character handles, or `party`) that replaces the default outright. An empty list is refused, as is anything that isn't a Party Character. A Recap is a Narration: with the Party split, the DM writes one per group.
- **Declarations** take the default as their Floor closes. The DM cannot re-address them.
- **Calls** take the Audience of the Narration that raises them, or the default when a tool opens them. Their rolls, NPC dice-log rolls and answers inherit it. An Audience that leaves out a Character the Call asks is refused, so a secret Check is a narrowed Narration with a Call.
- **`⚙ DM` lines and turn errors** take the default when written.
- **Session summaries.** A Session has one or more summaries, each with its own Audience and open threads. Together they must reach every Character in any entry's Audience that Session, or End Session is refused. A Session played together has one.
- **Reveals stay independent.** Hearing prose and learning a Belief are separate acts with the same default. `lint` may flag a Reveal to a Character outside that turn's Narration Audience, as a hint, never a refusal.
- **Existing entries** are given the Party Characters that existed when each was created.

## Considered options

- **Audience per Player or per browser.** Players have no identity, and a Claim can pass between browsers. Keying on Characters makes the audience part of the fiction and lets a newly Claimed Character bring its past with it.
- **Recompute from Scene history on read.** It saves a column but makes every read depend on reconstructing who stood where, and it would re-address entries when that history is corrected.
- **Tie the Audience to the turn's closing Narration.** `⚙ DM` lines would wait or be re-addressed when the turn ends, which breaks write-time Audiences.
- **Narration Audience bound to Reveal Holders** (inline Reveals, or Reveals required to stay within the Audience). It breaks Reveals to NPCs and to Characters elsewhere, and blurs who owns a Belief.
- **One shared Session summary.** Limited to what every Character knows, it loses most of a split Session. One summary per Character costs a write per Character even when everyone played together.

## Consequences

- A wrongly addressed Narration is a DM judgment error in the fiction, not World-layer data leaking: the Player-visible payload is still built only from Audiences and Beliefs, and tests can assert that an entry never reaches a browser outside its Audience.
- The live push to the browser has to be filtered per browser by its Claims, and re-filtered when a Claim changes.
- The DM writes more when the Party is split: a Recap and a Session summary per group.
