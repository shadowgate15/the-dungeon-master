// src/lib/campaign/enums.ts
/** The mood of play. Unordered. */
var TONES = [
	"heroic",
	"lighthearted",
	"tense",
	"dark",
	"mysterious",
	"epic"
];
/**
* Story scope, not hours. Ordered: one-shot (a single sitting), short (a few sessions),
* medium (a season of play), long (an open-ended saga).
*/
var LENGTHS = [
	"one-shot",
	"short",
	"medium",
	"long"
];
/** The service rejects a premise longer than this. */
var PREMISE_SERVICE_MAX = 2e3;
var GENRE_FLAVORS = [
	"high fantasy",
	"dark fantasy",
	"sword and sorcery",
	"mythic",
	"gothic horror",
	"science fantasy",
	"science fiction",
	"post-apocalyptic"
];
var SCALES = [
	"single region",
	"continent",
	"multiple continents",
	"planar"
];
var MAGIC_LEVELS = [
	"none",
	"low",
	"moderate",
	"high",
	"ubiquitous"
];
var TECH_LEVELS = [
	"stone age",
	"ancient",
	"medieval",
	"renaissance",
	"industrial",
	"modern",
	"futuristic"
];
export { SCALES as a, PREMISE_SERVICE_MAX as i, LENGTHS as n, TECH_LEVELS as o, MAGIC_LEVELS as r, TONES as s, GENRE_FLAVORS as t };

//# sourceMappingURL=enums.js.map