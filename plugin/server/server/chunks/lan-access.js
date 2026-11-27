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
function remoteMayReach(pathname, campaign) {
	if ([`/campaigns/${campaign}`, `/api/campaigns/${campaign}`].some((root) => pathname === root || pathname.startsWith(`${root}/`))) return true;
	return pathname === "/api/events" || pathname === "/api/sessions" || pathname === "/theme" || pathname.startsWith("/_app/");
}
export { remoteMayReach as n, lanAccess as t };

//# sourceMappingURL=lan-access.js.map