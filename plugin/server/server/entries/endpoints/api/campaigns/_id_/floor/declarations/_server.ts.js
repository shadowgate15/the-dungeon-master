import { i as json } from "../../../../../../../chunks/exports.js";
import { n as readJson } from "../../../../../../../chunks/respond.js";
import { t as changeFloor } from "../../../../../../../chunks/respond2.js";
// src/routes/api/campaigns/[id]/floor/declarations/+server.ts
/**
* Sends a Declaration for one Character to the open Floor's pending tray: 201 with the
* Declaration, or 400/404 `{ error }`.
*/
var POST = async ({ params, request }) => {
	const body = await readJson(request);
	return changeFloor(params.id, body, (floor) => json(floor.send({
		character: body.character,
		text: body.text
	}), { status: 201 }));
};
export { POST };

//# sourceMappingURL=_server.ts.js.map