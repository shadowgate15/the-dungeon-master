import { a as redirect, n as fail, t as error } from "../../../../../chunks/exports.js";
import { ft as resolve } from "../../../../../chunks/internal.js";
import "../../../../../chunks/paths.js";
import { E as DraftNotFoundError, Et as CharacterNotFoundError, Tt as loadWizardRules, i as sessions, n as library } from "../../../../../chunks/campaign.js";
// src/routes/campaigns/[id]/party/+page.server.ts
/**
* The Party step: the Campaign's saved Characters and drafts. `?draft=<id>` opens a stored draft
* in the wizard and `?character=<id>` a saved Character; the wizard then needs the Rules Data the
* resolver and `deriveStats` read in the browser.
*/
var load = ({ params, url }) => {
	const entry = library.get(params.id);
	if (!entry) error(404, "Campaign not found");
	const campaign = {
		id: entry.id,
		name: entry.name,
		path: entry.path,
		status: entry.status
	};
	const attached = sessions.list();
	if (entry.status === "missing") return {
		campaign,
		members: [],
		open: null,
		attached,
		conversation: []
	};
	const party = library.party(entry.id);
	const draftId = url.searchParams.get("draft");
	const characterId = url.searchParams.get("character");
	let open = null;
	try {
		if (draftId) {
			const { id, draft, step, version, dmFields } = party.draft(draftId);
			open = {
				rules: loadWizardRules(),
				draft,
				step,
				target: {
					campaign: entry.id,
					draft: id
				},
				stored: {
					version,
					dmFields
				}
			};
		} else if (characterId) {
			const { character, draft } = party.character(characterId);
			open = {
				rules: loadWizardRules(),
				draft,
				step: "review",
				target: {
					campaign: entry.id,
					character: character.id
				}
			};
		}
	} catch (e) {
		if (e instanceof DraftNotFoundError || e instanceof CharacterNotFoundError) error(404, e.message);
		throw e;
	}
	return {
		campaign,
		members: party.list(),
		open,
		attached,
		conversation: library.conversation(entry.id).list()
	};
};
var actions = { 
/** Starts a draft with the Campaign and opens it in the wizard. */
newDraft: ({ params }) => {
	const entry = library.get(params.id);
	if (!entry) error(404, "Campaign not found");
	if (entry.status !== "active") return fail(400, { error: "An archived or missing Campaign cannot be changed" });
	const { id } = library.party(entry.id).startDraft();
	redirect(303, `${resolve("/campaigns/[id]/party", { id: entry.id })}?draft=${encodeURIComponent(id)}`);
} };
export { actions, load };

//# sourceMappingURL=_page.server.ts.js.map