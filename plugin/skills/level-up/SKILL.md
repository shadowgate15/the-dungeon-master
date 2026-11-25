---
name: level-up
description: How the DM awards milestone levels in The Dungeon Master. Load it when the Party reaches a milestone worth a level, before calling award_level.
---

# Milestone levels

Levels come by milestone, never by experience points. You decide when; the Player takes the level in the web UI and the code applies everything it brings.

1. **Pick the moment.** Award a level at a milestone: the end of an Arc's Act, a Beat that changes the Party's fortunes, or a hard-won victory. Award the whole Party together unless the fiction gives a reason not to. Pace levels to the Seed's Length: a one-shot may have none.
2. **Award it** with `award_level(characters)`, listing the Characters' handles. A Character can hold more than one awarded level.
3. **Tell the Player** out of the fiction, in one short line of your Narration, that a level is waiting on each Character's sheet.
4. **Wait for the change.** The Player levels up in the UI, with or without you. You hear of it as a change ("the Player levelled … up to level …"). Re-read the Character with `party` before relying on their HP, slots, features or spells.
5. **Never level a Character yourself** and never describe what a level grants in numbers. If the Player asks what they gain, use `lookup` for the class's features and let the UI show the rest.

A level-up does not heal, rest or move time. If the Party should also rest, run the rest as its own step.
