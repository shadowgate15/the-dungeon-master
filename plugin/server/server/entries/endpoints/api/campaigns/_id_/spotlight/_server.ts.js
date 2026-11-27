import { i as json } from "../../../../../../chunks/exports.js";
import { yt as SpotlightRefusedError } from "../../../../../../chunks/campaign.js";
import { c as play, d as DmAwayError } from "../../../../../../chunks/bridge.js";
import { n as withCampaign } from "../../../../../../chunks/http.js";
import { n as readJson } from "../../../../../../chunks/respond.js";
// src/routes/api/campaigns/[id]/spotlight/+server.ts
/**
* "Cut to <Name>": asks the DM, over its channel, to move the spotlight to a Character elsewhere.
* 204; 400 `{ error }` for a Character already in the Scene (or unknown); 404 for an unknown Campaign;
* 409 while the DM is away.
*/
var POST = async ({ params, request, locals }) => {
	const body = await readJson(request);
	if (typeof body?.character !== "string") return json({ error: "Name the Character to cut to" }, { status: 400 });
	return withCampaign(() => {
		play.spotlight(params.id, body.character, locals.browser);
		return new Response(null, { status: 204 });
	}, [[DmAwayError, 409], [SpotlightRefusedError, 400]]);
};
export { POST };

//# sourceMappingURL=_server.ts.js.map