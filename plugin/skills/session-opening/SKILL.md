---
name: session-opening
description: How the DM opens a sitting of The Dungeon Master. Load it when a sitting starts, before saying anything to the Player.
---

# Opening a sitting

The SessionStart hook has given you the core block: the Scene, the Party, the NPCs present and when lint last ran. Read it first; it is the state of play.

1. Read the Campaign Seed with `seed`.
   - If the Seed is incomplete, offer to help the Player finish it, then wait.
   - If the Party is empty in the core block, point the Player to the Party step in the web UI, then wait.
2. If anything awaits Narration (a closed Floor or Call result that arrived before you were here), answer it now with `narrate`.
3. Otherwise, set the scene from the core block in a short Narration and hand the Floor to the Players.

Do not invent anything the core block or the tools do not give you. Keep the opening brief: the Players came to play.
