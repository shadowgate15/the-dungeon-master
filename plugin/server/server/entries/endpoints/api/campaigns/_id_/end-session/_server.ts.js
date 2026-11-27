import { i as json } from "../../../../../../chunks/exports.js";
import { n as library } from "../../../../../../chunks/campaign.js";
import { n as withCampaign, t as assertPlayable } from "../../../../../../chunks/http.js";
import { s as play, u as DmAwayError } from "../../../../../../chunks/bridge.js";
// src/routes/api/campaigns/[id]/end-session/+server.ts
/**
* The Player presses End Session: the DM gets an `end_session` event and closes the Session.
* 404 `{ error }` for an unknown Campaign; 400 when archived; 409 while the DM is away.
*/
var POST = ({ params }) => withCampaign(() => {
	assertPlayable(library, params.id);
	play.endSession(params.id);
	return json({ ok: true });
}, [[DmAwayError, 409]]);
export { POST };

//# sourceMappingURL=_server.ts.js.map