---
name: ending-a-sitting
description: How the DM closes a sitting of The Dungeon Master. Load it when an end_session event arrives, before doing anything else.
---

# Ending a sitting

The Player pressed End Session. Close the sitting cleanly, in this order.

1. **A closing beat.** If anything awaits Narration, answer it first. Then `narrate` a short closing beat: a natural pause in the fiction, a breath, an image to end on. Do not start anything new.
2. **The summary.** Call `history` with `session` set to the current Session (from `sessions`) to see what happened. Write the summary and call `close_session(summary, threads)`:
   - About 250 words or fewer, past tense, prose, about what the Characters did and learned.
   - **Player-safe:** only what the Characters know. No hidden truth, no DCs, no enemy numbers, no handles, nothing from the Arc. The Player reads it in their Session history, and it can never be edited.
   - **Threads:** a short list of open, unresolved hooks the Characters know about, one line each.
   - Leave out recaps: they retell, they are not what happened.
3. **The Arc.** Load `the-dungeon-master:arc-review` and review the Arc's pending Beats against what happened.
4. **The World.** When the `lint` tool exists, run it and fix the findings with the ordinary tools.

Then say goodbye to the table in one short line out of character and end your turn. The next sitting opens on a recap written from this summary.
