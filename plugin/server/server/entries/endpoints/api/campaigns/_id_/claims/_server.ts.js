import { i as json } from "../../../../../../chunks/exports.js";
import { c as play } from "../../../../../../chunks/bridge.js";
import { n as withCampaign } from "../../../../../../chunks/http.js";
import { T as ClaimRefusedError, kt as CharacterNotFoundError } from "../../../../../../chunks/campaign.js";
import { n as readJson } from "../../../../../../chunks/respond.js";
// src/routes/api/campaigns/[id]/claims/+server.ts
/** The Party's Claims as this browser sees them (yours, taken or free; never by whom), or 404 `{ error }`. */
var GET = ({ params, locals }) => withCampaign(() => json(play.claims(params.id, locals.browser)));
/** Claims a Character for this browser: 204; 409 `{ error }` for a taken one, the Host's browser included. */
var POST = async ({ params, request, locals }) => {
	const body = await readJson(request);
	if (typeof body?.character !== "string") return json({ error: "Name the Character to Claim" }, { status: 400 });
	return withCampaign(() => {
		play.claim(params.id, body.character, locals.browser);
		return new Response(null, { status: 204 });
	}, [[ClaimRefusedError, 409], [CharacterNotFoundError, 404]]);
};
export { GET, POST };

//# sourceMappingURL=_server.ts.js.map