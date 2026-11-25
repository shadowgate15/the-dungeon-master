import { a as redirect, n as fail } from "../../../chunks/exports.js";
import { ft as resolve } from "../../../chunks/internal.js";
import "../../../chunks/paths.js";
import { n as CampaignSeedError } from "../../../chunks/seed2.js";
import { c as CampaignNotFoundError, i as sessions, l as NotACampaignFolderError, n as library, o as CampaignExistsError, s as CampaignMissingError, t as campaignRoot, u as SessionLiveError } from "../../../chunks/campaign.js";
// src/routes/campaigns/+page.server.ts
var item = (e) => ({
	id: e.id,
	name: e.name,
	path: e.path,
	status: e.status,
	premise: e.campaign?.premise ?? null,
	tone: e.campaign?.tone ?? null,
	length: e.campaign?.length ?? null,
	updatedAt: e.campaign?.updatedAt ?? null
});
var load = ({ url }) => {
	const view = url.searchParams.get("view") === "archived" ? "archived" : "active";
	const entries = library.list();
	const active = entries.filter((e) => e.status !== "archived");
	const byUpdated = (a, b) => (b.campaign?.updatedAt ?? -1) - (a.campaign?.updatedAt ?? -1);
	const archived = entries.filter((e) => e.status === "archived");
	return {
		view,
		campaigns: (view === "archived" ? archived : active).sort(byUpdated).map(item),
		activeCount: active.length,
		archivedCount: archived.length,
		attached: sessions.list(),
		campaignRoot
	};
};
/** A refused action, as a notice: an unknown or Missing Campaign, or one with a live session. */
var notFound = (e) => {
	if (e instanceof CampaignNotFoundError || e instanceof CampaignMissingError) return fail(404, { notice: { message: e.message } });
	if (e instanceof SessionLiveError) return fail(409, { notice: { message: e.message } });
	throw e;
};
/** Archives or restores the Campaigns named by the form's `id`s, and offers the reverse. */
function setArchived(action) {
	const past = action === "archive" ? "Archived" : "Restored";
	const reverse = action === "archive" ? "restore" : "archive";
	return async ({ request }) => {
		const ids = (await request.formData()).getAll("id").map(String);
		const done = [];
		let failure;
		for (const id of ids) try {
			done.push({
				id,
				name: library[action](id).name
			});
		} catch (e) {
			failure = e;
		}
		if (done.length === 0) return notFound(failure);
		return { notice: {
			message: done.length === 1 ? `${past} ${done[0].name}` : `${past} ${done.length} Campaigns`,
			undo: {
				action: reverse,
				ids: done.map((d) => d.id)
			}
		} };
	};
}
var formId = async (request) => String((await request.formData()).get("id") ?? "");
var actions = {
	archive: setArchived("archive"),
	restore: setArchived("restore"),
	delete: async ({ request }) => {
		try {
			const { name } = library.delete(await formId(request));
			return { notice: { message: `Deleted ${name}` } };
		} catch (e) {
			return notFound(e);
		}
	},
	unregister: async ({ request }) => {
		const id = await formId(request);
		const name = library.get(id)?.name ?? "Campaign";
		try {
			library.unregister(id);
		} catch (e) {
			return notFound(e);
		}
		return { notice: { message: `Removed ${name} from the library` } };
	},
	/** Adds an existing Campaign folder, which also brings back a Missing Campaign that moved. */
	register: async ({ request }) => {
		const folder = String((await request.formData()).get("folder") ?? "").trim();
		try {
			const { name } = library.register(folder);
			return { notice: { message: `Added ${name}` } };
		} catch (e) {
			if (e instanceof NotACampaignFolderError) return fail(400, { notice: { message: e.message } });
			throw e;
		}
	},
	createCampaign: async ({ request }) => {
		const data = await request.formData();
		const name = String(data.get("name") ?? "");
		const folder = String(data.get("folder") ?? "").trim();
		let id;
		try {
			if (!folder) throw new CampaignSeedError("Folder is required");
			id = library.create({
				name,
				folder
			}).id;
		} catch (error) {
			if (error instanceof CampaignSeedError || error instanceof CampaignExistsError) return fail(400, {
				name,
				folder,
				error: error.message
			});
			throw error;
		}
		redirect(303, resolve("/campaigns/[id]", { id }));
	}
};
export { actions, load };

//# sourceMappingURL=_page.server.ts.js.map