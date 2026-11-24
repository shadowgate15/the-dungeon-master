import { i as json } from "../../../../../../chunks/exports.js";
import { c as CampaignNotFoundError, n as library, s as CampaignMissingError } from "../../../../../../chunks/campaign.js";
import { o as play } from "../../../../../../chunks/bridge.js";
// src/routes/api/campaigns/[id]/end-session/+server.ts
/**
* The Player presses End Session: the DM gets an `end_session` event and closes the sitting.
* 404 `{ error }` for an unknown Campaign; 400 when archived.
*/
var POST = ({ params }) => {
	try {
		if (library.get(params.id)?.status === "archived") return json({ error: "An archived Campaign cannot be played" }, { status: 400 });
		play.endSession(params.id);
		return json({ ok: true });
	} catch (e) {
		if (e instanceof CampaignNotFoundError || e instanceof CampaignMissingError) return json({ error: e.message }, { status: 404 });
		throw e;
	}
};
export { POST };

//# sourceMappingURL=_server.ts.js.map