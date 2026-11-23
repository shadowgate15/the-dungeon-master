import { h as ssr_context } from "./server2.js";
// node_modules/.pnpm/svelte@5.57.3_@typescript-eslint+types@8.72.1/node_modules/svelte/src/index-server.js
/** @import { SSRContext } from '#server' */
/** @import { Renderer } from './internal/server/renderer.js' */
/** @param {() => void} fn */
function onDestroy(fn) {
	/** @type {Renderer} */ ssr_context.r.on_destroy(fn);
}
export { onDestroy as t };

//# sourceMappingURL=index-server.js.map