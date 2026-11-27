import { n as getQueryClientContext } from "./context.js";
// ../../../node_modules/.pnpm/@tanstack+svelte-query@6.3.7_svelte@5.57.3_@typescript-eslint+types@8.72.1_/node_modules/@tanstack/svelte-query/dist/useQueryClient.js
/**
* The `useQueryClient` function returns the current `QueryClient` instance.
* @param queryClient - Use this to use a custom `QueryClient`. Otherwise, the one from the nearest context will
* be used.
* @returns The current `QueryClient` instance.
* @throws {Error} If no `queryClient` argument is passed and no `QueryClientProvider` is found in the
* component tree.
* @example
* ```svelte
* <script lang="ts">
*   import { useQueryClient } from '@tanstack/svelte-query'
*
*   const queryClient = useQueryClient()
*
*   function refreshPosts() {
*     queryClient.invalidateQueries({ queryKey: ['posts'] })
*   }
* <\/script>
* ```
*/
function useQueryClient(queryClient) {
	if (queryClient) return queryClient;
	return getQueryClientContext();
}
export { useQueryClient as t };

//# sourceMappingURL=useQueryClient.js.map