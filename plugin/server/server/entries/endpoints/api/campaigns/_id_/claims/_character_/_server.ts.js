import { s as play } from "../../../../../../../chunks/bridge.js";
import { n as withCampaign } from "../../../../../../../chunks/http.js";
import { Dt as CharacterNotFoundError, T as ClaimRefusedError } from "../../../../../../../chunks/campaign.js";
// src/routes/api/campaigns/[id]/claims/[character]/+server.ts
/** Lets go of this browser's Claim on a Character: 204; 409 `{ error }` when it does not hold it. */
var DELETE = ({ params, locals }) => withCampaign(() => {
	play.letGo(params.id, params.character, locals.browser);
	return new Response(null, { status: 204 });
}, [[ClaimRefusedError, 409], [CharacterNotFoundError, 404]]);
export { DELETE };

//# sourceMappingURL=_server.ts.js.map