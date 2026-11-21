# The Dungeon Master

An AI Dungeon Master for D&D 5e. Deterministic code owns rules and state; the LLM owns narration and judgment.

## Language

**World**:
The lasting, standalone foundation that Campaigns are set in. A World exists before any Campaign and is the basis from which its history, lore, geography, nations and people come. A World can host many Campaigns, and a Campaign can span many Worlds. Because Worlds are shared across Campaigns, what happens in one Campaign can carry over into another.
_Avoid_: Setting, universe, realm

**Archived World**:
A World set aside by its author. It is hidden from the World list and cannot be chosen for new Campaigns, and it cannot be edited. Campaigns that use it are read-only until it is restored. Archiving is reversible; deleting a World is not.
_Avoid_: Disabled World, hidden World

**Seed**:
The small set of choices a World is created from: a name, a premise, and four enumerated fields, **genre flavor** (e.g. high fantasy, gothic horror), **scale** (single region up to planar), **magic level** (none up to ubiquitous) and **tech level** (stone age up to futuristic). Any field may be left unspecified. The seed is the starting point for a World, not the World itself.
_Avoid_: Template, config

**Seed card**:
The live, directly editable form that holds the Seed while a World or a Campaign is being created or edited. It is the source of truth and works with no AI. The AI writes into it only through a Field AI control, one field per click.
_Avoid_: World form, draft

**Field AI control**:
The pair of small icon buttons at a form field's corner: ✦ Generate and ✎ Give feedback. Each click is one stateless call that writes or revises that field alone, straight into the form, with no history kept between calls. While it runs the field is read-only and the pair becomes a Stop button; other fields stay usable and may run at the same time. The buttons are disabled, with the reason shown, when AI is unavailable or locked, and Give feedback is disabled while the field is empty. It is the only way the AI takes part in creating a World, a Campaign or a Character.
_Avoid_: AI button, magic wand

**Feedback note**:
The short instruction a player types in the Field AI control's popover to say what should change in a field's current value ("darker", "shorter"). It is sent with the current value for one revision and is not remembered afterwards.
_Avoid_: Prompt, comment

**Field Undo**:
The one-step Undo offered after a Field AI control writes a field, restoring the value it replaced. It belongs to that field alone and expires as soon as the player edits the field by hand.
_Avoid_: History, revert

**Campaign**:
A story played out in one or more Worlds. A Campaign is always linked to at least one World, and Worlds can be added or removed over its life as long as one remains. A Campaign is either active or archived.
_Avoid_: Adventure, game

**Archived Campaign**:
A Campaign set aside by its author. It is hidden from the main Campaign list and is read-only until restored. Archiving is reversible; deleting a Campaign is not. A Campaign is also read-only, without being archived, while any World it uses is archived.
_Avoid_: Disabled Campaign, hidden Campaign, finished Campaign

**Campaign Seed**:
The set of choices a Campaign is created from: a name, a premise, a **tone** and a **length**, all required, plus the Worlds it is set in. Like a World's Seed, it is the starting point for a Campaign, not the Campaign itself. The Campaign's Worlds are chosen by the player and never proposed by the AI.
_Avoid_: Campaign template, campaign config

**Tone**:
The mood of play a Campaign aims for, one of: heroic, lighthearted, tense, dark, mysterious, epic. Unordered. It describes how play feels, not the setting (that is a World's genre flavor). The AI uses it to set mood and register when narrating and proposing.
_Avoid_: Genre, theme, style

**Length**:
How much story a Campaign is meant to hold, one of: one-shot, short, medium, long. Ordered shortest to longest. one-shot is a single sitting; short is a few Sessions; medium is a season of play; long is an open-ended saga. It measures story scope, not hours or session counts. The AI uses it to pace how much story to plan.
_Avoid_: Duration, Session count, size

**Character**:
A player's hero, created at level 1 from the D&D 5e SRD 5.1 and stored as the player's choices only: race, class, background, ability scores, picked skills, spells and equipment, and narrative details. Everything computed from those choices (modifiers, hit points, armor class, saves, spell slots) is derived and never stored. A Character stands alone, owned by the player, and is linked to Campaigns separately. A Character is either active or archived.
_Avoid_: Player character sheet, PC, hero, avatar

**Archived Character**:
A Character set aside by its author. It is hidden from the main Character list, shown under the Archived view, and is read-only until restored: it can be viewed but not edited. Archiving is reversible; deleting a Character is not, and a Character that has played any Session cannot be deleted (archive it instead), so Session transcripts are never lost. Unlike a Campaign, a Character depends on nothing, so nothing else, including anything about its Campaigns, can make it read-only.
_Avoid_: Disabled Character, hidden Character, retired Character

**Character creation wizard**:
The step-by-step flow in which a player builds a Character: Concept (name, race, class, background and personal details), ability scores, skills and proficiencies, equipment, spells (only for classes that cast at level 1), then review and save. Concept must be valid before the later steps open, and a Character can only be saved once every step is valid. The player may revisit and change an earlier step; choices that no longer fit are flagged, not removed. The same wizard is used to edit an existing Character.
_Avoid_: Character form, character builder

**Character draft**:
The unsaved state of a Character while the wizard is open. It lives only in the browser and is discarded on abandon or reload; nothing is stored until the Character is saved.
_Avoid_: Saved draft, work in progress

**Ability Score Method**:
One of the three ways a Character's six base ability scores are set: **standard array** (the fixed values 15, 14, 13, 12, 10, 8, each assigned to one ability), **point buy** (a 27-point budget spent on scores from 8 to 15, up to the budget) or **rolling** (six rolls of four six-sided dice with the lowest dropped, assigned freely). None of the three is in the SRD; they are rules the app defines itself. The player chooses the method and the assignment; the AI never chooses the method. Through a Field AI control it may only arrange the values the chosen method gives (the fixed array, or the rolled set) across the abilities, or spend the point-buy budget, never invent values. Code makes any rolls and the Character keeps the rolled dice, so the assigned scores can be checked against them. Racial bonuses are applied on top of the base scores, never part of them.
_Avoid_: Stat generation, stat roll

**Rolled set**:
The six ability score totals produced by the player's roll under the rolling Ability Score Method: code rolls four six-sided dice per total and drops the lowest. The Character keeps the dice, and a new roll replaces the earlier set. The AI never rolls; it may only arrange a set the player already rolled.
_Avoid_: Dice result

**Background**:
A Character's history before adventuring. It grants two skill proficiencies, two tool or language proficiencies, a feature and a starting equipment package, and carries the Character's personality trait, ideal, bond and flaw. A Character has exactly one. The choices are Acolyte, the only background the SRD ships, or a Custom background.
_Avoid_: Origin, past, profession

**Custom background**:
A Background the player builds from the SRD's customization rule rather than choosing Acolyte: a name, two skill proficiencies and two tool or language proficiencies (picked by the player, with code enforcing the counts and the rule that a duplicate proficiency must be replaced by another of the same kind), a feature written as narrative text with no mechanics, and a fixed equipment package. The AI can write the name and the feature text, one field at a time, through a Field AI control; the player picks the proficiencies.
_Avoid_: Homebrew background, new background

**Feature choice**:
A decision a race, subrace, class, subclass or background leaves to the player, such as a Dwarf's tool proficiency, a Fighter's fighting style, a Dragonborn's draconic ancestry or a Half-Elf's bonus abilities. Each one belongs to a named group with a fixed number of picks and a set of options. Fixed benefits that need no decision are granted automatically and are not choices.
_Avoid_: Option, trait pick, perk

**Equipment choice group**:
One of the "this or that" choices in a class's starting equipment, such as "a greataxe or any martial melee weapon". The player picks one option per group, and where an option allows any weapon or instrument of a kind, picks the specific item. Options can be unavailable when the Character lacks the proficiency they require. Items a class or background gives with no choice are not part of any group.
_Avoid_: Loadout, kit

**Granted spell**:
A spell a Character has for free from race, subrace or subclass, such as Tiefling's thaumaturgy. It is shown beside the Character's chosen spells but is never one of them: it does not count against the class's cantrip or spell numbers.
_Avoid_: Bonus spell, free spell

**Rules Data**:
The D&D 5e SRD 5.1 reference content (races, classes, backgrounds, spells, equipment and so on) held in the database. It is read-only to the app and seeded from a pinned dataset. Characters refer to it rather than copy it.
_Avoid_: Reference data, compendium

**Session**:
One sitting of play within a Campaign, played by one Character. It has a start and an end and owns an Event log and a Scene. A Campaign has many Sessions but at most one open at a time. An open Session can be resumed; an ended one is read-only.
_Avoid_: Game, run, playthrough

**Scene**:
Where and how play stands right now, owned by code and stored in the database: the current location (name and description), its exits and notable objects, the NPCs present (each with an attitude and a short knowledge note), the active Mode and any open Call. The UI renders it beside the story, so the player never scrolls the log to learn where they are or who is here. Only code changes it, applying choices it has validated; the AI never edits it freely. A Scene is a situation, not a story unit: it is not a Beat.
_Avoid_: Room, location, state

**Mode**:
The kind of play a Scene is in, one of exploration or dialogue. It shapes how a Declaration is read (in dialogue, the player's words are speech to the NPC being spoken to) and who voices the Reply, but never who receives the Declaration: the player always talks to the DM. It sets the layout's emphasis. Code changes it only by applying an Effect. A Call is an overlay on any Mode, not a Mode.
_Avoid_: State, phase, screen

**Declaration**:
What the player says their Character does or says, in free text or by clicking something in the Scene. Free text is always accepted, even while a Call is open.
_Avoid_: Action, command, input, move

**Exchange**:
The unit of play: one Declaration, adjudicated, applied and answered, after which the floor returns to the player. Its steps are always Adjudication, then an Effect if the Declaration happened or its Check succeeded, then a Reply. It may pause on a Call and resumes when the Call is answered.
_Avoid_: Turn, run, round

**Adjudication**:
The DM's ruling on a Declaration, one of: it happens, it is impossible, it is uncertain and needs a Check, or it is unclear and needs a question. The AI rules; code acts on the ruling. An answer to a question is merged into the Declaration, which is adjudicated again.
_Avoid_: Director, decision, resolution

**Check**:
A d20 roll plus the Character's modifier for one skill or saving throw, against a DC. Adjudication names the skill or save and a difficulty tier (easy, medium, hard or very hard); code turns the tier into the SRD DC and rolls. The player sees the skill and the reason, never the DC.
_Avoid_: Roll request, skill roll, test

**Effect**:
The one change to the Scene that a Declaration causes when it happens or its Check succeeds: none, moving through an exit, or beginning or ending a conversation with a present NPC. The AI picks from the options the current Scene allows, and code validates and applies it. A failed Check has no Effect.
_Avoid_: Consequence, outcome, state change

**Reply**:
The prose that ends every Exchange, including impossible Declarations and failed Checks. Code picks the voice by Mode: in dialogue the NPC being spoken to answers, otherwise the Narrator.
_Avoid_: Response, output, narration step

**Call**:
The DM's open request to the player that pauses an Exchange: a Check to roll, or a question, optionally with choices. It is kept in the Scene, so it survives a reload. Answering it resumes the Exchange; a new Declaration withdraws it.
_Avoid_: Prompt, pending roll, modal, interrupt

**Event log**:
A Session's append-only record of play, replacing a transcript of alternating exchanges. Each entry is a typed event (Declaration, narration, NPC line, Call raised, Call answered, scene changed, mode changed) tagged with the role that produced it. Streamed text lives inside one event. An event cut short by Stop or a model failure is discarded, never kept as partial text. An Exchange that ends in a model error is undone: the Scene goes back to how it was and the log back to before the Exchange's first event, so its Declaration goes too (the player's text stays in the input) and a Call it withdrew or answered is open again. Stopping an answered question before its Reply starts undoes it the same way, so the question stays open.
_Avoid_: Transcript, history, chat

**Arc**:
The planned shape of a Campaign's story, generated from its Campaign Seed: a title, a premise, the stakes, an ordered series of Acts, each holding Beats, and a resolution. A Campaign has at most one Arc, and regenerating it replaces the old one. How many Acts and Beats it holds scales with the Campaign's Length. It is the player's plan for the story, not a script. The player can review, edit and regenerate it on the Campaign page until the Campaign's first Session is created; the Arc must be accepted before a Session can start, and it is read-only from then on. The Narrator steers by it, seeing the current Act and its open Beats.
_Avoid_: Plot, storyline, script, outline

**Act**:
A named phase of an Arc, such as setup, escalation or climax, with a one-line purpose. It groups the Beats that belong to that phase. A one-shot's Arc has a single Act.
_Avoid_: Chapter, part

**Beat**:
A turning point or outcome the story should reach, with a title and a sentence or two of description, such as "the Characters learn the vizier is the cult's patron". It says what should become true, never how to get there. A Beat is not tied to one Session: a Session may reach several Beats or none. A Beat has a **Beat state**.
_Avoid_: Quest, objective, milestone

**Beat state**:
Whether a Beat is pending, reached or abandoned. A Beat leaves pending once and never returns. It is reached when play clearly established its outcome, and abandoned when the story made it impossible or irrelevant, or moved past its Act. Code validates and applies every change; the player never edits it. The current Act is the Act of the first pending Beat, and the Arc is complete when no Beat is pending.
_Avoid_: Progress, status

**Arc lock**:
The rule that an Arc must be accepted before a Campaign's first Session starts, and is read-only from then on, so Beat state stays meaningful. The Campaign's linked Character is locked in the same way once its first Session exists.
_Avoid_: Freeze, finalize

**World memory**:
The structured, Campaign-scoped record of what the DM has established: places, NPCs and facts, with factions and events to follow once something writes them. Code validates and stores it, and the AI only proposes changes to it; code applies them. Records are never deleted, only retired, and each carries the Session and event it was created and last changed in. A place belongs to one of the Campaign's Worlds. Nothing carries over between Campaigns, even in a shared World.
_Avoid_: Lore, state, notes

**Place**:
A location the story has established, with a name, a description and exits leading to other places. An exit's destination stays open until someone first goes through it, so returning through it leads to the same place. A Scene is set at a place. A place is World memory.
_Avoid_: Room, location, map

**Fact**:
A short claim the story has established, such as "the vizier is the cult's patron", optionally marked as having changed the world itself. A fact is never edited: it changes only by being superseded by a newer fact or retired as mistaken. A fact is World memory.
_Avoid_: Lore, note, secret

**Retired**:
A World memory record withdrawn as mistaken or no longer relevant, with a reason. It stays on record but is no longer used. Retiring is separate from an NPC's status: a dead NPC is not retired.
_Avoid_: Deleted, archived, removed

**NPC**:
A non-player character the DM has introduced: a name, a short description, a role and a status (alive, dead, missing or departed). A dead NPC stays dead unless the story explicitly revives them for a stated reason. An NPC is placed at a place, which is where they are or were last seen. An NPC is World memory, not a Character.
_Avoid_: Character, monster, contact

**NPC memory**:
What is remembered about one NPC beyond who they are: their **disposition** toward a Character: a **stance** (hostile, wary, neutral, friendly or allied) plus a short note. "Stance" names that enum, the part the Journal shows; "disposition" names the whole record and the facts they know. Disposition belongs to the pair of NPC and Character; facts stay in World memory and are never copied per Character. A Scene's attitude for an NPC is the same stance, shown in the Scene.
_Avoid_: Relationship score, reputation

**World memory selection**:
Choosing which World memory the Narrator sees in an Exchange, within a fixed budget. The **core** is always included: the Scene's NPCs and place, the facts marked as changing the world, and one compact line naming the dead or retired. Everything else is **scored** each Exchange by being named in recent history, being linked to an NPC in the Scene, and having changed recently, and is trimmed lowest score first. It is a pure function of the records, the history text and the budget. The Narrator sees selected facts but never what an individual NPC knows.
_Avoid_: Retrieval, context stuffing, RAG

**Rolling summary**:
A short prose account of a Session's earlier events, kept so the Narrator can continue once the Event log outgrows its context. A separate model call writes it, not the Narrator, merging the previous summary with newly covered events, so it is rewritten rather than appended and stays bounded. It carries story and never numbers, which code and the database own. Its **watermark** is the last event it covers: events after the watermark are shown verbatim, and the watermark moves only when a summary succeeds. A Session's last summary is what the next Session's "Previously" recap shows.
_Avoid_: Recap, compaction, memory

**Journal**:
The player's read-only view of World memory, pure code with no model call: People, Places and Facts, grouped by the Session they first appeared in, newest first. An NPC appears only once the player has met them (in a Scene or in the story) and shows name, role, status and stance toward the playing Character only, never what they know. It cannot be edited.
_Avoid_: Codex, log, notes
