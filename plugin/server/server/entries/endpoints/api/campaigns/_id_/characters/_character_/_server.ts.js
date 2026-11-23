import { i as json } from "../../../../../../../chunks/exports.js";
import { n as readJson, t as changeParty } from "../../../../../../../chunks/respond.js";
// src/routes/api/campaigns/[id]/characters/[character]/+server.ts
/** Replaces a saved Character's choices from the edit wizard's draft: `{ id }` or 400/404 `{ error }`. */
var PUT = async ({ params, request }) => {
	const body = await readJson(request);
	return changeParty(params.id, body, (party) => json({ id: party.updateCharacter(params.character, body).id }));
};
export { PUT };

//# sourceMappingURL=_server.ts.js.map