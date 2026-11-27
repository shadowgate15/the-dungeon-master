import { c as play } from "../../../../../../../../chunks/bridge.js";
import { n as withCampaign } from "../../../../../../../../chunks/http.js";
import { T as ClaimRefusedError, kt as CharacterNotFoundError } from "../../../../../../../../chunks/campaign.js";
// src/routes/api/campaigns/[id]/claims/[character]/release/+server.ts
/** The Host frees a Character another browser holds: 204; 409 `{ error }` for any other browser. */
var POST = ({ params, locals }) => withCampaign(() => {
	play.release(params.id, params.character, locals.browser);
	return new Response(null, { status: 204 });
}, [[ClaimRefusedError, 409], [CharacterNotFoundError, 404]]);
export { POST };

//# sourceMappingURL=_server.ts.js.map