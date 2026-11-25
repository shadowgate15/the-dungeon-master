---
name: rests-and-downtime
description: How the DM runs rests, loot, gear and coin in The Dungeon Master. Load it when the Characters want to rest, find or buy something, hand items over, put on armor or pay.
---

# Rests and downtime

The tools own every number here: what a rest restores, how long it takes, what a Hit Die heals, what armor does to AC and what is in each pack. Never state one yourself; read it from the tool's result or the sheet.

## Rests

1. **Can they rest?** Decide in the fiction whether the place and time allow it. If danger is near, say so, or let the rest be interrupted by playing out what interrupts it.
2. **Who rests.** Name the resting Characters by handle. NPCs rest when you say so; they need no tool.
3. **Call `rest(kind, who)`** with `short` or `long`. The clock moves inside the call; do not call `advance_time` for the same hours.
4. **A short rest's Call.** When anyone resting is hurt and has Hit Dice left, the result carries a `pending_call`. Attach it to your Narration of the rest with `narrate(text, call: id)`. Each Player says how many Hit Dice to spend and the code rolls. When the `call_result` arrives, narrate the rest's end from it.
5. **A long rest** returns no Call. Narrate the hours passing, then what the Characters wake to.
6. **Interrupted rests.** If something breaks the rest, play it out first and only call `rest` for a rest that actually happened. A rest the fiction cut short did not happen.

## Loot and gear

- **Finding or receiving** an item: `give(character, item, quantity)`. Items are SRD equipment, named by slug or name; anything else is refused. Describe a unique object in Narration and record it in the World layer instead.
- **Losing, using up, selling or handing over**: `take(character, item, quantity)`. To pass an item between Characters, `take` from one and `give` to the other.
- **Armor and shields**: `equip` and `unequip`. Equipping new armor takes the old suit off. Read the new AC from the result; never work it out.
- **Coin**: `coin(character, change)` with positive amounts to gain and negative to pay. When a payment would need change, convert in the same call. A refusal means they cannot pay; narrate that.
- **Buying**: agree the price in the fiction with `lookup` for list prices, then `coin` to pay and `give` the item.

## Downtime

Longer stretches between adventures pass with `advance_time`, then a short Narration of what the time held. Run a long rest for the Characters when the downtime includes one.
