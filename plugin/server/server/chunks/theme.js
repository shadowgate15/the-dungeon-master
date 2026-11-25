// src/lib/theme/theme.ts
var THEME_COOKIE = "theme";
var THEME_OPTIONS = [
	{
		value: "system",
		icon: "◐",
		label: "System"
	},
	{
		value: "light",
		icon: "☀",
		label: "Light"
	},
	{
		value: "dark",
		icon: "☾",
		label: "Dark"
	}
];
function isStoredTheme(value) {
	return value === "light" || value === "dark";
}
/** Reads a raw cookie value; anything but light or dark means follow the OS. */
function parseTheme(value) {
	return isStoredTheme(value) ? value : "system";
}
export { parseTheme as i, THEME_OPTIONS as n, isStoredTheme as r, THEME_COOKIE as t };

//# sourceMappingURL=theme.js.map