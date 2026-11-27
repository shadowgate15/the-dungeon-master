import { i as parseTheme, t as THEME_COOKIE } from "../../chunks/theme.js";
import { t as isLocalHost } from "../../chunks/lan.js";
// src/routes/+layout.server.ts
var load = async ({ cookies, request }) => {
	const isHost = isLocalHost(request.headers.get("host"));
	const { lan, joinUrls } = isHost ? await import("../../chunks/bridge2.js").then((m) => m.lanStatus()) : {
		lan: false,
		joinUrls: []
	};
	return {
		theme: parseTheme(cookies.get(THEME_COOKIE)),
		isHost,
		lan,
		joinUrls
	};
};
export { load };

//# sourceMappingURL=_layout.server.ts.js.map