import { i as json } from "../../../../../../../../../chunks/exports.js";
import { s as play, u as DmAwayError } from "../../../../../../../../../chunks/bridge.js";
import { A as CallClosedError, j as CallRefusedError, n as library } from "../../../../../../../../../chunks/campaign.js";
import { n as withCampaign, t as assertPlayable } from "../../../../../../../../../chunks/http.js";
// src/routes/api/campaigns/[id]/calls/[call]/parts/[part]/+server.ts
/**
* The Player answers one part of the open Call: `{ roll: true }` rolls a Check in code,
* `{ answer }` answers a question. Returns `{ complete }`, true once the whole Call is answered and
* the DM is woken. 409 `{ error }` when the Call is no longer open or the DM is away; 400 for a refused answer or an
* archived Campaign; 404 for an unknown Campaign.
*/
var POST = async ({ params, request }) => {
	const body = await request.json().catch(() => void 0);
	if (!body || body.roll !== true && typeof body.answer !== "string") return json({ error: "Send { roll: true } or { answer }" }, { status: 400 });
	return withCampaign(() => {
		assertPlayable(library, params.id);
		const outcome = body.roll === true ? play.roll(params.id, params.call, params.part) : play.answer(params.id, params.call, params.part, body.answer);
		return json(outcome);
	}, [
		[CallClosedError, 409],
		[DmAwayError, 409],
		[CallRefusedError, 400]
	]);
};
export { POST };

//# sourceMappingURL=_server.ts.js.map