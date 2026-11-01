# The Dungeon Master

An AI Dungeon Master for D&D 5e. Deterministic code owns rules and state; the LLM owns narration and judgment.

## Language

**World**:
The lasting, standalone foundation that Campaigns are set in. A World exists before any Campaign and is the basis from which its history, lore, geography, nations and people come. A World can host many Campaigns, and each Campaign belongs to exactly one World.
_Avoid_: Setting, universe, realm

**Seed**:
The foundational description of a World: its name and the few choices (premise, genre flavor, scale, magic level, tech level) that later generation reads from.
_Avoid_: Config, template, settings

**Proposal**:
A value the AI suggests for one or more fields of a Seed. It changes nothing until the user accepts it.
_Avoid_: Suggestion, draft, generation
