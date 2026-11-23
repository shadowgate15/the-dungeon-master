import { i as json } from "../../../../../../chunks/exports.js";
import { c as CampaignNotFoundError, n as library, s as CampaignMissingError } from "../../../../../../chunks/campaign.js";
// src/routes/api/campaigns/[id]/floor/+server.ts
/** The open Floor: its pending Declarations in send order, or 404 `{ error }`. */
var GET = ({ params }) => {
	try {
		return json(library.floor(params.id).current());
	} catch (e) {
		if (e instanceof CampaignNotFoundError || e instanceof CampaignMissingError) return json({ error: e.message }, { status: 404 });
		throw e;
	}
};
export { GET };

//# sourceMappingURL=_server.ts.js.map