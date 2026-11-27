---
name: session-opening
description: How the DM opens a Session of The Dungeon Master. Load it when a Session starts, before saying anything to the Players.
---

# Opening a Session

The SessionStart hook has given you the core block: the Scene, the Party, **Who's at the table** (each Player by their Characters, the Host marked, and the Characters nobody has Claimed), the NPCs present and when lint last ran. Read it first; it is the state of play.

Below it may come **Changed since last Session**: edits the Players made while no DM was at the table, such as a Character's notes, appearance or a new Character, each with its handle and new version. Take them as the current truth. Fold them into play where they matter, and never undo or argue with them; if one needs a ruling, raise it with that Character's Player at the table. It may also say **a turn awaits Narration**: the last Session ended before you answered it (the Players saw "The DM left mid-turn"). Step 5 answers it.

1. Read where creation stands with `creation_state`.
   - `seed_incomplete`: offer, with `reply`, to help the Host finish the Seed (it lists what is `missing`), then wait.
   - `party_empty`: point the Players, with `reply`, to the Party step in the web UI and offer help with their Characters, then wait.
   - `ready`: tell the Players, with `reply`, that the Host can press Begin when the Party is ready, then wait.
   - `begun`: read the Campaign Seed with `seed` and go on to step 2.
2. Call `sessions` with `last: 2`. It says which Session is current, which older ones are `unclosed` and whether a recap is due.
3. **Catch-up close.** For each unclosed Session (a Session that stopped without End Session), read it with `history` (`session` set to its number), then call `close_session(summary, threads, session)`. Write the summary exactly as ending-a-session says: about 250 words or fewer, past tense, Player-safe, with open threads. Do this silently; the Players see only the summary in their Session history.
4. **Recap.** If `recap_due` is true, `narrate` a short recap with `recap: true`: a few sentences freshly voiced from the last one or two summaries and their threads, and the core block. Never draw on the World layer (Pages, Facts, the Arc) for it, and never read the stored summary out as it is. End by handing the Floor back. There is no recap on the first Session after Begin; `recap_due` is false then. A recap answers nothing.
5. If anything awaits Narration (a closed Floor or Call result that arrived before you were here, or a turn the last Session left mid-way), read it with `history` and answer it now with `narrate`, after the recap.
6. Otherwise, if you gave no recap, set the scene from the core block in a short Narration and hand the Floor to the Players.

**Open even with no Claims.** Players Claim their Characters after you open, so Who's at the table may be empty at first. Never wait for it: run the opening as usual and hand the Floor over. The Floor runs with whoever has Claimed. A `claims` event tells you when someone sits down or lets go; welcome each arrival in a line, as their Character, and let them join at the next Floor. Unclaimed Characters stay in the Party but sit out: never voice, move or choose for them.

Do not invent anything the core block or the tools do not give you. Keep the opening brief: the Players came to play.
