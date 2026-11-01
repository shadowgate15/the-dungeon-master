# Coding standards

Conventions for this repo. Anything enforced by tooling (Prettier, ESLint, `svelte-check`) is not repeated here.

## TanStack Query

Client-side server state uses `@tanstack/svelte-query`.

- **Create clients with `createQueryClient()`** from `src/lib/query/client.ts`. Never call `new QueryClient()` directly. The app layout, Storybook and tests all go through the factory.
- **Queries run in the browser only.** The factory sets `enabled: browser`, so nothing fetches during SSR and no cache is shared between requests. Don't prefetch in `load` functions unless a page needs it.
- **Keep TanStack's default options.** Don't change app-wide `staleTime` or `retry` in the factory. Tune them per query once we know how that data behaves, and treat local requests like any other network request.
- **Tests and stories disable retries.** Pass `{ queries: { retry: false } }` to the factory so failures surface immediately.
- **One client per story.** The Storybook global decorator provides a fresh client per story, so stories don't need their own `QueryClientProvider`. Devtools are not loaded in Storybook.
- **Devtools are dev-only.** `SvelteQueryDevtools` is loaded by dynamic import behind `dev` from `$app/env`, so it stays out of production builds.
