import { i as json } from "./exports.js";
import { s as play, u as DmAwayError } from "./bridge.js";
import { S as DeclarationRefusedError, c as CampaignNotFoundError, n as library, r as live, s as CampaignMissingError, x as DeclarationNotFoundError } from "./campaign.js";
// src/lib/server/floor/respond.ts
var UNREADABLE = "The Declaration could not be read. Try sending it again.";
/**
* Runs a change to a Campaign's open Floor for an API route, then tells every browser tab the
* Floor changed. A refused Declaration comes back as 400 `{ error }`; an unknown Campaign or
* Declaration as 404 `{ error }`. An archived Campaign is read-only. Declarations are play input:
* refused with 409 while the DM is away, unless `offline` (the Player's own returned drafts).
*/
function changeFloor(campaignId, body, change, { offline = false } = {}) {
	if (body === void 0) return json({ error: UNREADABLE }, { status: 400 });
	try {
		if (library.get(campaignId)?.status === "archived") return json({ error: "An archived Campaign cannot be changed" }, { status: 400 });
		const response = change(offline ? library.floor(campaignId) : play.floor(campaignId));
		live.publish({
			type: "floor",
			campaign: campaignId
		});
		return response;
	} catch (e) {
		if (e instanceof DmAwayError) return json({ error: e.message }, { status: 409 });
		if (e instanceof DeclarationRefusedError) return json({ error: e.message }, { status: 400 });
		if (e instanceof CampaignNotFoundError || e instanceof CampaignMissingError || e instanceof DeclarationNotFoundError) return json({ error: e.message }, { status: 404 });
		throw e;
	}
}
export { changeFloor as t };

//# sourceMappingURL=respond2.js.map