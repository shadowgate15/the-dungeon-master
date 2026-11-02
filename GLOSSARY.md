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
The live, directly editable form that holds the Seed while a World is being created. It is the source of truth and works with no AI. Nothing reaches it from the AI until the player accepts a proposal.
_Avoid_: World form, draft

**Proposal** / **proposal card**:
A suggested value for one Seed field, offered by the AI in the creation conversation and shown as a card the player can accept or dismiss. A newer proposal for the same field supersedes an older pending one. A proposal changes nothing until accepted.
_Avoid_: Suggestion, draft

**Creation conversation**:
The chat beside the Seed card in which the player talks through a World with the AI and receives Proposals. Its transcript lives only in the browser and is discarded when the World is created or abandoned; nothing is stored.
_Avoid_: Chat history, session

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
