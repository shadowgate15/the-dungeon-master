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
