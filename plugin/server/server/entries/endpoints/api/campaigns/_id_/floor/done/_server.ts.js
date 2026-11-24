import { i as json } from "../../../../../../../chunks/exports.js";
import { D as DmBusyError, c as CampaignNotFoundError, n as library, s as CampaignMissingError } from "../../../../../../../chunks/campaign.js";
import { o as play } from "../../../../../../../chunks/bridge.js";
// src/routes/api/campaigns/[id]/floor/done/+server.ts
/**
* The Player presses Done: `{ closed }`, true once the Floor closed and woke the DM. 409 `{ error }`
* while the DM is still answering the last turn; 404 for an unknown Campaign; 400 when archived.
*/
var POST = ({ params }) => {
	try {
		if (library.get(params.id)?.status === "archived") return json({ error: "An archived Campaign cannot be played" }, { status: 400 });
		return json({ closed: play.done(params.id).closed });
	} catch (e) {
		if (e instanceof DmBusyError) return json({ error: e.message }, { status: 409 });
		if (e instanceof CampaignNotFoundError || e instanceof CampaignMissingError) return json({ error: e.message }, { status: 404 });
		throw e;
	}
};
export { POST };

//# sourceMappingURL=_server.ts.js.map