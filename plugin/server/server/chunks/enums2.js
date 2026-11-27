// src/lib/character/enums.ts
/** The nine alignments; slugs match the Rules Data alignments. NULL means unspecified. */
var ALIGNMENTS = [
	"lawful-good",
	"neutral-good",
	"chaotic-good",
	"lawful-neutral",
	"neutral",
	"chaotic-neutral",
	"lawful-evil",
	"neutral-evil",
	"chaotic-evil"
];
/** Ability Score Methods; slugs match the app-authored Rules Data rows. */
var ABILITY_METHODS = [
	"standard-array",
	"point-buy",
	"roll"
];
/** Where a stored skill or spell pick comes from. */
var PICK_SOURCES = [
	"class",
	"race",
	"background"
];
/** A Character's status. The Party is every Character who has not departed. */
var CHARACTER_STATUSES = [
	"alive",
	"dead",
	"departed"
];
/** The one Player of a solo Campaign; every Character and draft names its Controlling Player. */
var SOLO_PLAYER = "player";
/** The seeded app-authored background that requires the custom_background_* fields. */
var CUSTOM_BACKGROUND_SLUG = "custom";
var BACKSTORY_MAX = 2e3;
var CUSTOM_BACKGROUND_FEATURE_MAX = 1e3;
export { CUSTOM_BACKGROUND_FEATURE_MAX as a, SOLO_PLAYER as c, CHARACTER_STATUSES as i, ALIGNMENTS as n, CUSTOM_BACKGROUND_SLUG as o, BACKSTORY_MAX as r, PICK_SOURCES as s, ABILITY_METHODS as t };

//# sourceMappingURL=enums2.js.map