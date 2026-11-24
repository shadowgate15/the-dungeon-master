import { i as json } from "../../../../../../../../../chunks/exports.js";
import { c as DmAwayError, o as play } from "../../../../../../../../../chunks/bridge.js";
import { A as CallClosedError, c as CampaignNotFoundError, j as CallRefusedError, n as library, s as CampaignMissingError } from "../../../../../../../../../chunks/campaign.js";
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
	try {
		if (library.get(params.id)?.status === "archived") return json({ error: "An archived Campaign cannot be played" }, { status: 400 });
		const outcome = body.roll === true ? play.roll(params.id, params.call, params.part) : play.answer(params.id, params.call, params.part, body.answer);
		return json(outcome);
	} catch (e) {
		if (e instanceof CallClosedError || e instanceof DmAwayError) return json({ error: e.message }, { status: 409 });
		if (e instanceof CallRefusedError) return json({ error: e.message }, { status: 400 });
		if (e instanceof CampaignNotFoundError || e instanceof CampaignMissingError) return json({ error: e.message }, { status: 404 });
		throw e;
	}
};
export { POST };

//# sourceMappingURL=_server.ts.js.map