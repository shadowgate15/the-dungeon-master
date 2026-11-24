import { i as json } from "../../../../../../../chunks/exports.js";
import { C as DraftNotFoundError, c as CampaignNotFoundError, n as library, s as CampaignMissingError } from "../../../../../../../chunks/campaign.js";
import { n as readJson, t as changeParty } from "../../../../../../../chunks/respond.js";
// src/routes/api/campaigns/[id]/drafts/[draft]/+server.ts
/** The stored draft with its version and the fields the DM set: 200, or 404 `{ error }`. */
var GET = ({ params }) => {
	try {
		const { draft, version, dmFields } = library.party(params.id).draft(params.draft);
		return json({
			draft,
			version,
			dmFields
		});
	} catch (e) {
		if (e instanceof CampaignNotFoundError || e instanceof CampaignMissingError || e instanceof DraftNotFoundError) return json({ error: e.message }, { status: 404 });
		throw e;
	}
};
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