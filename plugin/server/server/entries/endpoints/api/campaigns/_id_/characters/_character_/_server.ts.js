import { i as json } from "../../../../../../../chunks/exports.js";
import { r as live } from "../../../../../../../chunks/campaign.js";
import { n as readJson, t as changeParty } from "../../../../../../../chunks/respond.js";
// src/routes/api/campaigns/[id]/characters/[character]/+server.ts
/**
* Replaces a saved Character's choices from the edit wizard's draft: `{ id }` or 400/404 `{ error }`;
* 409 after Begin while the DM is away (it resets play state).
*/
var PUT = async ({ params, request }) => {
	const body = await readJson(request);
	return changeParty(params.id, body, (party) => json({ id: party.updateCharacter(params.character, body).id }));
};
/**
* Edits a Character's notes, personality, appearance or backstory, leaving play state alone:
* `{ id, version }`, 400/404 `{ error }`, or 409 for a backstory edit after Begin while the DM is away.
*/
var PATCH = async ({ params, request }) => {
	const body = await readJson(request);
	return changeParty(params.id, body, (party) => {
		const updated = party.updateDetails(params.character, body);
		live.publish({
			type: "timeline",
			campaign: params.id
		});
		return json({
			id: updated.id,
			version: updated.version
		});
	});
};
export { PATCH, PUT };

//# sourceMappingURL=_server.ts.js.map