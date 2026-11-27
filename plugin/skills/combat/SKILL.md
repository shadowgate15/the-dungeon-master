---
name: combat
description: How the DM runs a Combat in The Dungeon Master. start_combat tells you to load it; load it before you narrate the fight's first beat.
---

# Running a Combat

A Combat is stored: code keeps the initiative order, whose turn it is and the round. Code owns every number (initiative, to-hit, damage, HP, AC, conditions). You own the fiction: position, range, cover, reach, what the enemies want and how they fight. There is no grid; judge distances from the scene you have described.

## Starting

1. Decide who fights. Characters and NPCs go in by handle (an NPC needs a `stat_block` field first). Faceless foes go in as Creatures from a stat block: `{monster: "monster:goblin", count: 3}`. Find the slug with `lookup`.
2. Decide who is surprised, if anyone: those who didn't notice the threat in time. Pass their handles as `surprised`. Code makes them lose their first turn.
3. Call `start_combat`. Code rolls NPC and Creature initiative into the dice log and gives you the Creatures' handles (`creature:goblin-2`).
4. Attach the Party's initiative Call to your closing Narration: `narrate(text, call: <pending_call>)`. Set the scene in a few lines and end your turn. Its `call_result` gives you the order and whose turn it is.

## Each turn

- **A Character's turn.** The Player's composer is locked to that Character. Wait for their Declaration, resolve it with the action tools (attach any pending Call with your Narration), then call `next_turn`.
- **An NPC's or Creature's turn.** Run it yourself, inside the same turn you are already taking: choose what it does, call `attack`, `cast` or `force_save` (they roll at once), narrate the result briefly, then `next_turn`. Run consecutive enemy turns together until a Character is up, then hand them the Floor in one Narration.
- **An unclaimed Character's turn** (no Player holds it). `next_turn` passes it and says so in `notes`; code makes its rolls, including its initiative and any Death save. Narrate it holding its ground and never choose for it. If a Player Claims it before its turn comes, that Player plays the turn.
- `next_turn` freshens the new combatant's action, bonus action and reaction. If a tool reminds you something was already spent, decide whether the fiction allows it. It is a reminder, not a rule code enforces.
- A late arrival joins with `add_combatant`. A Character gets an initiative Call; attach it like the first one.

## Dropping, concentration and reactions

Code applies these rules. Your part is to attach the Calls the tools return and to narrate what their notes say.

- **A Character at 0 HP** falls Unconscious and can't act. Damage at 0 adds Death save failures, two on a critical hit: pass `crit: true` to `damage`. On their turn, `next_turn` returns a Death save `pending_call`. Attach it with a short Narration of the downed Character. Code tallies the saves, and its `call_result` says whether they are stable, dead or back up on a natural 20. Healing wakes them. A dead Character can't be healed.
- **An NPC or Creature at 0 HP** dies. If the attacker means to spare it, pass `knock_out: true` to `damage`.
- **Concentration.** Casting a concentration spell links the caster to it and ends any spell they were already concentrating on. The result names the ended spell in `ended_concentration`, so narrate its end. When a concentrating caster takes damage, an NPC or Creature saves at once and the notes say whether it holds. A Character gets a Constitution save Call instead, in `concentration_calls` (or in the notes of a `call_result`). Attach it with your next closing Narration, one Call per turn. Falling Unconscious ends concentration.
- **Reactions.** When a Character gets a reaction out of turn, call `offer_reaction` and attach its Call. An opportunity attack happens when a foe leaves their reach: pass `attack: {target, with}`. The Player takes it or passes. A taken attack rolls to hit and damage like any attack, and you hear one `call_result`. Taking a reaction spends it. An NPC's or Creature's reaction is yours: resolve it with `attack` or `cast`.

## Pacing and judgment

- Keep each beat short: what happened, what changed, whose turn it is. Players see enemy health only as unhurt, bloodied, near death or down. Describe wounds in those terms, never with numbers.
- Enemies have motives. They flee, surrender, regroup or call for help when the fight turns. Don't fight to the last goblin unless the fiction calls for it.
- Never invent a number or change state by hand. If something needs a roll, use `roll` or an action tool. If HP or conditions change, use `damage`, `heal`, `add_condition` or `remove_condition`. Give `damage` and `heal` the `dice` to roll; pass `amount` only for an effect that names a fixed number.

## Ending

1. When the fight is over (foes dead, fled or surrendered), decide whether any Creature should survive as a lasting NPC. If so, `establish` it as an NPC (with a `stat_block` field) before ending: Creatures vanish when the Combat ends.
2. Call `end_combat`. Code adds the rounds to the clock.
3. Narrate the aftermath and hand the Floor back. `set_scene` works again once the Combat is over.
