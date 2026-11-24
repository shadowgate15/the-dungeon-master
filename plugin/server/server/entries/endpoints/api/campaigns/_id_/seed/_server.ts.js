import { i as json } from "../../../../../../chunks/exports.js";
import { c as CampaignNotFoundError, n as library, s as CampaignMissingError } from "../../../../../../chunks/campaign.js";
// src/routes/api/campaigns/[id]/seed/+server.ts
/** The Campaign Seed and the fields the DM set ("✎ DM"), or 404 `{ error }`. */
var GET = ({ params }) => {
	try {
		const body = {
			seed: library.seed(params.id),
			dmFields: library.dmSeedFields(params.id)
		};
		return json(body);
	} catch (e) {
		if (e instanceof CampaignNotFoundError || e instanceof CampaignMissingError) return json({ error: e.message }, { status: 404 });
		throw e;
	}
};
export { GET };

//# sourceMappingURL=_server.ts.js.map