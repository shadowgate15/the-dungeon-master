# Timeline entries carry their audience

Status: accepted (Map: Multiplayer, #373, revised by #379). Extends ADR 0007's rule that visibility is data from Beliefs to the Timeline itself.

## Context

With several Players at one table, the Timeline needs a way to keep a few entries from some of them. Today a Timeline entry (a Narration, Declaration, Call, roll, answer, `⚙ DM` line or error) is either shown to the Player or marked DM-only, and a Session has a single summary. Players have no record of their own: a browser is known only by the Characters it has Claimed.

At a real table everyone hears everything, a split Party included, and the Players play as if their Characters don't know. Secrecy is the exception: the DM passes a note. What a Character _knows_ is already tracked apart from what its Player reads, as Beliefs (ADR 0007).

## Decision

Every Timeline entry and every Session summary carries an **Audience**: a set of Characters, stored on the entry when it is written and never recomputed. A browser sees an entry when its Audience includes any Character the browser has Claimed. A Character's history comes with its Claim, and the Host's browser has no all-seeing view.

- **Default.** Code sets the Audience to the Party's Characters at the moment the entry is written. A split Party still reads one shared Timeline. A Character who joins the Party later is not added to earlier entries.
- **Narration.** `narrate` takes an optional `to` (Character handles) that replaces the default outright: a **passed note**. An empty list is refused, as is anything that isn't a Party Character.
- **Declarations** and **`⚙ DM` lines and turn errors** take the default.
- **Calls** take the Audience of the Narration that raises them, or the default when a tool opens them. Their rolls, NPC dice-log rolls and answers inherit it. An Audience that leaves out a Character the Call asks is refused, so a secret Check is a passed note with a Call.
- **Recap and Session summary.** A Session has one Recap and at most one Session summary, both with the default Audience. The DM keeps the content of passed notes out of them (skill guidance, not code). That content survives as the Beliefs of the Characters it was passed to.
- **Reveals stay independent.** Reading prose is not learning it. A Reveal's default Holders stay the Characters in the Scene, not the Party, so Tam does not believe what Kira found in the vault even though Tam's Player read it. `lint` may flag a Reveal to a Character outside that turn's Narration Audience, as a hint, never a refusal.
- **Where it is enforced.** Only the read endpoints apply Audiences. The live push stays one content-free broadcast of invalidations to every browser and is never narrowed. A browser refetches through the filtered reads, and a Claim change is one more broadcast that makes every browser refetch.
- **Existing entries** are given the Party Characters that existed when each was created.

## Considered options

- **Default to the Characters in the Scene.** Each half of a split Party reads only its own play: one Recap and one Session summary per group, and End Session refused until the summaries reach everyone. It is more secrecy than a table has, and it costs the DM a write per group.
- **No Audience at all, only a label.** It leaves the DM no way to pass a note.
- **Audience per Player or per browser.** Players have no identity, and a Claim can pass between browsers. Keying on Characters lets a newly Claimed Character bring its notes with it.
- **Recompute from Scene history on read.** It saves a column but makes every read depend on reconstructing who stood where, and it would re-address entries when that history is corrected.
- **Narration Audience bound to Reveal Holders.** It breaks Reveals to NPCs and to Characters elsewhere, and blurs who owns a Belief.
- **Filter the live push per browser by its Claims.** It would put a second copy of the visibility rules in the stream and re-filter on every Claim change. The stream carries no content, so filtering it hides nothing the reads don't already hide.

## Consequences

- A wrongly addressed note is a DM judgment error in the fiction, not World-layer data leaking: the Player-visible payload is still built only from Audiences and Beliefs.
- Tests assert at the read endpoints that a passed note never reaches a browser outside its Audience, and that no live message carries content.
- A browser can tell from an invalidation that _something_ changed even when the change was a note it can't read. This is accepted.
- Players read play their Characters didn't witness and are trusted not to act on it, as at a table.
