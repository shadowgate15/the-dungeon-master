# Coding standards

Conventions for this repo. Anything enforced by tooling (Prettier, ESLint, `svelte-check`) is not repeated here.

## TanStack AI

Use TanStack AI (`@tanstack/ai` and its adapters) for all AI work: model calls, streaming, tool calling, and the transport that carries a stream to the browser.

- **Reach for its helpers before hand-rolling.** Use `chat()` for calls and its response helpers (such as `toServerSentEventsResponse`) and client connection adapters for streaming. Don't write our own stream framing or provider clients.
- **Providers stay behind the seam.** Only `src/lib/server/ai/adapter.ts` imports a provider adapter; everything else goes through the chat port.
- **Check its docs first.** When a need isn't covered by what the port exposes, look for a TanStack AI feature before building around it.

## TanStack Query

Use `@tanstack/svelte-query` for client-side reads of server state.

- **Create clients with `createQueryClient()`** from `src/lib/query/client.ts`. Never call `new QueryClient()` directly. The app layout, Storybook and tests all go through the factory.
- **Queries run in the browser only.** The factory sets `enabled: browser`, so nothing fetches during SSR and no cache is shared between requests. Don't prefetch in `load` functions unless a page needs it.
- **Keep TanStack's default options.** Don't change app-wide `staleTime` or `retry` in the factory. Tune them per query once we know how that data behaves, and treat local requests like any other network request.
- **Tests and stories disable retries.** Pass `{ queries: { retry: false } }` to the factory so failures surface immediately.
- **One client per story.** The Storybook global decorator provides a fresh client per story, so stories don't need their own `QueryClientProvider`. Devtools are not loaded in Storybook.
- **Devtools are dev-only.** `SvelteQueryDevtools` is loaded by dynamic import behind `dev` from `$app/env`, so it stays out of production builds.
