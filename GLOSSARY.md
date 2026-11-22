# The Dungeon Master

An AI Dungeon Master for D&D 5e, run by a Claude Code session. Deterministic code owns rules and state; the DM owns narration and judgment and changes state only through tools.

## Language

### The table

**Player**:
A human at the table who controls one or more of a Campaign's Characters. A Player is never a Holder: what a Player can see comes from the Beliefs of the Characters they control.
_Avoid_: User, gamer

**DM**:
The Claude Code session that runs the game: it narrates, voices NPCs, judges what happens and plans the story, and changes state only through tools. All of the game's AI is the DM, including the one-off jobs it hands to subagents.
_Avoid_: Narrator, Director, AI, GM

**Host**:
The Player whose machine holds a Campaign's folder right now. A Campaign has one Host at a time, and hosting passes to another Player by handing off the folder.
_Avoid_: Owner, server

**Character**:
A Player's hero in one Campaign, built at level 1 from the D&D 5e SRD 5.1. It stores the Player's choices (race, class, background, ability scores, picked skills, spells, equipment and narrative details) and its play state (current hit points, spent spell slots, conditions, inventory). Everything computed from those (modifiers, maximum hit points, armor class, saves, spell slots) is derived and never stored. A Character belongs to exactly one Campaign; using a hero again means copying it into another Campaign as a new Character.
_Avoid_: PC, player character sheet, hero, avatar

**Controlling Player**:
The one Player who decides what a Character does. Every Character has exactly one, and control can pass to another Player. The DM never controls a Character: anyone the DM runs, even a companion who travels with the Party, is an NPC.
_Avoid_: Owner, author

**Character status**:
Whether a Character is alive, dead or departed. Death is a state the story can reverse, so a dead Character stays in the Party. Departed means its Controlling Player took it out of play; it stays on record, read-only, and can rejoin. Unconscious, dying and other conditions are play state, not status.
_Avoid_: Archived Character, retired Character

**Party**:
The Characters adventuring in a Campaign: every Character that has not departed. A Campaign has exactly one Party, whose members change over time. A split Party is still one Party, with its Characters in different Places.
_Avoid_: Group, team, adventurers

### Campaigns

**Campaign**:
One story and the World it is set in, played by one Party. A Campaign lives in its own folder and is either active or archived.
_Avoid_: Adventure, game, save

**Archived Campaign**:
A Campaign set aside by a Player. It is hidden from the main Campaign list and is read-only until restored. Archiving is reversible; deleting a Campaign is not.
_Avoid_: Disabled Campaign, hidden Campaign, finished Campaign

**Missing Campaign**:
A known Campaign whose folder can no longer be found where it was, for example because it was moved. It stays listed as missing until its folder is added again.
_Avoid_: Broken Campaign, lost Campaign

**Campaign Seed**:
The set of choices a Campaign is created from. A name, a premise, a **Tone** and a **Length** are required. A World name, a **genre flavor** (e.g. high fantasy, gothic horror), a **scale** (single region up to planar), a **magic level** (none up to ubiquitous) and a **tech level** (stone age up to futuristic) are optional. The premise covers the setting as well as the story. It is the starting point for a Campaign, not the Campaign itself.
_Avoid_: Seed, World seed, template, config

**Seed card**:
The live, hand-editable form that holds the Campaign Seed while a Campaign is being created. It is the source of truth and has no AI in it; the DM writes into it only when a Player asks, through tools that set its fields. It becomes read-only at Begin, and is editable again only after Start over.
_Avoid_: Campaign form, draft

**Begin**:
The Player's act that ends a Campaign's creation and starts its story. It is allowed once the Campaign Seed is complete and the Party has at least one Character, and only a Player can do it, never the DM. At Begin the DM builds the World and the Arc from the Campaign Seed and the Party, and the Players are shown only what their Characters would know. Nothing before Begin is play, so the Event log starts after it.
_Avoid_: Generate, start, launch

**Start over**:
Discarding a begun Campaign's World and Arc so its Campaign Seed can be edited and Begin done again. It is allowed only until the first Narration of play; after that the World stands.
_Avoid_: Regenerate, reset, reroll

**Tone**:
The mood of play a Campaign aims for, one of: heroic, lighthearted, tense, dark, mysterious, epic. Unordered. It describes how play feels, not the setting (that is the genre flavor). The DM uses it to set mood and register.
_Avoid_: Genre, theme, style

**Length**:
How much story a Campaign is meant to hold, one of: one-shot, short, medium, long. Ordered shortest to longest. one-shot is a single sitting; short is a few Sessions; medium is a season of play; long is an open-ended saga. It measures story scope, not hours or Session counts. The DM uses it to pace how much story to plan.
_Avoid_: Duration, Session count, size

### Character creation

**Character creation wizard**:
The step-by-step flow in which a Player builds a Character: Concept (name, race, class, background and personal details), ability scores, skills and proficiencies, equipment, spells (only for classes that cast at level 1), then review and save. Concept must be valid before the later steps open, and a Character can only be saved once every step is valid. The Player may revisit and change an earlier step; choices that no longer fit are flagged, not removed. The same wizard edits an existing Character's choices.
_Avoid_: Character form, character builder

**Character draft**:
The unsaved state of a Character while it is being built in the wizard. It is kept with its Campaign, so it survives a reload and the DM can write into it when a Player asks, and it is discarded only when abandoned. It is not a Character, and does not join the Party, until it is saved.
_Avoid_: Saved draft, work in progress

**Ability Score Method**:
One of the three ways a Character's six base ability scores are set: **standard array** (the fixed values 15, 14, 13, 12, 10, 8, each assigned to one ability), **point buy** (a 27-point budget spent on scores from 8 to 15, up to the budget) or **rolling** (six rolls of four six-sided dice with the lowest dropped, assigned freely). None of the three is in the SRD; they are rules the app defines itself. The Player chooses the method; the DM never does. When asked, the DM may only arrange the values the chosen method gives across the abilities, or spend the point-buy budget, never invent values. Code makes any rolls and the Character keeps the rolled dice. Racial bonuses are applied on top of the base scores, never part of them.
_Avoid_: Stat generation, stat roll

**Rolled set**:
The six ability score totals produced by the Player's roll under the rolling Ability Score Method: code rolls four six-sided dice per total and drops the lowest. The Character keeps the dice, and a new roll replaces the earlier set. The DM never rolls it; it may only arrange a set the Player already rolled.
_Avoid_: Dice result

**Background**:
A Character's history before adventuring. It grants two skill proficiencies, two tool or language proficiencies, a feature and a starting equipment package, and carries the Character's personality trait, ideal, bond and flaw. A Character has exactly one. The choices are Acolyte, the only background the SRD ships, or a Custom background.
_Avoid_: Origin, past, profession

**Custom background**:
A Background built from the SRD's customization rule rather than choosing Acolyte: a name, two skill proficiencies and two tool or language proficiencies (code enforces the counts and the rule that a duplicate proficiency must be replaced by another of the same kind), a feature written as narrative text with no mechanics, and a fixed equipment package. The Player picks the proficiencies; the DM may write the name and the feature text when asked.
_Avoid_: Homebrew background, new background

**Feature choice**:
A decision a race, subrace, class, subclass or background leaves to the Player, such as a Dwarf's tool proficiency, a Fighter's fighting style, a Dragonborn's draconic ancestry or a Half-Elf's bonus abilities. Each one belongs to a named group with a fixed number of picks and a set of options. Fixed benefits that need no decision are granted automatically and are not choices.
_Avoid_: Option, trait pick, perk

**Equipment choice group**:
One of the "this or that" choices in a class's starting equipment, such as "a greataxe or any martial melee weapon". The Player picks one option per group, and where an option allows any weapon or instrument of a kind, picks the specific item. Options can be unavailable when the Character lacks the proficiency they require. Items a class or background gives with no choice are not part of any group.
_Avoid_: Loadout, kit

**Granted spell**:
A spell a Character has for free from race, subrace or subclass, such as Tiefling's thaumaturgy. It is shown beside the Character's chosen spells but is never one of them: it does not count against the class's cantrip or spell numbers.
_Avoid_: Bonus spell, free spell

**Rules Data**:
The D&D 5e SRD 5.1 reference content (races, classes, backgrounds, spells, equipment and so on). It is read-only and seeded from a pinned dataset. Characters refer to it rather than copy it.
_Avoid_: Reference data, compendium

### Play

**Session**:
One sitting of play in a Campaign, from start to end, run by one DM. A Campaign has many Sessions but at most one open at a time. A Session owns nothing of its own: the Campaign's Event log and Scene carry on across Sessions, and every event is stamped with the Session it happened in.
_Avoid_: Game, run, playthrough, sitting

**Scene**:
Where the spotlight of play is right now: one Place, the Characters and NPCs present there, and any open Call. A Campaign has exactly one current Scene. Exits and objects belong to the Place, and every Character and NPC has its own whereabouts, so a Character outside the Scene is simply elsewhere. With a split Party the spotlight moves between Places; there are never two Scenes. The DM changes the Scene only through tools.
_Avoid_: Room, location, state, encounter

**Declaration**:
What a Player says one of their Characters does or says, in free text or by clicking something in the Scene. It always names the Character. Free text is always accepted, even while a Call is open.
_Avoid_: Action, command, input, move, turn

**Check**:
A d20 roll plus a Character's modifier for one skill or saving throw, against a DC. The DM names the skill or save and a difficulty tier (easy, medium, hard or very hard); code turns the tier into the SRD DC and rolls. The Player sees the skill and the reason, never the DC.
_Avoid_: Roll request, skill roll, test

**Call**:
The DM's open request to a Player: a Check to roll, or a question, optionally with choices. It is kept in the Scene, so it survives a reload. Answering it lets the DM continue; a new Declaration withdraws it.
_Avoid_: Prompt, pending roll, modal, interrupt

**Narration**:
The prose the DM sends to the Players: description, outcome, or an NPC speaking in their own voice.
_Avoid_: Reply, response, output, message

**Event log**:
A Campaign's append-only record of play. Each entry is a typed event (a Declaration, Narration, a Call raised or answered, a Check and its roll, or a change a tool made to state), stamped with its Session and in-fiction time. It is the history of everything held as current state. It is never undone or edited: a correction is a new event.
_Avoid_: Transcript, history, chat

### Story

**Arc**:
The DM's plan for a Campaign's story, generated from its Campaign Seed: a title, a premise, the stakes, an ordered series of Acts, each holding Beats, and a resolution. A Campaign has at most one Arc, and how many Acts and Beats it holds scales with the Campaign's Length. It is a plan, not a script, and it is hidden from the Players. The DM may revise pending Beats during play; reached and abandoned Beats stay as history.
_Avoid_: Plot, storyline, script, outline

**Act**:
A named phase of an Arc, such as setup, escalation or climax, with a one-line purpose. It groups the Beats that belong to that phase. A one-shot's Arc has a single Act.
_Avoid_: Chapter, part

**Beat**:
A turning point or outcome the story should reach, with a title and a sentence or two of description, such as "the Characters learn the vizier is the cult's patron". It says what should become true, never how to get there. A Beat is not tied to one Session: a Session may reach several Beats or none. A Beat has a **Beat state**.
_Avoid_: Quest, objective, milestone

**Beat state**:
Whether a Beat is pending, reached or abandoned. A Beat leaves pending once and never returns. It is reached when play clearly established its outcome, and abandoned when the story made it impossible or irrelevant, or moved past its Act. The DM rules on it and code validates the change. The current Act is the Act of the first pending Beat, and the Arc is complete when no Beat is pending.
_Avoid_: Progress, status

### World and knowledge

**World**:
Everything that is true in a Campaign's fiction: its places, people, factions, history and lore. A Campaign has exactly one World, and a World belongs to exactly one Campaign. It is held in the World layer.
_Avoid_: Setting, universe, realm

**World layer**:
The record of what is true in the World: Entities, their Pages and Facts. Only the DM sees it.
_Avoid_: World memory, lore, canon

**Knowledge layer**:
The record of what each Holder believes: their Beliefs. It is the only place falsehood exists, and the only source of what a Player is shown about the World.
_Avoid_: Visibility, secrets, fog of war

**Entity**:
A named thing in the World: an NPC, a Place, a Faction or a Topic. Each has one Page and can be linked to other Entities. A Character can be linked to and can hold Beliefs, but is not an Entity.
_Avoid_: Node, record, object

**NPC**:
A non-player character in the World, run by the DM: a name, a short description, a role, a status (alive, dead, missing or departed) and where they are or were last seen. A dead NPC stays dead unless the story revives them for a stated reason. An NPC is an Entity and a Holder, never a Character.
_Avoid_: Character, monster, contact

**Place**:
A location in the World, with exits leading to other Places. An exit's destination stays open until someone first goes through it, so returning through it leads to the same Place. A Scene is set at a Place.
_Avoid_: Room, location, map

**Faction**:
An organised group in the World, such as a guild, a cult or a kingdom. What a Faction knows is the Beliefs of its NPCs; a Faction is never a Holder.
_Avoid_: Organisation, group

**Topic**:
An Entity for anything else that is worth a Page but has nothing code must enforce: an event, an artifact, a deity, a legend. It has a name, a Page and links, and becomes a typed Entity once code must enforce something about it.
_Avoid_: Misc, lore entry, note

**Page**:
The free prose about one Entity (personality, history, look, rumours), with links to other Entities. Every revision is kept. A Page never restates anything held as current state, and only the DM reads it.
_Avoid_: Note, description, wiki entry

**Fact**:
A discrete true claim about the World, such as "the vizier is the cult's patron". A Fact is never edited: it changes only by being superseded by a newer Fact, which the DM names, or retired. Each Fact records the in-fiction time it became true and stopped being true, and the Session and event that recorded it. A Fact is never false: lies and rumours are Beliefs.
_Avoid_: Lore, note, secret

**Retired**:
A Fact or Entity withdrawn as mistaken, with a reason. It stays on record but is no longer used. Retiring is separate from an NPC's status: a dead NPC is not retired.
_Avoid_: Deleted, archived, removed

**In-fiction time**:
The World's own clock: when things happen in the story, as distinct from when they were played. Facts and events are placed on it.
_Avoid_: Game time, date, timestamp

**Holder**:
Someone who can believe things: a Character or an NPC, and nothing else.
_Avoid_: Knower, owner, viewer

**Belief**:
What one Holder believes. It points at something in the World layer (a Fact, an Entity's existence, or a value as of when it was learned), or, for a lie or rumour, carries its own claim and source. A Belief that no longer matches the World is outdated, and the Holder keeps believing it until they learn otherwise. If a rumour turns out true, the DM establishes a Fact and the Belief points at it instead.
_Avoid_: Knowledge, memory, secret, clue

**Reveal**:
The DM making Holders learn something, which creates their Beliefs. By default the Holders are the Characters present in the Scene, and the DM can narrow or widen them. One Holder telling another is a Reveal with a source.
_Avoid_: Discover, share, unlock

**Journal**:
A Player's read-only view of what their Characters believe: the people, places and claims their Beliefs point at, each marked with which Character holds it. It never shows the World layer directly or anything an NPC believes.
_Avoid_: Codex, log, notes
