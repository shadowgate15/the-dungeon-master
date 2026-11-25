import { i as json } from "./exports.js";
import { a as CampaignArchivedError, c as CampaignNotFoundError, s as CampaignMissingError } from "./campaign.js";
// src/lib/server/campaign/http.ts
/** What every Campaign route refuses: an unknown or missing Campaign, an archived one. */
var CAMPAIGN_REFUSALS = [
	[CampaignNotFoundError, 404],
	[CampaignMissingError, 404],
	[CampaignArchivedError, 400]
];
/**
* Runs a Campaign route, answering a refused request with its status and `{ error }`: 404 for an
* unknown or missing Campaign, 400 for an archived one, and the route's own `refusals`. Anything
* else is rethrown.
*/
async function withCampaign(run, refusals = []) {
	try {
		return await run();
	} catch (e) {
		const refused = [...refusals, ...CAMPAIGN_REFUSALS].find(([type]) => e instanceof type);
		if (refused) return json({ error: e.message }, { status: refused[1] });
		throw e;
	}
}
/** Refuses play on an archived Campaign (400 through `withCampaign`). */
function assertPlayable(library, id) {
	if (library.get(id)?.status === "archived") throw new CampaignArchivedError("An archived Campaign cannot be played");
}
export { withCampaign as n, assertPlayable as t };

//# sourceMappingURL=http.js.map