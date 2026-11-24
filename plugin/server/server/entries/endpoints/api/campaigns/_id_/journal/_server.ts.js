import { i as json } from "../../../../../../chunks/exports.js";
import { c as CampaignNotFoundError, n as library, s as CampaignMissingError } from "../../../../../../chunks/campaign.js";
// src/routes/api/campaigns/[id]/journal/+server.ts
/** The Player's Journal (their Characters' Beliefs, truth stripped), or 404 `{ error }`. */
var GET = ({ params }) => {
	try {
		return json(library.record(params.id).journal());
	} catch (e) {
		if (e instanceof CampaignNotFoundError || e instanceof CampaignMissingError) return json({ error: e.message }, { status: 404 });
		throw e;
	}
};
export { GET };

//# sourceMappingURL=_server.ts.js.map