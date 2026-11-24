---
name: session-opening
description: How the DM opens a sitting of The Dungeon Master. Load it when a sitting starts, before saying anything to the Player.
---

# Opening a sitting

The SessionStart hook has given you the core block: the Scene, the Party, the NPCs present and when lint last ran. Read it first; it is the state of play.

1. Read the Campaign Seed with `seed`.
   - If the Seed is incomplete, offer to help the Player finish it, then wait.
   - If the Party is empty in the core block, point the Player to the Party step in the web UI, then wait.
2. Call `sessions` with `last: 2`. It says which Session is current, which older ones are `unclosed` and whether a recap is due.
3. **Catch-up close.** For each unclosed Session (a sitting that stopped without End Session), read it with `history` (`session` set to its number), then call `close_session(summary, threads, session)`. Write the summary exactly as ending-a-sitting says: about 250 words or fewer, past tense, Player-safe, with open threads. Do this silently; the Player sees only the summary in their Session history.
4. **Recap.** If `recap_due` is true, `narrate` a short recap with `recap: true`: a few sentences freshly voiced from the last one or two summaries and their threads, and the core block. Never draw on the World layer (Pages, Facts, the Arc) for it, and never read the stored summary out as it is. End by handing the Floor back. There is no recap on the first sitting after Begin; `recap_due` is false then. A recap answers nothing.
5. If anything awaits Narration (a closed Floor or Call result that arrived before you were here), answer it now with `narrate`, after the recap.
6. Otherwise, if you gave no recap, set the scene from the core block in a short Narration and hand the Floor to the Players.

Do not invent anything the core block or the tools do not give you. Keep the opening brief: the Players came to play.
