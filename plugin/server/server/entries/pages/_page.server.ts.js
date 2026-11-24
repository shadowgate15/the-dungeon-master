import { a as redirect } from "../../chunks/exports.js";
import { ft as resolve } from "../../chunks/internal.js";
import "../../chunks/paths.js";
// src/routes/+page.server.ts
/** The Campaign library is the home page. */
var load = () => {
	redirect(307, resolve("/campaigns"));
};
export { load };

//# sourceMappingURL=_page.server.ts.js.map