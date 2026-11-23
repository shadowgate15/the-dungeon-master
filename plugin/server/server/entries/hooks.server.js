import { r as isStoredTheme, t as THEME_COOKIE } from "../chunks/theme.js";
// src/hooks.server.ts
var handle = async ({ event, resolve }) => {
	const theme = event.cookies.get(THEME_COOKIE);
	const attr = isStoredTheme(theme) ? `data-theme="${theme}"` : "";
	return resolve(event, { transformPageChunk: ({ html }) => html.replace("%app.theme%", attr) });
};
var init = async () => {
	const { announceServer } = await import("../chunks/bridge2.js");
	announceServer();
};
export { handle, init };

//# sourceMappingURL=hooks.server.js.map