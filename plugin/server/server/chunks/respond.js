import { i as json } from "./exports.js";
import { F as CharacterNotFoundError, I as CharacterValidationError, N as DraftNotFoundError, c as CampaignNotFoundError, n as library, s as CampaignMissingError } from "./campaign.js";
// src/lib/server/character/respond.ts
var UNREADABLE = "The Character could not be read. Try saving again.";
/** Reads a JSON request body, or undefined when it is not JSON. */
async function readJson(request) {
	try {
		return await request.json();
	} catch {
		return;
	}
}
/**
* Runs a Party change for an API route. A broken rule comes back as 400 `{ error }` so the wizard
* keeps the draft and shows it; an unknown Campaign, draft or Character as 404 `{ error }`. An
* archived Campaign is read-only.
*/
function changeParty(campaignId, body, change) {
	if (body === void 0) return json({ error: UNREADABLE }, { status: 400 });
	try {
		if (library.get(campaignId)?.status === "archived") return json({ error: "An archived Campaign cannot be changed" }, { status: 400 });
		return change(library.party(campaignId));
	} catch (e) {
		if (e instanceof CharacterValidationError) return json({ error: e.message }, { status: 400 });
		if (e instanceof CampaignNotFoundError || e instanceof CampaignMissingError || e instanceof DraftNotFoundError || e instanceof CharacterNotFoundError) return json({ error: e.message }, { status: 404 });
		throw e;
	}
}
export { readJson as n, changeParty as t };

//# sourceMappingURL=respond.js.map