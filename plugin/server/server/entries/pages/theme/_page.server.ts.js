import { a as redirect } from "../../../chunks/exports.js";
import { r as isStoredTheme, t as THEME_COOKIE } from "../../../chunks/theme.js";
// src/routes/theme/+page.server.ts
var ONE_YEAR = 31536e3;
function safePath(value) {
	return typeof value === "string" && /^\/(?![/\\])/.test(value) ? value : "/";
}
var load = () => redirect(303, "/");
var actions = { default: async ({ request, cookies }) => {
	const form = await request.formData();
	const theme = form.get("theme");
	if (isStoredTheme(theme)) cookies.set(THEME_COOKIE, theme, {
		path: "/",
		maxAge: ONE_YEAR,
		sameSite: "lax",
		secure: false
	});
	else cookies.delete(THEME_COOKIE, { path: "/" });
	redirect(303, safePath(form.get("redirectTo")));
} };
export { actions, load };

//# sourceMappingURL=_page.server.ts.js.map