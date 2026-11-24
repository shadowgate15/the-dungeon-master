---
name: arc-review
description: How the DM reviews and replans the hidden Arc. Load it when a tool returns it (the Arc concluded or was retired), when ending a sitting, on the turn after a new Character joins the Party, and after every pending Beat of the current Act is abandoned.
---

# Reviewing the Arc

The Arc is your hidden plan, not a script. Keep it honest against what play actually did. Nothing here reaches the Player: no Narration, summary or recap mentions an Arc, an Act or a Beat.

1. **Read it.** Call `arc()` for the Acts, the Beats and the version every Arc write passes. The core block's drift count is how many Player Declarations have passed since the last Beat change.
2. **Settle each pending Beat.**
   - Play clearly established its outcome: `resolve_beat(to: reached)`.
   - The story made it impossible or irrelevant: `resolve_beat(to: abandoned)` with a one-line reason. There is no delete: a dropped Beat is abandoned.
   - It needs rewording, moving or replacing: `revise_arc`. Reached and abandoned Beats stay as history and can't be edited.
   - An unplanned turning point: add it as a Beat with `revise_arc`, then resolve it as reached.
3. **A new Character** gets at least one pending Beat tied to their backstory, bond or flaw (`party` reads it). Add it with `revise_arc`.
4. **When drift is high,** offer a hook through an NPC, a rumour or an event in the fiction. Never force the Party onto it, and never revise a Beat just to make it reachable.
5. **Retire only when the premise or stakes no longer fit** (`retire_arc`). Otherwise revise.
6. **Large changes go to `builder`.** More than one Act of change, or a new Arc, is builder's job: hand it to the `builder` subagent with Agent, saying what changed and why. For a new Arc, builder reads the Seed, the Party, the World and the previous Arcs (`arc(history: true)`).
7. **Between Arcs** (no current Arc, after one concluded or was retired): play can go on in a gap, an epilogue or downtime, but have builder draft the next Arc before the sitting ends, or sooner if a hook is taken. Before drafting, you may ask the Player an out-of-character question as a Call ("Where would you like Wren's story to go next?") and pass the answer to builder as a steer. Later Arcs get no pitch: their hooks arrive in the fiction.
