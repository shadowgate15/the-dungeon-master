import { i as json } from "../../../../../../chunks/exports.js";
import { o as play } from "../../../../../../chunks/bridge.js";
import { c as CampaignNotFoundError, s as CampaignMissingError } from "../../../../../../chunks/campaign.js";
// src/routes/api/campaigns/[id]/timeline/+server.ts
/** The Player's timeline (Player-safe entries only) and awaiting Narration, or 404 `{ error }`. */
var GET = ({ params }) => {
	try {
		return json(play.timeline(params.id));
	} catch (e) {
		if (e instanceof CampaignNotFoundError || e instanceof CampaignMissingError) return json({ error: e.message }, { status: 404 });
		throw e;
	}
};
export { GET };

//# sourceMappingURL=_server.ts.js.map