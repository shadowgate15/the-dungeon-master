# Dev tooling may call the `claude` CLI directly

Status: accepted.

`CODING_STANDARDS.md` sends all AI work through TanStack AI and keeps providers behind the chat port. The dev-only "Report an issue" button is an exception: it writes the issue title by running `claude -p` (haiku, no tools, from a temp directory) on the developer's own machine. It is a developer tool, not a feature of the game, so it has no business with the game's configured provider or model, which may be a small local one that writes poor titles, and it should work with nothing configured. It already shells out to `gh` for the same reason: it borrows the developer's own login. A failure never blocks filing: the title falls back to the description's first line.

## Consequences

- The exception covers dev-only tooling that never ships. Anything the player's game depends on still goes through the chat port.
- The model name (`haiku`) is a developer-tool choice, not a statement about which models the game supports.
