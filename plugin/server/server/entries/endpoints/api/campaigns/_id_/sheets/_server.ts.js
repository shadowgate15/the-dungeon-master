import { i as json } from "../../../../../../chunks/exports.js";
import { at as playSheets, c as CampaignNotFoundError, n as library, s as CampaignMissingError } from "../../../../../../chunks/campaign.js";
// src/routes/api/campaigns/[id]/sheets/+server.ts
/** The Party's play sheets, as the play console shows them, or 404 `{ error }`. */
var GET = ({ params }) => {
	try {
		return json(playSheets(library.party(params.id)));
	} catch (e) {
		if (e instanceof CampaignNotFoundError || e instanceof CampaignMissingError) return json({ error: e.message }, { status: 404 });
		throw e;
	}
};
export { GET };

//# sourceMappingURL=_server.ts.js.map