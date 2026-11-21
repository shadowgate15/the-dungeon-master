# Running play: what DMG Ch 8 and PHB Ch 7–8 teach, against the Exchange

Date: 2026-11-21. Ticket: #282. Map: #277 (Lessons from the Dungeon Master's Guide).

Question: what do the 2014 DMG (Ch 8 Running the Game) and PHB (Ch 7 Using Ability Scores, Ch 8 Adventuring) recommend for adjudicating play, and how does that compare with our Exchange, Adjudication, Check, Effect, Call, Mode and Reply (ADR 0005)? This note is a gap analysis. It ends with candidate changes; the map's grilling ticket decides which to adopt and ranks them.

**Copyright.** The DMG and PHB are copyrighted, and this repo is public. Everything below is paraphrased in our own words. Nothing is quoted, and no tables are reproduced. Rules we would actually ship must come from the SRD 5.1 (CC-BY-4.0). For each topic, the note says whether the SRD 5.1 carries the rule.

## Sources

- **DMG**: `~/Projects/Dungeon Master's Guide.pdf`, Ch 8, pp. 235–262. DMG PDF pages match its printed pages. I skipped the combat parts (initiative tracking, monster HP, improvising damage, areas of effect, mobs, miniatures, reaction timing), as well as chases (pp. 252–254), siege equipment, diseases, poisons and madness. All of those are combat or need systems we don't have.
- **PHB**: `~/Projects/Player's Handbook.pdf`, Ch 7 (PDF pp. 160–166) and Ch 8 (PDF pp. 167–172). PHB references below are **PDF** pages, which differ from the printed pages.
- **SRD 5.1**: the CC-BY-4.0 PDF from Wizards (`media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1.pdf`). I checked its section headings for coverage. Its "Using Ability Scores" part carries ability checks, the typical-DC tiers, contests, skills (including the variant that pairs a skill with a different ability), passive checks, working together, group checks, the per-ability uses, hiding and saving throws. Its "Adventuring" part carries time, movement, travel pace, difficult terrain, special movement, the environment (falling, suffocating, vision and light, food and water), interacting with objects, resting, and between adventures. Inspiration is in its Personality section. **The SRD lacks** the PHB's "Activity While Traveling" (marching order, noticing threats, navigate/map/track/forage), its "Finding a Hidden Object" sidebar and its "Social Interaction" section. It also has none of DMG Ch 8.
- **Our system**: `GLOSSARY.md`, `docs/adr/0003-scenes-replace-turns.md`, `docs/adr/0005-exchanges-replace-the-director-pipeline.md`, `docs/research/exchange-model-eval.md`, and `src/lib/server/session/exchange/*` (`contract.ts` holds the Adjudication and Effect schemas and prompts, `call.ts` the Check roll, `run.ts` the step order, `reply.ts` the voices). Also `src/lib/server/session/context/{ruling,narrator,npc}.ts`, `src/lib/server/session/check-modifier.ts` and `src/lib/rules/derive-stats.ts`.

## Summary

The books and ADR 0005 agree on the core. Both run play as a loop: the DM describes, the player declares, the DM resolves and narrates (PHB p. 167). Both roll only when failure is possible and matters. In both, the DM picks a difficulty and the dice decide. Our gaps are in what happens around the roll:

- **The kind of roll.** We have no plain ability checks, no contests and no saving-throw judgment.
- **The odds.** We have no advantage or disadvantage, no passive scores and no help.
- **What failure means.** We have no success at a cost, no degrees of failure, no retry rule, and a failed Check never has an Effect.
- **Who sees the roll.** Every Check is a visible Call, so there are no hidden checks.
- **Social play.** The books structure it around an NPC's attitude, what the NPC cares about, and a Charisma check at the point of the request. Our attitude never moves during play, and our prompt says speech is never a Check.
- **Exploration.** The books' tools depend on time, light and pace, none of which the Scene tracks.

## What the books recommend

### The rhythm of play

- Play follows a three-step loop: the DM describes the surroundings, the players say what they want to do, and the DM narrates what results (PHB p. 167). ADR 0005 states this loop almost word for word.
- Table talk: be clear whether a player speaks as the character or as themselves. Decide how to treat knowledge the character couldn't have, and whether a player may take back a declared action (DMG p. 235). To curb metagame thinking, ask the player what the character would think (DMG p. 235).

### When to roll at all

- Most attempts should just succeed, with no roll and no look at ability scores. Crossing an empty room or ordering a drink needs no check. Roll only when failure carries a meaningful consequence (DMG p. 237).
- Two screening questions settle it. Is the task so easy and unstressed that it can't fail? Is it so absurd that it can't work? If neither, roll (DMG p. 237).
- An ability check is for an action, other than an attack, that has a chance of failure. The dice decide when the outcome is uncertain (PHB p. 161; SRD).
- **Dice philosophy** (DMG pp. 236–237). There are three styles:
  - *Rolling for nearly everything* makes anything feel possible, but it can push decisions and characterization aside.
  - *Rolling rarely* rewards description and creativity. A player who describes tapping walls and twisting sconces can simply find the secret door. The risks are DM bias and fixating on one "correct" action.
  - *The middle path* blends the two. The DM can grant automatic success, or advantage, for a good plan. A bad plan or bad circumstances can make an easy task impossible, or impose disadvantage.
- **Retrying** (DMG p. 237). Sometimes a retry costs only time. With enough attempts, a character eventually succeeds, and a shortcut is to treat ten times the normal time as automatic success. Repetition never makes an impossible task possible. Sometimes failure closes that approach: a lie that failed won't work told again to the same person. The character must try another way or another target, perhaps at a higher difficulty.

### Choosing the roll

- **Ability, then skill.** The DM picks which of the six abilities applies and sets a DC (PHB p. 161; SRD). A skill is a focus within an ability. Proficiency adds the proficiency bonus, and without it the roll is a plain ability check (PHB pp. 161–162; SRD).
  - Some checks have no skill: forcing a stuck door (Strength), holding your breath or going without sleep (Constitution), picking a lock (Dexterity with thieves' tools). The PHB lists many such uses per ability (PHB pp. 162–166; SRD).
- **Unusual pairings.** A skill can back a different ability when it fits. Swimming a long distance can be a Constitution check that still uses Athletics proficiency, and a show of raw strength can be a Strength-based Intimidation. Reward a player who justifies such a pairing (DMG p. 239; PHB p. 162; SRD).
  - To decide whether proficiency applies at all, ask whether training and practice would make someone better at the task (DMG p. 239).
  - Tool proficiency applies only when the tool is actually used (DMG p. 239).
- **Intelligence or Wisdom?** Wisdom notices that something is so, and Intelligence works out why (DMG p. 238).
- **Saving throws** are reactions to harm that a character almost never chooses to make. Use one when something bad happens and the character might avoid it. Use an ability check when the character actively tries something (DMG p. 238; PHB p. 166; SRD).
- **Contests** are for when two creatures directly oppose each other: grabbing the same object, holding a door against a push, hiding from a searcher, lying to a guard. Each side rolls and the higher total wins. A tie leaves things as they were, so whoever was defending the status quo wins by default (DMG p. 238; PHB p. 161; SRD).

### Setting the DC

- The SRD's six tiers run from very easy (5) to nearly impossible (30), in steps of 5. The tier names are easy to remember (DMG p. 238; PHB p. 161; SRD).
- If a check is called for at all, the task probably isn't very easy. Let characters succeed at very easy tasks without rolling (DMG p. 238).
- Most games run fine on easy, medium and hard alone (DMG p. 238).
  - An average, unproficient character succeeds at an easy task about half the time.
  - A medium task needs a good score or proficiency, and a hard task usually needs both.
- Above hard, mind the characters' level. The top two tiers are out of reach for low-level characters (DMG p. 238).
- **Automatic-success variant** (DMG p. 239): a check succeeds automatically when its DC is low enough relative to the character's ability score or proficiency. It removes absurd results, such as a strong fighter failing to batter a door the weak rogue knocks down. The downside is predictability.

### Shifting the odds

- **Advantage and disadvantage** mean rolling two d20s and keeping the higher or the lower. They don't stack. Any mix of both cancels out completely, so there's no need to count circumstances (PHB p. 160; DMG pp. 239–240; SRD).
- The DM grants advantage when circumstances, the environment, earlier actions or a player's creativity help. The DM imposes disadvantage when circumstances, the environment or a flaw in the plan hinder (DMG p. 239).
- **Passive checks** use 10 plus the usual modifiers, with +5 for advantage and −5 for disadvantage. Use them for a task repeated over and over, or when the DM wants to resolve something secretly without dice, such as whether a character notices a hidden creature (PHB p. 162; SRD).
- **Working together**: when several characters cooperate, the leader rolls with advantage. A helper must be able to attempt the task alone, and the task must actually benefit from more hands (PHB p. 162; SRD).
- **Group checks**: everyone rolls, and the group succeeds if at least half succeed. Use them when the group succeeds or fails together, for example picking a path through a swamp (PHB p. 162; SRD).
- **Inspiration** is a reward for playing true to the character's personality traits, ideal, bond and flaw. A character either has it or doesn't, and spending it gives advantage on one roll (SRD). The DMG adds guidance (pp. 240–241):
  - Award it roughly once per session per character, for play that makes the game more exciting, funny or memorable.
  - Possible triggers are roleplaying, heroic risk, victory, or genre conventions shared with the players in advance.
  - Start by awarding it after the act rather than offering it beforehand, so it doesn't feel manipulative.
  - Skipping it entirely suits gritty games.

### Who sees the roll

- Rolling in the open shows impartiality. Rolling hidden keeps the opposition's strength unclear and permits rare fudging (DMG p. 235).
- **Hidden rolls protect uncertainty.** When a player suspects something, such as a charmed noble or an unseen watcher, the DM can roll the Insight or Perception check secretly. A high visible roll that finds nothing would wrongly convince the player that nothing is there. The DM can even roll when nothing is present. Don't overuse this (DMG p. 235).

### What success and failure mean

- A check that meets the DC succeeds. A failure means either no progress, or progress with a setback the DM chooses (PHB p. 161; SRD).
- **Success at a cost** (DMG p. 242): when a roll misses by a point or two, the DM can let it succeed with a complication. Good complications change the situation and force new choices, such as a climb that succeeds while the companions' rope frays, or an intimidated prisoner who talks but screams loud enough to bring guards. The same works for a roll that only just meets the DC.
- **Degrees of failure** (DMG p. 242): failing by a wide margin (around 5) can carry a worse consequence than a narrow miss. A badly failed disarm sets off the trap, and a badly failed plea gets the speaker thrown out.
- **Natural 20 or 1** has no rule effect on checks or saves, but the DM may sharpen the result: an extra clue, or broken tools (DMG p. 242).

### Exploration

- **Time.** The DM sets how long tasks take, using a scale that fits the moment (PHB p. 167; SRD):
  - minutes in a dungeon (about a minute to walk a long hallway, about ten minutes to search a room)
  - hours in a city or the wilderness
  - days on long journeys
  - rounds in combat
- **Summarize movement.** The DM can compress travel into a sentence, even inside a large dungeon, unless the exact time matters (PHB p. 167; SRD).
- **Travel pace** (PHB pp. 167–168; SRD; DMG pp. 242–243 for map scales and magical or vehicle speeds):
  - Fast travel makes characters worse at noticing, with a penalty to passive Perception.
  - Slow travel lets them move stealthily.
  - Pushing past a normal day's march risks exhaustion.
  - Difficult terrain halves the distance.
- **Activity while traveling** (PHB pp. 168–169; not in SRD):
  - A marching order decides who meets traps or threats first.
  - Passive Perception determines who notices hidden threats.
  - A character busy with another task (navigating, mapping, tracking or foraging) doesn't contribute to noticing.
- **Noticing other creatures** (DMG p. 243): if neither side is sneaking, they notice each other once in sight or hearing. If someone is sneaking, compare their Stealth rolls against the other side's passive Perception.
- **Visibility** (DMG p. 243): outdoor sight distance depends on weather and height.
- **Vision and light** (PHB pp. 169–170; SRD): dim light and other light obscurement give disadvantage on sight-based Perception. Darkness and other heavy obscurement amount to blindness. Darkvision treats darkness as dim light.
- **Tracking** (DMG pp. 243–244): a Survival check whose difficulty depends on the ground and on how old the trail is. Obvious tracks need no roll, and with no trail at all, tracking is impossible. Re-check after a rest, an obstacle such as a river, or a change of terrain or weather. A lost trail can be found again by searching for a while.
- **Finding hidden things** (PHB p. 165 sidebar; not in SRD): the player must say where the character looks. Looking around a room in general can never find a key hidden in a drawer, whatever the roll.
- **Objects** (PHB p. 170; SRD; DMG pp. 246–247):
  - Most object interactions just happen: the player says what the character does (pulls a lever) and the DM describes the result.
  - A check comes in only when something resists, such as a rusted lever that has to be forced.
  - Given time and the right tools, anything destructible can be destroyed. Use common sense about what a tool can break: a sword won't cut a stone wall.

### Social interaction

- An NPC's attitude toward the characters is friendly, indifferent or hostile (PHB p. 170; DMG p. 244; not in SRD). An indifferent NPC isn't necessarily cold, and a hostile one doesn't necessarily attack.
- **Both roleplaying and checks count** (PHB pp. 170–171; DMG p. 244). The DM reads the character's words and manner to decide how the NPC reacts: a coward folds under threats, a vain creature laps up flattery. Offering what the NPC wants, threatening what it fears, or appealing to its goals works. Insulting it or its allies backfires. The DM can still call for a Charisma check whenever chance should play a part. Players should lead with the approach their skills favor.
- **A structured social scene** (DMG pp. 244–245) works mostly behind the scenes and doesn't replace roleplaying:
  1. *Starting attitude.*
     - A friendly creature helps with low-risk requests without a roll, but needs a check to accept a personal risk.
     - An indifferent creature needs a check before it will do anything asked.
     - A hostile creature needs one or more hard checks, or may be beyond persuasion entirely.
  2. *Conversation.* The players make their case in terms that matter to the NPC. Touching what the NPC cares about can move its attitude one step toward friendly, and a gaffe or insult can move it one step toward hostile. The attitude moves **at most one step per interaction**, temporarily or for good.
     - The players may not know what the NPC cares about. They can guess and risk guessing wrong, or after some conversation make an Insight check to learn one of its traits. A very bad Insight failure yields a false or inverted trait. Letters, friends and stories are other sources.
  3. *The check.* When the players make their request, or when the conversation has run its course, a participant makes a Charisma check (Persuasion, Deception or Intimidation, depending on how they argued). The result is read against the NPC's current attitude, and higher totals buy more risk or sacrifice from the NPC. Another character who helps the argument gives advantage, and one who blunders gives disadvantage.
  4. *Repeat?* Pressing again after the check can be useless or can sour the NPC. A different character might repair the damage with good roleplaying and a successful Persuasion check.
- **Portraying NPCs** (DMG pp. 245–246):
  - Ask what the NPC cares about, and put that in its reactions. Aim for responses that twist the situation, such as a widow who distrusts the party's wizard because a wizard killed her family.
  - Show, don't tell: let a vain NPC act vain rather than calling it vain.
  - Give each NPC distinct speech patterns. With several NPCs present, keep the player characters at the center: NPCs address them rather than each other, and ideally one NPC does most of the talking.
  - Draw quieter players in by addressing them in character, or by asking what their character is doing.

### Resting and pacing

- **Resting** (PHB p. 171; SRD):
  - A short rest is an hour or more of light activity, during which a character may spend Hit Dice to heal.
  - A long rest is about eight hours of sleep or light activity, broken by an hour or more of strenuous activity. It restores all hit points and half the Hit Dice, at most once a day, and only if the character starts it with at least 1 hit point.
- **Between adventures** (PHB pp. 171–172; SRD): time can pass with a summary. Downtime activities take days. This is out of scope on the map (DMG Ch 6).
- **Advancement and rewards** (DMG pp. 260–261):
  - Non-combat challenges can earn XP, but only when failure was a real risk.
  - **Milestones** can earn XP or small refreshes, such as the benefit of a short rest: completing a step toward the goal, finding a hidden place or fact, reaching an important destination.
  - Advancement can drop XP entirely, going by session count or by **story goals reached**.

## What we have now

| Area | Ours today |
|---|---|
| Rhythm | The Exchange: a Declaration, then Adjudication, an optional Effect and a Reply, after which the floor returns to the player (ADR 0005). This matches PHB p. 167. |
| When to roll | Four outcomes: `happens`, `impossible`, `check`, `ask`. The prompt rule is to Check only when something in the Scene resists AND failure would matter, so ordinary actions happen (`ADJUDICATION_SYSTEM`). This matches DMG p. 237. `impossible` also covers absent people and things. |
| Roll kinds | 18 skills plus 6 saves (`CHECKS`). There are **no plain ability checks** and no unusual pairings (a skill is always used with its default ability, via derived stats), no tool checks, no contests, no group checks and no help. Saves are listed, but the prompt gives no guidance on when to use one. |
| DC | Four tiers: easy 10, medium 15, hard 20, very hard 25 (`DIFFICULTY_DC`). There is no very easy (correctly: that is `happens`) and no nearly impossible. The tiers aren't adjusted for the Character's level, so a level 1 Character facing very hard has very low odds. The DC is never shown. |
| Odds | A single d20 plus the modifier (`rollCheck`). There's **no advantage or disadvantage**, no passive checks (although `passivePerception` is derived and shown on the Character sheet) and no Inspiration. |
| Who sees the roll | Every Check is a Call. The player clicks to roll, and the roll line is logged with skill and total. There are **no hidden rolls**. |
| Failure | Binary success. On a failed Check, the Reply is told "tries and fails; nothing changes", and **a failed Check has no Effect** (ADR 0005 consequence: failure consequences need systems that don't exist yet). The margin of success or failure, and natural 20s and 1s, are computed but never used. |
| Retry | No memory of failed approaches. The same Declaration can be retried immediately with a fresh roll. |
| Effect | One of `none`, `move` (through a listed exit), `talk`, `end_talk`. There's no Effect for attitude, time, light, rest, items, or revealing a hidden thing. |
| Social | Mode `dialogue`. Each NPC has an attitude from a five-value stance (hostile, wary, neutral, friendly, allied) and a short knowledge note. The NPC voice sees attitude and knowledge. **Attitude doesn't change during an Exchange.** It's World memory (NPC memory, a disposition), proposed after the Exchange by extraction. The Adjudication prompt says a question in conversation is never a Check. The eval found the model over-calls Insight on plain speech (`docs/research/exchange-model-eval.md`). NPCs have no "what they care about" field. |
| Exploration | The Scene holds a location, exits, objects (strings), present NPCs, the Mode and any open Call. There's **no clock, time of day, light level, travel pace, or hidden contents**, and no marching order (solo play). Moving is instant. |
| Resting and resources | Neither the Scene nor the Session tracks HP, Hit Dice, spell slots, conditions or exhaustion. The Character is level 1 only, with derived stats. |
| Pacing | The Narrator sees the Arc and the current Act's open Beats. Beat state is planned (GLOSSARY), and the Beat check runs after completed Exchanges. There's no advancement. |
| Table talk | Every input is a Declaration. An out-of-character or rules question has no separate path. |

## Gaps

1. **No plain ability checks or unusual pairings.** "Force the stuck door", "hold my breath" and "pick the lock" have to borrow a skill. Athletics stands in for raw Strength, and lock picking is mapped to Sleight of Hand (the prompt says so) when the SRD treats it as a Dexterity check with thieves' tools. The model is forced into a less faithful choice.
2. **No advantage or disadvantage.** The DMG's main lever for rewarding a clever plan or reflecting darkness or a hurried attempt is missing. The model can express circumstance only through the difficulty tier.
3. **Failure is a dead end.** There's no success at a cost, no degrees of failure and no setback. The Reply narrates "nothing changes", which is the flat outcome the DMG warns makes failure feel pointless (ADR 0005 already lists this as future work).
4. **No retry rule.** A failed lie can be told again at once with a new roll, and "I keep trying until it works" has no time cost.
5. **Every roll is visible.** The player sees an Insight or Perception total even when the honest answer is "you can't tell" or "nothing is there". That leaks information and creates the false certainty the DMG warns about.
6. **No passive scores or hidden Scene contents.** Noticing a lurker or a trap can't happen unprompted. Nothing in the Scene is hidden, and the derived passive Perception is unused in play.
7. **No contests.** Lying to or sneaking past an NPC is a fixed-difficulty Check rather than an opposed roll. NPCs have no stats to roll with.
8. **Social play has no structure or movement.** Attitude is only read, never shifted within a conversation. There's no one-step-per-interaction rule, no "what does this NPC care about", and no Charisma check at the moment of the request. "Speech is never a Check" is right for chat and questions but wrong for a request that asks an NPC to take a risk, or for a lie that matters. Our five stances are finer than the book's three, which is fine but needs a mapping.
9. **Searching ignores where the character looks.** Nothing in the prompt makes "I search the room" ask where, or makes a specific description succeed without a roll.
10. **No time, light or pace.** Tracking, resting, travel, visibility and darkness all depend on a clock and a light level the Scene doesn't have.
11. **No rest and no in-play resources.** Resting can't do anything, because nothing in a Session tracks HP or resources.
12. **DC tiers aren't calibrated to the Character's level.** At level 1, very hard is almost never passable, and the prompt doesn't tell the model that most checks should be easy or medium.
13. **No saving-throw guidance.** Saves are in the enum, but the prompt never says when a save is right: a reaction to harm, not an attempt.
14. **No Inspiration.** It's in the SRD and fits solo storytelling, and Characters already store a personality trait, ideal, bond and flaw.
15. **Out-of-character talk is treated as action.** "What does my character know about this cult?" or "Can I use Athletics for that?" is adjudicated as a Declaration. A knowledge question could be a lore check (Arcana, History, Religion, Nature) or a free answer, but the prompt doesn't cover it.
16. **No story-based advancement.** Characters are level 1 only, and reached Beats aren't tied to milestones.

## Candidate changes

These are unranked. The grilling ticket ranks them by player impact, then by dependency. "Contract" means `src/lib/server/session/exchange/contract.ts`, and any change there must re-pass the exchange eval (ADR 0005's gate).

1. **Sharpen the when-to-roll rule in the Adjudication prompt.** Add the DMG's two screening questions, a line saying a sufficiently specific description of how the character does something can just happen, and save guidance (a save is a reaction to harm). *Rationale:* these are cheap prompt-only fixes for gaps 9, 13 and the eval's over-calling. *Reopens:* none (contract and eval only).
2. **Calibrate difficulty to the Character's level.** Tell Adjudication that most checks are easy or medium, and that very hard is reserved for heroic feats. Optionally, let code clamp very hard at low levels. *Rationale:* a level 1 Character should rarely face DC 25 (gap 12). *Reopens:* none.
3. **Checks name an ability, optionally with a skill or tool.** Replace the 24 slugs with an ability plus an optional skill ("Constitution (Athletics)", "Dexterity (thieves' tools)", plain "Strength"). Code applies proficiency when the Character has that skill or tool. *Rationale:* this is the SRD's actual check model, and it removes forced skill choices (gap 1). *Reopens:* the glossary entry for Check, and the eval.
4. **Advantage and disadvantage on Checks.** Adjudication may add an edge (advantage, disadvantage or none) with a short circumstance reason. Code rolls two d20s, and the edge is shown to the player. *Rationale:* this is the DMG's main tool for rewarding plans and reflecting circumstance (gap 2), and the foundation for help, Inspiration and passive scores. *Reopens:* the glossary entry for Check, and the eval.
5. **Use the margin: success at a cost and degrees of failure.** Code classifies the roll by its margin (clear success, bare success, near miss, failure, bad failure, and natural 20 or 1) and gives the Reply that band. On a near miss, the Reply may grant success with a complication. On a bad failure, it may add a worse consequence. *Rationale:* this makes failure interesting without new state (gap 3), using only numbers code already computes. *Reopens:* ADR 0005 (the consequence that a failed Check changes nothing, and the Reply's facts).
6. **Effects after a failed Check.** Allow a failed or costly Check to carry an Effect from a small set: the NPC's attitude worsens, the character is noticed, an exit becomes blocked. *Rationale:* this gives setbacks real state (gap 3), and it's the step after candidate 5. *Reopens:* ADR 0005 (an Effect only on happens or success), and the glossary entries for Effect and Exchange.
7. **Remember failed approaches in the Scene.** Code records failed Checks (approach, target and skill) for the current Scene. Adjudication sees them, and repeating the same approach against the same target is ruled impossible or harder. "Keep trying with plenty of time" can just happen, and costs time once time exists (candidate 12). *Rationale:* this stops reroll-spam and follows the DMG's retry guidance (gap 4). *Reopens:* the glossary entry for Scene, and ADR 0003's Scene contents.
8. **Hidden Checks.** For checks whose result the player shouldn't learn from the number (Insight, and Perception or Investigation when there may be nothing to find), code rolls without raising a Call and gives only the outcome to the Reply. The log records the roll server-side. *Rationale:* this protects uncertainty and stops the roll from leaking information (gap 5). *Reopens:* ADR 0005 (a Check becomes a Call), the glossary entries for Call and Check, and the Event log's visible event kinds.
9. **Hidden Scene contents and passive Perception.** Give the Scene hidden elements (a concealed exit, a lurking NPC, a trap) with a code-held DC. Code compares them against the Character's derived passive Perception when the Scene is entered or changes, and reveals them through an Effect. An active search uses a Check, and the player must say where they look (PHB sidebar, paraphrased). *Rationale:* noticing things unprompted is basic to exploration, and the stat already exists (gap 6). *Reopens:* ADR 0003 (Scene contents), and the glossary entries for Scene and Effect. It probably needs its own Map, together with the DMG Ch 5 environments item on #277.
10. **Contests against NPCs.** When an NPC directly opposes the attempt (a lie against Insight, sneaking against a watcher), the Check becomes a contest. Code rolls for the NPC from a simple derived bonus (a tier by role, since NPCs have no stats), and a tie leaves things as they were. *Rationale:* opposed actions are a core SRD rule (gap 7). *Reopens:* the glossary entries for NPC and Check, and the eval. It depends on deciding how much stat an NPC carries (see the NPC research, #281).
11. **Structured social interaction.**
    - Give each NPC something it cares about.
    - Let a conversation shift its attitude by at most one step per interaction, through a code-applied Effect, with Insight able to reveal what it cares about.
    - Call a Charisma check (Persuasion, Deception or Intimidation) at the point of a real request or a consequential lie, read against the current attitude and how much risk the request asks of the NPC.
    - Keep chat and questions as `happens`.
    - Map our five stances onto the book's three for this purpose.

    *Rationale:* social scenes are a large share of solo play and currently can't move anything (gap 8). *Reopens:* ADR 0005 (the Effect set and "speech is never a Check" in the contract), the glossary entries for Effect, NPC memory and NPC, and possibly ADR 0002/0003 if attitude moves from post-Exchange extraction to an in-Exchange Effect. It overlaps with #281 (NPCs).
12. **A Scene clock and light level.** Code keeps the time of day and the elapsed time per Session, plus the location's light. Effects advance them (a move, a search, a rest, travel), and the Narrator and Adjudication see them. Darkness feeds candidate 4 as disadvantage. *Rationale:* time and light underlie tracking, rest, visibility and pacing (gap 10). *Reopens:* ADR 0003 (Scene contents), and the glossary entries for Scene and Effect. Map-sized.
13. **Travel and summarized movement.** A move to a known Place that's more than one exit away (or overland travel) is compressed into one Effect and Reply, with an elapsed time and an optional pace (fast lowers passive Perception, slow allows stealth). *Rationale:* the books advise summarizing travel rather than walking each room. *Reopens:* the glossary entries for Effect and Place. It depends on candidate 12 and the DMG Ch 5 environments item.
14. **Rest as an Effect.** Short and long rests, following the SRD rules, as an Effect that advances the clock and restores resources. *Rationale:* resting is basic play, but it does nothing until resources exist (gap 11). *Reopens:* the glossary entries for Session, Character and Effect. It depends on Session-scoped HP and resource state, a decision not yet taken anywhere, and on candidate 12.
15. **Inspiration.** A per-Session (or per-Character) flag set by code. A narrow model request after the Exchange may propose awarding it when play matched the Character's trait, ideal, bond or flaw, and code caps it at about once per Session. The player spends it to roll a Check with advantage. Use the SRD wording of the rule. *Rationale:* it rewards roleplaying with no combat dependency (gap 14). *Reopens:* the glossary entries for Character and Call (the spend button). It depends on candidate 4.
16. **An out-of-character path.** Let Adjudication recognize a question to the DM, such as what the character knows or whether a skill applies. Lore questions become an Intelligence check (Arcana, History, Religion or Nature) or a free answer from what the Scene and World memory establish. Rules questions get a short answer. Neither takes an Exchange's Effect. *Rationale:* the DMG separates speaking in character from speaking as a player, and a solo player asks these often (gap 15). *Reopens:* ADR 0005 (the Exchange as the only unit, and Declaration as the only input), and the glossary entries for Declaration and Adjudication.
17. **Tie reached Beats to milestones.** When Beats are reached, treat major ones as story milestones that can grant a short-rest refresh now and a level later. *Rationale:* the DMG's story-based advancement fits our Arc and Beat model (gap 16). *Reopens:* the glossary entries for Beat and Beat state. It depends on Beat state shipping and on advancement past level 1, so it ranks low.
18. **Feed DMG craft into the Narrator and NPC voice prompts.** In our own words, add:
    - *show, don't tell* (actions reveal personality)
    - *NPCs address the player character, not each other*
    - *twist the response from what the NPC cares about*
    - *narrate a failed or costly result as a change to the situation*

    *Rationale:* cheap prompt-quality gains. This is part of the "DMG-derived guidance base" listed under Not yet specified on #277. *Reopens:* none.

### Dependencies at a glance

- Candidate 4 (advantage and disadvantage) comes before 15 (Inspiration) and is used by 9 and 12.
- Candidate 5 (margin bands) comes before 6 (failure Effects).
- Candidate 12 (clock and light) comes before 13 (travel) and 14 (rest), and makes the time cost in 7 real.
- Candidate 14 also needs Session resource state, which is undecided.
- Candidates 10 and 11 depend on the NPC decisions from #281.
- Candidate 9 needs a hidden-contents model in the Scene, likely together with the DMG Ch 5 environments item.
- Candidates 1, 2, 3, 5 and 18 stand alone. Candidates 1, 2, 3 and 4 all change the contract and share one eval re-run.

### Out of scope (per #277)

Combat and everything in DMG Ch 8 that serves it: initiative, monster HP, improvised damage, areas of effect, mobs, maps and miniatures, chases, siege. Also diseases, poisons and madness (no conditions system), downtime and between adventures (DMG Ch 6), multiple players (marching order, group checks and splitting the party matter once there is more than one Character), and the table logistics for missing players, small groups and new players.
