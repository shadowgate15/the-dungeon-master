import { i as json } from "../../../../../../../chunks/exports.js";
import { E as DraftNotFoundError, n as library } from "../../../../../../../chunks/campaign.js";
import { n as withCampaign } from "../../../../../../../chunks/http.js";
import { n as readJson, t as changeParty } from "../../../../../../../chunks/respond.js";
// src/routes/api/campaigns/[id]/drafts/[draft]/+server.ts
/** The stored draft with its version and the fields the DM set: 200, or 404 `{ error }`. */
var GET = ({ params }) => withCampaign(() => {
	const { draft, version, dmFields } = library.party(params.id).draft(params.draft);
	return json({
		draft,
		version,
		dmFields
	});
}, [[DraftNotFoundError, 404]]);
/** Writes the stored draft and the step it is on: 204, or 400/404 `{ error }`. */
var PUT = async ({ params, request }) => {
	const body = await readJson(request);
	return changeParty(params.id, body, (party) => {
		party.writeDraft(params.draft, body);
		return new Response(null, { status: 204 });
	});
};
/** Discards the stored draft: 204, or 400/404 `{ error }`. */
var DELETE = ({ params }) => changeParty(params.id, null, (party) => {
	party.discardDraft(params.draft);
	return new Response(null, { status: 204 });
});
export { DELETE, GET, PUT };

//# sourceMappingURL=_server.ts.js.map