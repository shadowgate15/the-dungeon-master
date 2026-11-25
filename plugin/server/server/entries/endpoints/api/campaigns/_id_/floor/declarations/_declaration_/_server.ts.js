import { n as readJson } from "../../../../../../../../chunks/respond.js";
import { t as changeFloor } from "../../../../../../../../chunks/respond2.js";
// src/routes/api/campaigns/[id]/floor/declarations/[declaration]/+server.ts
/** Rewrites a pending Declaration: 204, or 400/404 `{ error }`. */
var PATCH = async ({ params, request }) => {
	const body = await readJson(request);
	return changeFloor(params.id, body, (floor) => {
		floor.edit(params.declaration, body.text);
		return new Response(null, { status: 204 });
	});
};
/** Withdraws a pending Declaration: 204, or 404 `{ error }`. */
var DELETE = ({ params }) => changeFloor(params.id, null, (floor) => {
	floor.withdraw(params.declaration);
	return new Response(null, { status: 204 });
});
export { DELETE, PATCH };

//# sourceMappingURL=_server.ts.js.map