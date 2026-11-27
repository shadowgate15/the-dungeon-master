// src/lib/server/lan-access.ts
var state = {
	lan: false,
	campaign: void 0
};
var lanAccess = {
	get lan() {
		return state.lan;
	},
	get campaign() {
		return state.campaign;
	},
	set(next) {
		state = {
			...state,
			...next
		};
	},
	reset() {
		state = {
			lan: false,
			campaign: void 0
		};
	}
};
/** Whether a remote browser may reach this path: the LAN Campaign's pages and APIs, and the shell they need. */
function remoteMayReach(pathname, campaign, method = "GET") {
	if (hostOnly(pathname, campaign, method)) return false;
	if ([`/campaigns/${campaign}`, `/api/campaigns/${campaign}`].some((root) => pathname === root || pathname.startsWith(`${root}/`))) return true;
	return pathname === "/api/events" || pathname === "/api/sessions" || pathname === "/theme" || pathname.startsWith("/_app/");
}
/**
* The acts only the Host may do, even inside the LAN Campaign: Begin and Start over (form actions
* on the begin page), the Seed card (its form action and API), End Session, and the DM's permission
* prompts. Reading the begin page and the creation chat stay open to everyone.
*/
function hostOnly(pathname, campaign, method) {
	const page = `/campaigns/${campaign}`;
	const api = `/api/campaigns/${campaign}`;
	if (method !== "GET" && method !== "HEAD" && (pathname === page || pathname === `${page}/begin`)) return true;
	return [
		`${api}/end-session`,
		`${api}/seed`,
		`${api}/permission`
	].includes(pathname);
}
export { remoteMayReach as n, lanAccess as t };

//# sourceMappingURL=lan-access.js.map