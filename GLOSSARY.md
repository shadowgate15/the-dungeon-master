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
The live, directly editable form that holds the Seed while a World or a Campaign is being created or edited. It is the source of truth and works with no AI. For a World, the AI writes into it only through a Field AI control, one field per click; for a Campaign, nothing reaches it from the AI until the player accepts a proposal.
_Avoid_: World form, draft

**Proposal** / **proposal card**:
A suggested value for one Seed field, offered by the AI in the creation conversation and shown as a card the player can accept or dismiss. A newer proposal for the same field supersedes an older pending one. A proposal changes nothing until accepted.
_Avoid_: Suggestion, draft

**Creation conversation**:
The chat beside the Campaign Seed card, or beside the Character creation wizard, in which the player talks through a Campaign or a Character with the AI and receives Proposals (and, for Characters, Roll cards). It is also used when editing an existing Campaign or Character. Worlds no longer have one: they use Field AI controls. Its transcript lives only in the browser and is discarded when the World, Campaign or Character is saved or abandoned; nothing is stored.
_Avoid_: Chat history, session

**Field AI control**:
The pair of small icon buttons at a form field's corner: ✦ Generate and ✎ Give feedback. Each click is one stateless call that writes or revises that field alone, straight into the form, with no history kept between calls. While it runs the field is read-only and the pair becomes a Stop button; other fields stay usable and may run at the same time. The buttons are disabled, with the reason shown, when AI is unavailable or locked, and Give feedback is disabled while the field is empty. Replaces the Creation conversation for Worlds.
_Avoid_: AI button, magic wand

**Feedback note**:
The short instruction a player types in the Field AI control's popover to say what should change in a field's current value ("darker", "shorter"). It is sent with the current value for one revision and is not remembered afterwards.
_Avoid_: Prompt, comment

**Field Undo**:
The one-step Undo offered after a Field AI control writes a field, restoring the value it replaced. It belongs to that field alone and expires as soon as the player edits the field by hand.
_Avoid_: History, revert

**Campaign**:
A story played out in one or more Worlds. A Campaign is always linked to at least one World, and Worlds can be added or removed over its life as long as one remains. A Campaign is either active or archived.
_Avoid_: Adventure, game, session

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
How much story a Campaign is meant to hold, one of: one-shot, short, medium, long. Ordered shortest to longest. one-shot is a single sitting; short is a few sessions; medium is a season of play; long is an open-ended saga. It measures story scope, not hours or session counts. The AI uses it to pace how much story to plan.
_Avoid_: Duration, session count, size

**Character**:
A player's hero, created at level 1 from the D&D 5e SRD 5.1 and stored as the player's choices only: race, class, background, ability scores, picked skills, spells and equipment, and narrative details. Everything computed from those choices (modifiers, hit points, armor class, saves, spell slots) is derived and never stored. A Character stands alone, owned by the player, and is linked to Campaigns separately. A Character is either active or archived.
_Avoid_: Player character sheet, PC, hero, avatar

**Archived Character**:
A Character set aside by its author. It is hidden from the main Character list, shown under the Archived view, and is read-only until restored: it can be viewed but not edited. Archiving is reversible; deleting a Character is not. Unlike a Campaign, a Character depends on nothing, so nothing else, including anything about its Campaigns, can make it read-only.
_Avoid_: Disabled Character, hidden Character, retired Character

**Character creation wizard**:
The step-by-step flow in which a player builds a Character: Concept (name, race, class, background and personal details), ability scores, skills and proficiencies, equipment, spells (only for classes that cast at level 1), then review and save. Concept must be valid before the later steps open, and a Character can only be saved once every step is valid. The player may revisit and change an earlier step; choices that no longer fit are flagged, not removed. The same wizard is used to edit an existing Character.
_Avoid_: Character form, character builder

**Character draft**:
The unsaved state of a Character while the wizard is open. It lives only in the browser and is discarded on abandon or reload; nothing is stored until the Character is saved.
_Avoid_: Saved draft, work in progress

**Ability Score Method**:
One of the three ways a Character's six base ability scores are set: **standard array** (the fixed values 15, 14, 13, 12, 10, 8, each assigned to one ability), **point buy** (a 27-point budget spent on scores from 8 to 15, up to the budget) or **rolling** (six rolls of four six-sided dice with the lowest dropped, assigned freely). None of the three is in the SRD; they are rules the app defines itself. The player chooses the method and the assignment; the AI may only propose which method and how to arrange the values, never the values themselves or a roll. Code makes any rolls and the Character keeps the rolled dice, so the assigned scores can be checked against them. Racial bonuses are applied on top of the base scores, never part of them.
_Avoid_: Stat generation, stat roll

**Roll card**:
A set of six ability score rolls made by code at the AI's request during the Creation conversation and shown as a card the player can accept or dismiss. Accepting it records it as the Character's rolled set, replacing any earlier one; dismissing it discards it. Like a Proposal, it changes nothing until accepted.
_Avoid_: AI roll, dice result

**Background**:
A Character's history before adventuring. It grants two skill proficiencies, two tool or language proficiencies, a feature and a starting equipment package, and carries the Character's personality trait, ideal, bond and flaw. A Character has exactly one. The choices are Acolyte, the only background the SRD ships, or a Custom background.
_Avoid_: Origin, past, profession

**Custom background**:
A Background the player builds from the SRD's customization rule rather than choosing Acolyte: a name, two skill proficiencies and two tool or language proficiencies (picked by the player, with code enforcing the counts and the rule that a duplicate proficiency must be replaced by another of the same kind), a feature written as narrative text with no mechanics, and a fixed equipment package. The AI may propose any of these as Proposals; nothing counts until the player accepts.
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
