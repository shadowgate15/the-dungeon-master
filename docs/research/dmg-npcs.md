# What DMG Ch 4 and PHB Ch 4 teach about NPCs: a gap analysis

Date: 2026-11-21. Ticket: #281, under the map #277. It feeds the grilling ticket #285 ("Which NPC changes do we adopt?").

Sources: the 2014 Dungeon Master's Guide (DMG), Ch 4 "Creating Nonplayer Characters" (pp. 89–97), plus the part of Ch 8 that Ch 4 points to for social interaction (pp. 244–246); the 2014 Player's Handbook (PHB), Ch 4 "Personality and Background" (PDF pp. 114–119; the PHB's printed page numbers differ from the PDF's, and the page refs below are PDF pages). Everything from the books is paraphrased. No text or tables are reproduced. Shipped content still comes only from the SRD 5.1.

Our side: `GLOSSARY.md` (NPC, NPC memory, Scene, World memory selection, Journal, Character, Background), ADR 0003 and ADR 0005, and the code that creates, stores and voices NPCs:

- `src/lib/server/db/schema.ts`: the `npc`, `disposition` and `npc_fact` tables, and the Character's narrative columns.
- `src/lib/server/session/context/npc.ts`: the NPC voice's context.
- `src/lib/server/session/context/narrator.ts`, `context/fixed.ts` and `context/world-selection.ts`: the Narrator's context.
- `src/lib/server/session/context/ruling.ts` and `exchange/contract.ts`: the Adjudication and Effect context.
- `src/lib/server/session/first-scene.ts` and `generation-stages.ts`: NPC birth at Scene generation.
- `src/lib/server/memory/extraction.ts`: NPC birth and disposition updates after an Exchange.
- `src/lib/server/session/service.ts` (`resolveScene`): how a Scene NPC is resolved.
- `src/lib/server/ai/field-registry.ts` and `src/lib/character/ConceptStep.svelte`: the Character's personality fields.

Social interaction mechanics (Charisma checks, DCs by attitude, help, repeat attempts) belong to the running-play research, #282. They appear here only where they depend on the NPC model.

## What the books recommend

### DMG Ch 4: designing NPCs

- **Most NPCs are bit players** (p. 89). The adventurers are the stars. An NPC needs game statistics only if it might fight, and most NPCs need just one or two vivid qualities to stick in the players' memory, such as a visible mark or an odd habit tied to their trade.
- **Detailed NPCs get a short, fixed outline** (p. 89). An NPC with a bigger role gets about one sentence for each of ten elements:
  - occupation, with a hint of history;
  - appearance;
  - notable abilities, high or low;
  - a talent;
  - a mannerism;
  - how they treat others;
  - one piece of useful knowledge;
  - an ideal;
  - a bond;
  - a flaw or a secret.

  The book offers a random table for most of these as a prompt. The tables are not reproduced here.

- **Appearance and abilities** (p. 89). Appearance is the single most distinctive physical feature. There is no need to roll ability scores; just note any ability that is far above or below average and let it colour the NPC.
- **Talent and mannerism** (p. 90). A talent is something unusual the NPC can do. A mannerism is a speech or physical habit that makes the NPC recognisable at the table. It is a memory aid for the players, not a mechanic.
- **Interactions with others** (p. 90). This is one line on the NPC's social manner. The book says plainly that the manner can change with the audience: the same person can be warm to customers and curt to staff.
- **Useful knowledge** (p. 90). This is one thing the NPC knows that could help the party, anywhere from trivial local advice to a key clue.
- **Ideal** (p. 90). This is the principle that steers the NPC's bigger choices. The book links ideals loosely to alignment but says the link is only a suggestion. Its key point: characters who discover an NPC's ideal can use it to sway the NPC in a social interaction.
- **Bond** (p. 91). This is the people, places or things the NPC holds most dear. Like the ideal, it is a lever the players can find and pull.
- **Flaw or secret** (p. 91). This is a weakness of character, or something the NPC is hiding, that could undo them. It is the third lever.
- **Named monsters deserve the same treatment** (pp. 91–92). A monster with a story role should get a quirk, some background, and above all an ideal, a bond and a flaw, not just its stat block. The worked example shows how those three turn a generic monster into a memorable antagonist with exploitable desires.
- **NPC statistics** (p. 92). There are three depths: only the few numbers needed, a stock stat block, or full class levels. This is combat-facing and out of scope.
- **NPCs who travel with the party** (pp. 92–93). They join for loot or out of loyalty, gratitude or love. Even when a player runs one, it should stay a person with its own drives rather than a tool. Adventurer NPCs can fill out a small party and should be played true to their traits, ideal, bond and flaw. An optional **loyalty** rule keeps a hidden score that rises when the party helps the NPC's bond or treats them well, and falls when the party acts against the NPC's alignment or bond, or abuses them. At zero the NPC leaves or turns on the party.
- **Kinds of supporting NPC** (pp. 93–94):
  - **Contacts** have close ties to a character and supply information, rumours, goods or advice. Casual contacts need only a name and a detail. Recurring contacts deserve goals and some thought about how those goals will surface.
  - **Patrons** employ the party and supply quests and rewards.
  - **Hirelings** are paid service providers and mostly need no development, though one can grow into an ally, a patron or an enemy.
  - **Extras** are background figures. They can be suddenly promoted when a player singles one out, so the DM should be ready to invent a name and a mannerism on the spot.
- **Villains** (pp. 94–96). Prompts for a villain's objective (grouped broadly by what they want: long life, influence, magic, mayhem, passion, power, revenge, wealth), the methods they use, and a **secret weakness**. Finding and exploiting the weakness is very satisfying for players, so a smart villain hides it. The villainous class options that follow (pp. 96–97) are not SRD and are out of scope.

### DMG Ch 8: playing NPCs in social interaction (pp. 244–246)

- **Both sides have agendas** (p. 244). The party wants something from the exchange, and so does the NPC.
- **Three starting attitudes** (p. 244): friendly (wants to help, within reason), indifferent (helps or hinders by self-interest; can still be polite or surly) and hostile (opposes the party but does not necessarily attack, and may scheme instead).
- **Attitudes move by characteristics** (p. 244). Saying the right thing, especially something that touches the NPC's ideal, bond or flaw, can move an NPC one step warmer. A gaffe, an insult or a harmful act moves them one step colder. As a rule, an attitude shifts at most one step in a single interaction.
- **Characteristics must be discovered** (p. 245). The party does not start out knowing what the NPC cares about. Guessing wrong can backfire. After enough conversation, an Insight check can reveal one characteristic, and a badly failed check gives a false or inverted one. Characteristics can also be learned from other sources: friends, letters, public stories. That can be a social quest of its own.
- **Being the NPC** (p. 245). Ask what the NPC cares about and work its ideal, bond and flaw into the portrayal. This makes the world feel alive. Look for reactions that twist the scene, such as an NPC with a grudge against the PC's class or kind. **Show, don't tell**: play a vain NPC as vain rather than describing them as vain.
- **Voice and staging** (p. 246). Use distinct speech patterns by class, origin and creature. With several NPCs present, keep the focus on the adventurers: NPCs talk to the party, not to each other, and ideally one NPC does most of the talking.

### PHB Ch 4: the personality model for player characters

- **Four characteristics, plus extras** (p. 116). A character's personality is captured as personality traits, an ideal, a bond and a flaw. Beyond those, the player can add favourite phrases, tics, habits, vices and pet peeves. Each background suggests options that the player can pick, roll or ignore.
- **Personality traits: two, and specific** (p. 116). A trait should set this character apart from others. A generic adjective that fits many people is a weak trait. A concrete fact about their history, taste or habit is a strong one. Traits can cover likes, dislikes, fears, past achievements, self-image, mannerisms, or the effect of an ability score. A good starting point is to write one trait tied to the highest ability score and one tied to the lowest (p. 117).
- **Ideal: one** (p. 117). This is the belief the character holds most strongly, the principle that compels their actions. The book frames it as a few questions: what they would never betray, what they would sacrifice for, what they strive for most. Alignment is a reasonable starting point.
- **Bond: one** (p. 117). This is a tie to a person, a place or an event. Bonds can drive heroics, or push the character against their own interest when the bond is threatened. They work much like ideals as motivators. New bonds can form during play.
- **Flaw: one** (p. 117). This is a vice, compulsion, fear or weakness that someone could exploit, and something more serious than a mildly negative trait.
- **Inspiration ties roleplay to mechanics** (p. 118). The DM grants Inspiration for playing true to the four characteristics, including giving in to a flaw's or a bond's drawbacks. A character either has it or doesn't; it never stacks. Spending it grants advantage on one attack roll, saving throw or ability check. A player can also hand theirs to another player for great play. (The SRD 5.1 is believed to carry the Inspiration rule. Confirm that against the SRD before building on it.)
- **Background as story cue** (p. 118). The key question about a background is what changed: why the character stopped living that life and started adventuring.

## What we have now

### The NPC record (World memory)

- **The `npc` table holds name, description (≤300 chars), role (≤80, free text), status and place.** There is no personality structure: no mannerism, ideal, bond, flaw, secret, agenda or appearance field. Whatever personality an NPC has must live in the one free-text description.
- **NPC memory is a disposition per (NPC, Character):** one of five stances (hostile, wary, neutral, friendly, allied) plus a note (≤200 chars). Knowledge is `npc_fact` links to Facts.
- **NPCs are born in two places.** The Scene generators (`first-scene.ts` and the destination stages) ask for name, description, role, attitude and "a short knowledge note", at most 3 NPCs. Memory extraction proposes new NPCs with name, description and role. Neither asks for a personality.
- **The knowledge note is stored as the disposition note** (`checkNpcs` in `generation-stages.ts`: `note: item.knowledge`). Extraction later writes its own disposition note ("how they regard the player character") into the same column, and the upsert overwrites it. So what a Scene-born NPC knew can be silently lost the first time their stance changes. The glossary also describes the two things differently: the Scene glossary calls it "a short knowledge note", while NPC memory calls the note part of the disposition.

### Voicing an NPC

- **The NPC voice (`context/npc.ts`) sees only the NPC's name, the stance, and the knowledge string** (the disposition note plus linked Facts), together with the player's Declarations and the NPC's own earlier lines. It does not see the NPC's description or role. Its system prompt says to stay true to "the personality and attitude below", but no personality is passed. As things stand, the NPC voice has to make up a personality from a name and one stance word on every line.
- **The NPC voice does not see the Character** either (not the name, race or class), so it cannot react to who is in front of it. The DMG's "twist" advice, where an NPC reacts to the PC's class or kind, cannot happen.
- **The Narrator** sees each Scene NPC's name, role and description through the World memory selection core, and their stance in the "Present:" line. It never sees knowledge. Its system prompt forbids it to speak for NPCs.
- **Adjudication and Effect** see each present NPC's id, name and stance only, and no secrets (`ruling.ts`). Persuasion and deception are listed as skills. A question in conversation is never a Check.
- **The Reply has one voice** (ADR 0005), and only the dialogue partner speaks. The DMG's advice to let one NPC do most of the talking falls out of this for free.

### Stance changes

- **Only post-Exchange extraction changes a stance.** It can move a stance any distance in one step: nothing in `validateDisposition` or `extraction.ts` limits the jump. Nothing ties a change to the NPC's characteristics, because there are none to tie it to.
- The five-stance scale is a superset of the DMG's three attitudes. Wary and allied sit between and beyond them, so it maps cleanly.

### The Character's narrative details

- **The Character stores appearance, personality, ideal, bond, flaw and backstory as free text**, plus an optional alignment. The Concept step shows them as plain text areas. Field AI writes each one: personality as two sentences, ideal as one sentence ("the principle they believe in most"), bond as one sentence ("a person, place or oath"), flaw as one sentence ("a weakness or vice that could cause trouble").
- **The SRD Acolyte's suggestion tables are seeded** (`background_option`, with alignment links), but the wizard does not offer them as picks.
- **The Narrator's fixed text (`renderCharacter`) includes appearance, personality, ideal, bond and flaw, but not the backstory.** No prompt tells the Narrator, the Arc generator or the Beat check to use the bond or flaw to create pressure or hooks. The NPC voice and Adjudication see none of it.
- **There is no Inspiration.**

## Gaps

1. **NPCs have no personality model.** The DMG's central technique, giving every NPC who matters an ideal, a bond and a flaw or secret, has nowhere to live. A description field can hold an appearance line, but the levers the players are meant to find are not separate, so code cannot hide the secret from the Narrator or reveal one lever on its own.
2. **The NPC voice is starved.** It lacks even the description and role that the database already holds, and its prompt refers to a personality that never arrives. This is the cheapest and most visible gap: every line of dialogue is improvised from a name.
3. **Knowledge and disposition share one column**, so knowledge can be lost when the stance changes.
4. **There is no quick-versus-detailed tiering.** Every NPC is born the same way. The DMG's model is cheap extras by default, promoted to a full outline when the player engages. That model also suits small local models: generate more only when it pays off.
5. **There is no memorable hook per NPC.** The book's minimum for an NPC is one or two striking details (a mannerism, a mark, a speech habit). Our description may or may not contain one, and nothing asks for one.
6. **Stance changes are unconstrained and unexplained.** Nothing limits a stance to one step per interaction, and nothing ties a change to what the player did with respect to the NPC's ideal, bond or flaw.
7. **The player cannot discover what an NPC cares about.** There is no reading of characteristics, no Insight-to-reveal path, and the Journal cannot show what the player has learned about an NPC.
8. **NPCs have no agendas.** The DMG says both sides of a social scene want something, and that recurring contacts and villains need goals. Our NPC has a role, not a want.
9. **There are no villain-specific fields** (objective, methods, hidden weakness). This overlaps the Arc work in #280, where antagonists are planned.
10. **The Character's personality is not used to drive play.** The PC's bond and flaw are rendered to the Narrator but never used as levers, and the backstory is not rendered at all.
11. **The Character's personality guidance is thinner than the PHB's.** Nothing pushes toward specific rather than generic traits, ties traits to ability extremes, or makes the flaw exploitable. The SRD Acolyte options are not offered.
12. **There is no Inspiration**, which is the one mechanic that rewards playing to the four characteristics.
13. **There are no companions and no loyalty.** This fits solo play with no combat Mode. The data model doesn't rule it out.

## Candidate changes

Listed in rough order of player impact, with dependencies noted. Ranking is left to #285 and #287.

1. **Feed the NPC voice what we already store: the description, the role and a one-line view of the Character.** It removes the biggest quality gap with no schema change. Reopens no ADR.
2. **Give NPCs a structured personality profile: a memorable hook (a mannerism or striking detail), an ideal, a bond, and a flaw or secret, each one short optional line.** This is the DMG's core technique and gives code separate levers it can hide or reveal. It changes the NPC glossary entry and the `npc` schema. It reopens no ADR, but it extends ADR 0003's NPC-voice isolation, which stays one-NPC.
3. **Pass the profile to the NPC voice, and keep the flaw or secret out of the Narrator and the ruling context.** The voice can then play the NPC's values ("show, don't tell") while the Narrator, like Adjudication, never sees a secret. It depends on 2 and changes the World memory selection rule.
4. **Split knowledge from the disposition note: knowledge as `npc_fact` links or its own field, the note only explaining the stance.** This fixes the silent overwrite and the mismatch between the two glossary entries. Reopens no ADR.
5. **Tier NPCs: born quick (name, role, one hook), and promoted to a full profile the first time a conversation starts with them.** This matches the DMG's extras-to-central-figure model and keeps generation calls small and rare. It depends on 2. It adds a generation step on the talk Effect, which touches ADR 0005's Exchange cost accounting.
6. **Give NPCs an agenda: one line on what they want right now, for every detailed NPC.** Both sides of a social scene then have goals, and recurring contacts get the DMG's minimum. It depends on 2 and 5.
7. **Limit stance moves to one step per Exchange (or per conversation) in extraction validation, and ask extraction to name the cause (their ideal, bond or flaw was touched, a gaffe, a harmful act).** Attitude then changes the way the DMG describes, and the player can see why. It depends on 2 for the cause. It coordinates with #282 on social Checks. Reopens no ADR.
8. **Let the player learn an NPC's characteristics: an Insight Check in conversation reveals one lever, recorded per Character and shown in the Journal, and a bad failure can record a false one.** This turns NPCs into puzzles the player can work at. It depends on 2 and 4. It reopens ADR 0005, because it needs a new Effect kind or a post-Check reveal outside the current none / move / talk / end-talk set. It also changes the Journal's rule of showing "never what they know".
9. **Use the Character's bond, flaw and backstory as story pressure: render the backstory to the Narrator, and tell Arc generation and the Beat check to aim complications at the bond and the flaw.** The PHB and the DMG both treat these as hooks. They are stored but unused. It overlaps #280 for Arc generation. Reopens no ADR.
10. **Sharpen Character personality creation: Field AI instructions that ask for specific traits (one tied to the highest ability score and one to the lowest), a framing of the ideal as what the character would never betray, and an exploitable flaw; also offer the SRD Acolyte options as picks.** Better PC inputs make change 9 pay off. It changes field-registry text and the Concept step. Reopens ADR 0001 only if the picks are not presented as ordinary form choices.
11. **Add villain fields to the NPC profile for antagonists: objective, methods and a hidden weakness.** This is the DMG's villain toolkit, and the weakness becomes a lever for change 8. It depends on 2. It coordinates with #280 on how the Arc names its antagonists.
12. **Add Inspiration: one flag per Character per Campaign, granted by Adjudication or the Narrator for playing to the four characteristics, and spent for advantage on a Check.** This is the PHB's one mechanic that rewards roleplay. It depends on advantage support (#282) and on confirming the rule is in the SRD 5.1. It adds a glossary term, and it touches ADR 0005's Check (advantage) and the rule that the Character stores choices only, so Inspiration must be Campaign or Session state.
13. **Defer companions and loyalty.** Solo play has no party NPCs and there is no combat Mode. Nothing in the current model blocks it later.
