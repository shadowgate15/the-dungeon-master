import { i as json } from "../../../../../../chunks/exports.js";
import { n as library } from "../../../../../../chunks/campaign.js";
import { n as withCampaign } from "../../../../../../chunks/http.js";
// src/routes/api/campaigns/[id]/seed/+server.ts
/** The Campaign Seed and the fields the DM set ("✎ DM"), or 404 `{ error }`. */
var GET = ({ params }) => withCampaign(() => {
	const body = {
		seed: library.seed(params.id),
		dmFields: library.dmSeedFields(params.id)
	};
	return json(body);
});
export { GET };

//# sourceMappingURL=_server.ts.js.map