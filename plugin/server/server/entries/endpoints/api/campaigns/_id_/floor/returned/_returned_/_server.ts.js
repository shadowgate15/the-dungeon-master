import { t as changeFloor } from "../../../../../../../../chunks/respond2.js";
// src/routes/api/campaigns/[id]/floor/returned/[returned]/+server.ts
/** The composer loaded a draft a cut sent back: 204, and it is no longer held. */
var DELETE = ({ params }) => changeFloor(params.id, null, (floor) => {
	floor.clearReturned(params.returned);
	return new Response(null, { status: 204 });
}, { offline: true });
export { DELETE };

//# sourceMappingURL=_server.ts.js.map