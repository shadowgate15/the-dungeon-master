import "./server2.js";
import "./index-server.js";
import "./context.js";
import { t as useQueryClient } from "./useQueryClient.js";
// ../../../node_modules/.pnpm/@tanstack+svelte-query-devtools@6.3.7_@tanstack+svelte-query@6.3.7_svelte@5.57.3_@types_8ea849ea8105e537a5386474a23c1746/node_modules/@tanstack/svelte-query-devtools/dist/Devtools.svelte
function Devtools($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		/**
		* Set this true if you want the dev tools to default to being open
		*/
		/**
		* The position of the TanStack logo to open and close the devtools panel.
		* 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'relative'
		*
		* @defaultValue bottom-right
		*/
		/**
		* The position of the Svelte Query devtools panel.
		* 'top' | 'bottom' | 'left' | 'right'
		*
		* @defaultValue bottom
		*/
		/**
		* Custom instance of QueryClient
		*/
		/**
		* Use this so you can define custom errors that can be shown in the devtools.
		*/
		/**
		* Use this to pass a nonce to the style tag that is added to the document head. This is useful if you are using a Content Security Policy (CSP) nonce to allow inline styles.
		*/
		/**
		* Use this to pass a shadow DOM target to the devtools so that the styles will be applied
		* within the shadow DOM instead of within the head tag in the light DOM.
		*/
		/**
		* Set this to true to hide disabled queries from the devtools panel.
		*/
		/**
		* Set this to 'light', 'dark', or 'system' to change the theme of the devtools panel.
		* This overrides the theme selected in the devtools Settings menu. When omitted, the
		* selected theme is used, or `'system'` if none is selected.
		*/
		let { initialIsOpen = false, buttonPosition = "bottom-right", position = "bottom", client = useQueryClient(), errorTypes = [], styleNonce = void 0, shadowDOMTarget = void 0, hideDisabledQueries = false, theme } = $$props;
		$$renderer.push(`<div class="tsqd-parent-container"></div>`);
	});
}
export { Devtools as SvelteQueryDevtools };

//# sourceMappingURL=dist.js.map