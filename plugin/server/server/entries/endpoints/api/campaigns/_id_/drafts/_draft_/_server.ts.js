import { n as readJson, t as changeParty } from "../../../../../../../chunks/respond.js";
// src/routes/api/campaigns/[id]/drafts/[draft]/+server.ts
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
export { DELETE, PUT };

//# sourceMappingURL=_server.ts.js.map