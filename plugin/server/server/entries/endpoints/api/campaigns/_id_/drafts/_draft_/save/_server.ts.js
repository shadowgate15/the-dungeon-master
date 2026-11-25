import { i as json } from "../../../../../../../../chunks/exports.js";
import { n as readJson, t as changeParty } from "../../../../../../../../chunks/respond.js";
// src/routes/api/campaigns/[id]/drafts/[draft]/save/+server.ts
/**
* Saves the stored draft into the Party: 201 `{ id }`, or 400 `{ error }` (keeping the draft)
* while any step is not valid.
*/
var POST = async ({ params, request }) => {
	const body = await readJson(request);
	return changeParty(params.id, body, (party) => json({ id: party.saveDraft(params.draft, body).id }, { status: 201 }));
};
export { POST };

//# sourceMappingURL=_server.ts.js.map