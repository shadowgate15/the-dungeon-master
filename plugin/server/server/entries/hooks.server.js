import { c as SOLO_PLAYER } from "../chunks/enums2.js";
import { n as remoteMayReach, t as lanAccess } from "../chunks/lan-access.js";
import { r as isStoredTheme, t as THEME_COOKIE } from "../chunks/theme.js";
import { randomUUID } from "node:crypto";
// src/hooks.server.ts
var TEN_YEARS = 31536e4;
var BROWSER_COOKIE = "browser";
var BROWSER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
var WAITING_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="refresh" content="5"><meta name="viewport" content="width=device-width, initial-scale=1"><title>The Dungeon Master</title></head><body><main><h1>The Dungeon Master</h1><p>We are waiting for the Host to open a Campaign.</p></main></body></html>`;
var handle = async ({ event, resolve }) => {
	const { request, url } = event;
	if (!url.pathname.startsWith("/api/bridge/")) {
		const host = request.headers.get("host");
		const local = isLocal(host);
		if (!local && !lanAccess.lan) return new Response("Forbidden", { status: 403 });
		if (!sameSite(request, host)) return new Response("Forbidden", { status: 403 });
		if (local) event.locals.browser = SOLO_PLAYER;
		else {
			const campaign = lanAccess.campaign;
			if (!campaign) return new Response(WAITING_PAGE, {
				status: 503,
				headers: {
					"content-type": "text/html; charset=utf-8",
					"retry-after": "5"
				}
			});
			if (url.pathname === "/") return new Response(null, {
				status: 303,
				headers: { location: `/campaigns/${campaign}` }
			});
			if (!remoteMayReach(url.pathname, campaign)) return new Response("Forbidden", { status: 403 });
			event.locals.browser = remoteBrowserId(event.cookies);
		}
	} else event.locals.browser = SOLO_PLAYER;
	const theme = event.cookies.get(THEME_COOKIE);
	const attr = isStoredTheme(theme) ? `data-theme="${theme}"` : "";
	return resolve(event, { transformPageChunk: ({ html }) => html.replace("%app.theme%", attr) });
};
/**
* A remote browser is known by a random id in a long-lived cookie. It is explicitly not `Secure`:
* the LAN serves plain HTTP, and a `Secure` cookie would never come back.
*/
function remoteBrowserId(cookies) {
	const existing = cookies.get(BROWSER_COOKIE);
	if (existing && BROWSER_ID.test(existing)) return existing;
	const id = randomUUID();
	cookies.set(BROWSER_COOKIE, id, {
		path: "/",
		httpOnly: true,
		sameSite: "lax",
		secure: false,
		maxAge: TEN_YEARS
	});
	return id;
}
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
/** A write whose Origin is another site is refused: the Origin host must equal the Host. */
function sameSite(request, host) {
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