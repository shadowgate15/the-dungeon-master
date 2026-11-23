import { i as parseTheme, t as THEME_COOKIE } from "../../chunks/theme.js";
// src/routes/+layout.server.ts
var load = ({ cookies }) => {
	return { theme: parseTheme(cookies.get(THEME_COOKIE)) };
};
export { load };

//# sourceMappingURL=_layout.server.ts.js.map