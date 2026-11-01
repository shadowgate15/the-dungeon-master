# The Dungeon Master

An AI Dungeon Master for D&D 5e. Deterministic code owns rules and state; the LLM owns narration and judgment.

## Language

**World**:
The lasting backdrop that stories happen in: its geography, nations, cities, history and the people who live there. A World is separate from any one story and can host many Campaigns.
_Avoid_: Setting, universe, realm

**Campaign**:
The top-level container for one story. It holds the player's chosen parameters and everything the story accumulates (player characters, session history, the arc). A Campaign is located in one or more Worlds (the players can travel between them), and a World can host many Campaigns.
_Avoid_: Game, adventure, save

**Campaign generation**:
The separate, server-run process that engages the AI to produce a Campaign's initial arc from its parameters and its World. Triggered by creating a Campaign, but not part of Campaign CRUD.
_Avoid_: Campaign creation, scaffolding

**Archive**:
Reversibly hiding a Campaign from the active list without destroying it.
_Avoid_: Soft delete

**Permanent delete**:
Irreversibly destroying a Campaign and everything it contains.
_Avoid_: Hard delete, purge
