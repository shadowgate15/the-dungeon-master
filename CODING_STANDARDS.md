# Coding standards

Conventions for this repo. Anything enforced by tooling (Prettier, ESLint, `svelte-check`) is not repeated here.

## TanStack Query

Use `@tanstack/svelte-query` for client-side reads of server state.

- **Create clients with `createQueryClient()`** from `src/lib/query/client.ts`. Never call `new QueryClient()` directly. The app layout, Storybook and tests all go through the factory.
- **Queries run in the browser only.** The factory sets `enabled: browser`, so nothing fetches during SSR and no cache is shared between requests. Don't prefetch in `load` functions unless a page needs it.
- **Keep TanStack's default options.** Don't change app-wide `staleTime` or `retry` in the factory. Tune them per query once we know how that data behaves, and treat local requests like any other network request.
- **Tests and stories disable retries.** Pass `{ queries: { retry: false } }` to the factory so failures surface immediately.
- **One client per story.** The Storybook global decorator provides a fresh client per story, so stories don't need their own `QueryClientProvider`. Devtools are not loaded in Storybook.
- **Devtools are dev-only.** `SvelteQueryDevtools` is loaded by dynamic import behind `dev` from `$app/env`, so it stays out of production builds.

## Tests

Server tests run on every check, so keep them cheap.

- **Never seed Rules Data in a test.** Seeding costs about 200ms a database. Make libraries with `testLibrary()` from `src/testing/library.ts` and in-memory databases with `openCampaignTestDatabase()`. Both start from a template that the server project's global setup seeds once per run. Don't call `migrateDatabase` or `seedRulesData` in a spec, or `createCampaignLibrary` without `initDatabase`, unless seeding is what the test is about.
- **Temporary directories come from `tempDir()`** in `src/testing/temp-dir.ts`. It deletes them after the test, or after the file when made in `beforeAll`. Don't call `mkdtempSync` directly.
- **Wait on a condition, not a duration.** Poll with a helper like `eventually()` until the state is reached. A fixed wait is only for showing that something _doesn't_ happen, and its comment says what it waits out.
- **Use fake timers for time in the test process.** Code that runs in the test's process and waits on a clock uses `vi.useFakeTimers()`. They can't reach child processes such as the bridge.
