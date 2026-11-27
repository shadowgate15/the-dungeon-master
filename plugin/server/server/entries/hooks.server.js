import { c as SOLO_PLAYER } from "../chunks/enums2.js";
import { r as isStoredTheme, t as THEME_COOKIE } from "../chunks/theme.js";
// src/hooks.server.ts
var handle = async ({ event, resolve }) => {
	if (!fromLocalhost(event.request, event.url)) return new Response("Forbidden", { status: 403 });
	event.locals.browser = SOLO_PLAYER;
	const theme = event.cookies.get(THEME_COOKIE);
	const attr = isStoredTheme(theme) ? `data-theme="${theme}"` : "";
	return resolve(event, { transformPageChunk: ({ html }) => html.replace("%app.theme%", attr) });
};
var LOCAL_HOSTNAMES = /* @__PURE__ */ new Set([
	"localhost",
	"127.0.0.1",
	"[::1]"
]);
function isLocal(host) {
	if (!host) return false;
	try {
		return LOCAL_HOSTNAMES.has(new URL(`http://${host}`).hostname);
	} catch {
		return false;
	}
}
/**
* The browser routes are only for a page served from this machine: a request whose Host is
* another name (a DNS-rebound page) is refused, and so is a write whose Origin is another site.
* The bridge routes carry their own token check, so they are left to it.
*/
function fromLocalhost(request, url) {
	if (url.pathname.startsWith("/api/bridge/")) return true;
	const host = request.headers.get("host");
	if (!isLocal(host)) return false;
	const origin = request.headers.get("origin");
	if (request.method === "GET" || request.method === "HEAD" || !origin) return true;
	try {
		return new URL(origin).host === host;
	} catch {
		return false;
	}
}
var init = async () => {
	const { announceServer } = await import("../chunks/bridge2.js");
	announceServer();
};
export { handle, init };

//# sourceMappingURL=hooks.server.js.map