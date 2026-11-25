import { i as json } from "../../../../../../../chunks/exports.js";
import { C as DmBusyError, n as library } from "../../../../../../../chunks/campaign.js";
import { n as withCampaign, t as assertPlayable } from "../../../../../../../chunks/http.js";
import { l as DmAwayError, o as play } from "../../../../../../../chunks/bridge.js";
// src/routes/api/campaigns/[id]/floor/done/+server.ts
/**
* The Player presses Done: `{ closed }`, true once the Floor closed and woke the DM. 409 `{ error }`
* while the DM is still answering the last turn or is away; 404 for an unknown Campaign; 400 when archived.
*/
var POST = ({ params }) => withCampaign(() => {
	assertPlayable(library, params.id);
	return json({ closed: play.done(params.id).closed });
}, [[DmBusyError, 409], [DmAwayError, 409]]);
export { POST };

//# sourceMappingURL=_server.ts.js.map