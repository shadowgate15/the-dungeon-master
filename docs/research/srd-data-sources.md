# SRD 5.1 rules data sources: formats, license and completeness

Research for issue #87 (child of map #86, "Character creation"). Researched 2026-11-03. This note lives on a throwaway branch and is never merged.

## Summary

- Recommended primary source: the **5e-bits dataset** (`packages/5e-database/src/2014/en/*.json` in `5e-bits/5e-srd-api`). Plain JSON, one file per entity type, actively maintained, covers every character-creation entity in SRD 5.1. Cross-references use `{index, name, url}` objects, which map cleanly onto relational tables.
- Runner-up and cross-check: **Open5e** `data/v2/wizards-of-the-coast/srd-2014/*.json` (Django fixtures). More normalized and more structured fields, but wrapped in Django fixture envelopes and the repo has a non-standard license.
- The **official SRD 5.1 PDF** is the legal source of truth, not a machine-readable one. Use it to verify the data and to copy the required attribution text.
- License: SRD 5.1 is released by Wizards of the Coast under **both CC-BY-4.0 and OGL 1.0a** (your choice). CC-BY-4.0 needs only attribution. Vendored JSON from either project adds a tooling license (MIT) on top of the WotC grant.
- All candidates vendor trivially: static JSON files committed to the repo and seeded into SQLite at build/first-run time. No runtime network is needed.

## Legal source: official SRD 5.1

Source: Wizards of the Coast SRD page (redirects to D&D Beyond): <https://www.dndbeyond.com/resources/1781-systems-reference-document-srd>

- Offered as **PDF only**. Versions listed: SRD 5.2.1 (2025-05-01, CC-BY-4.0), 5.2.0, and SRD 5.1 in two English variants, Creative Commons and OGL, plus localized CC versions.
- The page states the SRD 5.1 "full contents are released under both OGL 1.0a and CC-BY-4.0, so you may choose which license to use" (paraphrase of the page text as fetched).
- CC route: the page says content must use "the attribution terms as specified in its SRD 5.1 preamble." The 5.1 CC FAQ says: "The only requirement is that the user must provide attribution."
- OGL route: you must "include the full text of OGL 1.0a in your product" and follow its attribution terms. CC-BY-4.0 is the lighter choice and fits the project's stated license position in the README.
- **Attribution wording is not verified.** The page does not reproduce the preamble, and I could not extract text from the PDF in this environment (PDF: <https://media.dndbeyond.com/compendium-images/srd/5.1/SRD_CC_v5.1.pdf>). Secondary sites quote a credit line of the form "This work includes material taken from the System Reference Document 5.1 ("SRD 5.1") by Wizards of the Coast LLC and available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License available at https://creativecommons.org/licenses/by/4.0/legalcode." That is recalled from secondary sources. **Copy the exact text from the PDF preamble before shipping.** Secondary reports also say not to add any other Wizards attribution beyond the preamble; confirm that in the preamble too.
- CC-BY-4.0 general terms (<https://creativecommons.org/licenses/by/4.0/>): give appropriate credit, link to the license, indicate if changes were made, and do not imply endorsement.
- SRD 5.2/5.2.1 (2024 rules) is out of scope per the README.

## Candidate 1: 5e-bits SRD data (D&D 5e API)

Sources: <https://github.com/5e-bits/5e-srd-api> (monorepo, `packages/5e-database`), archived predecessor <https://github.com/5e-bits/5e-database>, API at dnd5eapi.co.

- **License**: code and data files under MIT (`LICENSE.md`, copyright 2018-2020 Adrian Padua, Christopher Ward). The package README adds: "The underlying material is released using the Open Gaming License Version 1.0a." It cites OGL only; it does not mention the CC-BY-4.0 option that WotC later added. Attribution: MIT notice must be preserved, plus the SRD attribution from the WotC preamble (see above). No attribution statement is bundled in the repo.
- **Format**: JSON arrays, one file per type under `packages/5e-database/src/2014/en/` (also `fr-FR`, `pt-BR`, `ru`, and a separate `2024` tree). Files for 2014: Ability-Scores, Alignments, Backgrounds, Classes, Conditions, Damage-Types, Equipment, Equipment-Categories, Feats, Features, Languages, Levels, Magic-Items, Magic-Schools, Monsters, Proficiencies, Races, Rules, Skills, Spells, Subclasses, Subraces, Traits, Weapon-Properties. A `schemas/` directory sits beside the data. The repo's own tooling loads it into MongoDB, but the JSON is usable standalone.
- **Schema style**: every record has `index` (stable slug), `name`, `url` (API path). References between records are `{index, name, url}` objects. Example fields: Spells carry `level`, `school`, `classes`, `components`, `material`, `ritual`, `concentration`, `casting_time`, `range`, `duration`, `damage`, `desc`, `higher_level`. Races carry `ability_bonuses`, `speed`, `size`, `traits`, `subraces`, `languages`, `age`, `alignment`. Classes carry `hit_die`, `proficiencies`, `proficiency_choices`, `saving_throws`, `starting_equipment(_options)`, `class_levels`, `multi_classing`, `subclasses`. Backgrounds carry personality traits, ideals, bonds, flaws, feature, starting proficiencies and equipment options. Choices are encoded as nested option structures (`proficiency_choices`, `starting_equipment_options`), which need careful modeling.
- **Completeness (2014 tree, counted from the files)**: 9 races (Dwarf, Elf, Halfling, Human, Dragonborn, Gnome, Half-Elf, Half-Orc, Tiefling); 4 subraces (Hill Dwarf, High Elf, Lightfoot Halfling, Rock Gnome); 12 classes; 12 subclasses (one per class); 1 background (Acolyte); 319 spells; 237 equipment items; 407 features; plus Levels, Traits, Proficiencies, Languages, Skills, Conditions, Magic-Items, Monsters. This matches what the SRD 5.1 contains for character creation (SRD 5.1 has only the Acolyte background and one subclass per class), but I did not diff text against the PDF.
- **Maintenance**: active. `5e-srd-api` last pushed 2026-11-01; recent releases `5e-srd-api-v7.3.5` (2026-11-01) and `5e-database-v7.9.1` (2026-10-29). The standalone `5e-database` repo is archived and points to the monorepo.
- **Vendoring**: easy. Copy the `2014/en` JSON files (or pin a release tag) into the repo, write a one-time TypeScript seed script into SQLite via Drizzle. About 3.9 MB for the entities above, excluding Monsters (1.3 MB). Release tags allow pinning.

## Candidate 2: Open5e

Sources: <https://github.com/open5e/open5e-api>, `data/v2/wizards-of-the-coast/srd-2014/`.

- **License**: repo `LICENSE.md` is a "Modified MIT License" (copyright 2018 Ean Moody) that explicitly excepts "artistic images included in this repository and SRD content provided by 3rd-parties." GitHub reports license `NOASSERTION`. The data's own `Document.json` lists `licenses: ["cc-by-40", "ogl-10a"]` for "System Reference Document 5.1" (publisher wizards-of-the-coast, publication date 2023-01-23). So the SRD content's license is the WotC dual grant, and the repo license does not cover it. Open5e's data tree also holds third-party publishers (Kobold Press, Green Ronin, etc.) under other licenses, so vendor only `wizards-of-the-coast/srd-2014`.
- **Format**: Django fixtures, i.e. arrays of `{"model": "api_v2.spell", "pk": "srd_acid-arrow", "fields": {...}}`. Files in `srd-2014/`: Species, Background, BackgroundBenefit, CharacterClass (classes and subclasses in one file, 24 rows = 12 + 12), ClassFeature, ClassFeatureItem, Spell, SpellCastingOption, Armor, Weapon, WeaponProperty, Item, MagicItem, Feat, Condition/Skill/Ability descriptions, Creature*, Rule/RuleSet, etc. A v1 tree (`data/v1/wotc-srd`) is the older schema.
- **Schema style**: more normalized and flatter than 5e-bits. Spells use booleans and typed fields (`verbal`, `somatic`, `material`, `damage_roll`, `damage_types`, `range` numeric plus `range_text`, `school` slug, `classes` as `srd_*` pks). Species and subspecies are in one table (`subspecies_of`).
- **Completeness**: 319 spells; 13 species rows (9 species plus 4 subspecies); 24 character class rows (12 classes and 12 subclasses); 1 background (Acolyte). Same coverage as 5e-bits for character creation. Not diffed against the PDF.
- **Maintenance**: very active (repo pushed 2026-11-03).
- **Vendoring**: easy (static JSON), but the fixture envelope and multi-publisher tree need a small adapter. Pks are namespaced (`srd_`), which is handy for provenance. Running the Django API itself is unnecessary.

## Other options

- **Official PDF / text**: complete and authoritative, but PDF-only, so extracting structured data is lossy and manual. Use for verification and attribution only.
- **Community JSON/scrapes** (not evaluated in depth): a repository search surfaced no single dominant, maintained SRD 5.1 JSON beyond the two above, and the two above both cite the WotC SRD directly. I treated other community repos as secondary and did not rely on them.

## Comparison

| | 5e-bits | Open5e |
|---|---|---|
| Data license | WotC SRD grant (CC-BY-4.0 / OGL 1.0a); repo MIT; README cites OGL only | WotC SRD grant per `Document.json`; repo "Modified MIT" excludes SRD content |
| Format | Plain JSON arrays | Django fixture JSON |
| Reference style | `{index,name,url}` objects | pk strings (`srd_*`) |
| Character-creation coverage | races, subraces, classes, subclasses, background, spells, equipment, features, traits, levels, proficiencies | species, class and subclass, background, spells, items, class features, feats |
| Maintenance | Active (2026-11-01) | Active (2026-11-03) |
| Vendoring effort | Low | Low-medium |

## Findings relevant to the map

1. Both datasets agree on SRD 5.1 character-creation scope: 9 races, 4 subraces, 12 classes, 12 subclasses, 1 background (Acolyte), 319 spells. Any design must accommodate that the SRD gives only one background and one subclass per class.
2. 5e-bits has dedicated `Levels` (225 KB) and `Features`/`Traits` files that encode class progression, which Open5e folds into `ClassFeature` records. Character creation at level 1 needs `Classes`, `Proficiencies`, `Features`, `Traits`, `Equipment`, `Spells`.
3. Choice structures (proficiency choices, starting equipment options) are nested and polymorphic in 5e-bits; expect a normalization step when seeding SQLite.
4. Provide in-app attribution (credits screen and repo notice) using the exact WotC preamble text, plus preserve MIT notice if 5e-bits files are vendored.

## Open items

- Verify the exact CC-BY-4.0 attribution wording from the SRD 5.1 CC PDF preamble (could not extract PDF text here).
- Spot-diff chosen dataset against the PDF if exact-text fidelity matters (spell text, equipment tables).
- Decide on the pinning strategy (release tag vs commit hash) and where vendored data lives.
