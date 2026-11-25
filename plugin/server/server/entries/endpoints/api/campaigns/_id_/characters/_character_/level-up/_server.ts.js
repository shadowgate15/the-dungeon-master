import { i as json } from "../../../../../../../../chunks/exports.js";
import { r as live } from "../../../../../../../../chunks/campaign.js";
import { n as readJson, t as changeParty } from "../../../../../../../../chunks/respond.js";
// src/routes/api/campaigns/[id]/characters/[character]/level-up/+server.ts
var slugs = (value) => Array.isArray(value) && value.every((v) => typeof v === "string") ? value : void 0;
/**
* The Player takes a level the DM awarded, with any new cantrips and spells:
* `{ cantrips?, spells? }` returns `{ id, level }`. 400 `{ error }` without an awarded level or for
* picks that do not fit; 404 for an unknown Campaign or Character. Works with or without a session.
*/
var POST = async ({ params, request }) => {
	const body = await readJson(request);
	const picks = body && {
		cantrips: slugs(body.cantrips) ?? [],
		spells: slugs(body.spells) ?? []
	};
	return changeParty(params.id, picks, (party) => {
		const updated = party.levelUp(params.character, picks);
		live.publish({
			type: "timeline",
			campaign: params.id
		});
		return json({
			id: updated.id,
			level: updated.level
		});
	});
};
export { POST };

//# sourceMappingURL=_server.ts.js.map