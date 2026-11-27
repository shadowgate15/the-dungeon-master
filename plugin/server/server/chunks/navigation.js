import { n as noop, t as disallow_on_server } from "./functions.js";
// ../implement-spec-383/node_modules/.pnpm/@sveltejs+kit@3.1.1_@sveltejs+vite-plugin-svelte@7.3.1_svelte@5.57.3_@typescript-eslint_8cf52fe09df2de537dd906a98b5e1516/node_modules/@sveltejs/kit/src/runtime/app/navigation/server.js
var afterNavigate = noop;
var beforeNavigate = noop;
disallow_on_server("disableScrollHandling", "()");
var goto = disallow_on_server("goto");
disallow_on_server("invalidate");
disallow_on_server("invalidateAll", "()");
disallow_on_server("refreshAll", "()");
disallow_on_server("preloadCode");
disallow_on_server("preloadData");
disallow_on_server("pushState");
var replaceState = disallow_on_server("replaceState");
export { replaceState as i, beforeNavigate as n, goto as r, afterNavigate as t };

//# sourceMappingURL=navigation.js.map