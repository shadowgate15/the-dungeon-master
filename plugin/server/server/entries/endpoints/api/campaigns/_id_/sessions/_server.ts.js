import { i as json } from "../../../../../../chunks/exports.js";
import { c as CampaignNotFoundError, n as library, s as CampaignMissingError } from "../../../../../../chunks/campaign.js";
// src/routes/api/campaigns/[id]/sessions/+server.ts
/**
* The Player's Session history: each closed Session's summary and threads, newest first. Read-only:
* there is no route to edit a summary. 404 `{ error }` for an unknown Campaign.
*/
var GET = ({ params }) => {
	try {
		return json(library.record(params.id).sessionHistory());
	} catch (e) {
		if (e instanceof CampaignNotFoundError || e instanceof CampaignMissingError) return json({ error: e.message }, { status: 404 });
		throw e;
	}
};
export { GET };

//# sourceMappingURL=_server.ts.js.map