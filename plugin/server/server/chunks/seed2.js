import { a as SCALES, i as PREMISE_SERVICE_MAX, n as LENGTHS, o as TECH_LEVELS, r as MAGIC_LEVELS, s as TONES, t as GENRE_FLAVORS } from "./enums.js";
// src/lib/campaign/seed.ts
/** Every Campaign Seed field, in the Seed card's order. */
var CAMPAIGN_SEED_FIELDS = [
	"name",
	"premise",
	"tone",
	"length",
	"worldName",
	"genreFlavor",
	"scale",
	"magicLevel",
	"techLevel"
];
/** The fields a complete Seed must have; the rest are optional. */
var REQUIRED_SEED_FIELDS = [
	"name",
	"premise",
	"tone",
	"length"
];
function emptyCampaignSeed() {
	return Object.fromEntries(CAMPAIGN_SEED_FIELDS.map((f) => [f, ""]));
}
/** The required fields still blank, in card order. */
function missingSeedFields(seed) {
	return REQUIRED_SEED_FIELDS.filter((f) => seed[f].trim() === "");
}
/** The Seed breaks a rule: a blank name, over-long text or a value outside its list. */
var CampaignSeedError = class extends Error {};
function text(label, value, max) {
	const trimmed = (value ?? "").trim();
	if (trimmed.length > max) throw new CampaignSeedError(`${label} must be at most ${max} characters`);
	return trimmed === "" ? null : trimmed;
}
function oneOf(label, values, value) {
	if (!value) return null;
	if (!values.includes(value)) throw new CampaignSeedError(`Invalid ${label}: ${value}`);
	return value;
}
/**
* The card's values as a stored Seed. An incomplete Seed is fine (blanks become unset), but a
* Campaign always has a name, and set values must be valid.
*/
function parseCampaignSeed(card) {
	const name = text("Name", card.name, 80);
	if (!name) throw new CampaignSeedError("Name is required");
	return {
		name,
		premise: text("Premise", card.premise, PREMISE_SERVICE_MAX),
		tone: oneOf("tone", TONES, card.tone),
		length: oneOf("length", LENGTHS, card.length),
		worldName: text("World name", card.worldName, 80),
		genreFlavor: oneOf("genre flavor", GENRE_FLAVORS, card.genreFlavor),
		scale: oneOf("scale", SCALES, card.scale),
		magicLevel: oneOf("magic level", MAGIC_LEVELS, card.magicLevel),
		techLevel: oneOf("tech level", TECH_LEVELS, card.techLevel)
	};
}
/** A stored Seed as card values. */
function campaignSeedCard(seed) {
	return Object.fromEntries(CAMPAIGN_SEED_FIELDS.map((f) => [f, seed[f] ?? ""]));
}
export { missingSeedFields as a, emptyCampaignSeed as i, CampaignSeedError as n, parseCampaignSeed as o, campaignSeedCard as r, CAMPAIGN_SEED_FIELDS as t };

//# sourceMappingURL=seed2.js.map