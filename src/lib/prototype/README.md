# PROTOTYPE: scene director (throwaway)

Do not merge. Lives on the `prototype/scene-director` branch as a primary source.

## The question

Does a state-driven, scene-and-mode session, run by a code-owned pipeline of narrow model calls
(Director, Narrator, NPC voice), feel better to play than a chat transcript of alternating Turns,
and does it stay coherent on a weak local model?

## Judging questions (play ~15 minutes on a real local model)

1. Do I always know where I am and who is here without scrolling?
2. Is NPC dialogue better when a separate NPC call writes it?
3. Does the pipeline stay coherent: few director fallbacks, rarely hitting the step cap?
   (The debug panel logs retries, fallbacks and cap hits per run.)

## Run it

```sh
pnpm prototype          # opens /prototype/scene
```

- Real model: set `LM_STUDIO_MODEL` (and `LM_STUDIO_BASE_URL`) in `.env`, untick "Fake backend".
- Fake backend: scripted, fast, misbehaves on purpose (garbage director answers) to exercise
  retry and fallback. Default when no model is configured.
- Layouts: `?variant=A` (location hero + log), `B` (visual-novel stage), `C` (dashboard). Arrow
  keys switch too.

## Shape

- Server (`src/lib/server/prototype/`): in-memory world, typed event log, director menu built
  from state, one retry then a code fallback, yield on director pick, step cap, or roll request.
  `POST /api/prototype/step` streams NDJSON; `POST /api/prototype/reset` resets.
- Client (`src/lib/prototype/`): one `SceneStore` shared by all three variants.

## Deliberately deferred

Combat and its mode; Journal, recap and rolling summary under an event log; Memory extraction
(may become redundant); quests, time and inventory in scene state; per-role model overrides;
multiplayer; map and visuals beyond the layouts. Glossary terms (Turn, Roll request, Roll result)
are not final.
