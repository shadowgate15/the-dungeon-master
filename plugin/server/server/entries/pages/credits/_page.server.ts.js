import { Ct as DUNGEON_MASTER_HOME, d as openDatabase, l as userStateDir, n as createRulesRepository, t as seedRulesData, u as migrateDatabase, xt as DATABASE_URL } from "../../../chunks/seed.js";
import path from "node:path";
// src/lib/server/db/index.ts
var db;
/**
* The server's own rules database (for the credits page), opened on first use so building the
* app opens nothing. Defaults to `rules.db` in the user-level state directory.
*/
function rulesDatabase() {
	if (!db) {
		db = openDatabase(DATABASE_URL || path.join(userStateDir({ DUNGEON_MASTER_HOME }), "rules.db"));
		migrateDatabase(db);
		seedRulesData(db);
	}
	return db;
}
// src/lib/rules/attribution.ts
/** Attribution the CC-BY-4.0 licence of the SRD 5.1 requires, in its exact published wording. */
var SRD_ATTRIBUTION = "This work includes material taken from the System Reference Document 5.1 (\"SRD 5.1\") by Wizards of the Coast LLC and available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License available at https://creativecommons.org/licenses/by/4.0/legalcode.";
var SRD_LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/legalcode";
/** The MIT licence of the 5e-bits/5e-database data the SRD content is normalized from. */
var DATABASE_MIT_NOTICE = `MIT License

Copyright (c) [2018-2020] [Adrian Padua, Christopher Ward]

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;
// src/lib/server/rules/credits.ts
/** Each kind of SRD content the seeded Rules Data includes, with how many entries it has. */
function contents(repo) {
	return [
		{
			name: "Races",
			count: repo.races().length
		},
		{
			name: "Subraces",
			count: repo.subraces().length
		},
		{
			name: "Classes",
			count: repo.classes().length
		},
		{
			name: "Subclasses",
			count: repo.subclasses().length
		},
		{
			name: "Class features",
			count: repo.features().length
		},
		{
			name: "Backgrounds",
			count: repo.backgrounds().filter((b) => !b.appAuthored).length
		},
		{
			name: "Spells",
			count: repo.spells().length
		},
		{
			name: "Equipment",
			count: repo.equipment().length
		},
		{
			name: "Magic items",
			count: repo.magicItems().length
		},
		{
			name: "Monsters",
			count: repo.monsters().length
		},
		{
			name: "Conditions",
			count: repo.conditions().length
		},
		{
			name: "Rules sections",
			count: repo.ruleSections().length
		}
	];
}
/** What the credits page shows: the licence texts and the seeded dataset version. */
function loadCredits(repo) {
	const dataset = repo.datasetInfo();
	return {
		attribution: SRD_ATTRIBUTION,
		licenseUrl: SRD_LICENSE_URL,
		mitNotice: DATABASE_MIT_NOTICE,
		dataset: dataset && {
			version: dataset.datasetVersion,
			tag: dataset.sourceTag,
			repository: dataset.sourceRepository,
			srdVersion: dataset.srdVersion,
			contents: contents(repo)
		}
	};
}
// src/routes/credits/+page.server.ts
var load = () => loadCredits(createRulesRepository(rulesDatabase()));
export { load };

//# sourceMappingURL=_page.server.ts.js.map