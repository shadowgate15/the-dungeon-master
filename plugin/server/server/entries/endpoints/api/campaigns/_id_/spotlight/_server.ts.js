import { i as json } from "../../../../../../chunks/exports.js";
import { c as DmAwayError, o as play } from "../../../../../../chunks/bridge.js";
import { c as CampaignNotFoundError, lt as SpotlightRefusedError, s as CampaignMissingError } from "../../../../../../chunks/campaign.js";
import { n as readJson } from "../../../../../../chunks/respond.js";
// src/routes/api/campaigns/[id]/spotlight/+server.ts
/**
* "Cut to <Name>": asks the DM, over its channel, to move the spotlight to a Character elsewhere.
* 204; 400 `{ error }` for a Character already in the Scene (or unknown); 404 for an unknown Campaign;
* 409 while the DM is away.
*/
var POST = async ({ params, request }) => {
	const body = await readJson(request);
	if (typeof body?.character !== "string") return json({ error: "Name the Character to cut to" }, { status: 400 });
	try {
		play.spotlight(params.id, body.character);
		return new Response(null, { status: 204 });
	} catch (e) {
		if (e instanceof DmAwayError) return json({ error: e.message }, { status: 409 });
		if (e instanceof SpotlightRefusedError) return json({ error: e.message }, { status: 400 });
		if (e instanceof CampaignNotFoundError || e instanceof CampaignMissingError) return json({ error: e.message }, { status: 404 });
		throw e;
	}
};
export { POST };

//# sourceMappingURL=_server.ts.js.map