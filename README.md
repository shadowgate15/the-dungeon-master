# The Dungeon Master

An AI Dungeon Master for Dungeons & Dragons. It runs the game, so players can just play.

This document is the project's North Star. It describes where we are headed and what is in scope right now, so every feature starts from the same place.

## Vision

A complete game-running system. A player opens a session in the UI and sees the game unfold: narrative descriptions, a map, their character, the state of the world. The AI runs everything behind it: narrating, voicing NPCs, adjudicating actions, and keeping the world consistent.

## Guiding principles

- **Deterministic code owns the rules and state.** Dice, HP, initiative, spell slots, inventory and every other mechanic live in code and the database. The database is the single source of truth.
- **The LLM owns narration and judgment.** It writes the story and makes calls with no fixed answer: NPC behavior, ruling on improvised actions, pacing. It never invents numbers or state. It calls tools, and the tools change state.
- **Local-first.** The app runs on the player's machine with SQLite and a local model, with no network dependency. The LLM sits behind a thin provider interface, so hosted backends can be swapped in later. No specific model is assumed.
- **Rules content is limited to the D&D 5e SRD 5.1** (CC-BY-4.0).

## Campaign lifecycle

1. The player asks the system to generate a campaign, optionally with parameters (tone, setting, length, etc.).
2. The system generates a campaign setting and an initial arc for the characters.
3. Play is improvised from there, in response to what the players do. The system keeps persistent memory of the story, NPCs and world.

## Current focus

- Solo play: one human player, with the AI as DM. The data model should not rule out multiple players.
- Text-first web app: a streaming narrative with side panels (character sheet, dice, combat tracker).
- D&D 5e on the SRD 5.1.

## Later (not goals right now)

- Map and richer visuals
- Voice
- Multiplayer
- Hosting and accounts
- Pre-written adventure modules
- The 2024 rules

## Stack

SvelteKit, TypeScript, Tailwind, Drizzle with SQLite (better-sqlite3), Vitest, Playwright, Storybook.

## Development

```sh
pnpm install
pnpm dev          # start the dev server
pnpm check        # type-check
pnpm lint         # prettier + eslint
pnpm test         # unit + e2e tests
pnpm storybook    # component workbench
```
