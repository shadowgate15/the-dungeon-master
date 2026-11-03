# SRD 5.1 level 1 character creation content inventory

Research for issue #88 (child of map #86, "Character creation"). Throwaway branch; not merged.

## Source and method

- Sole source: the official **System Reference Document 5.1** (CC-BY-4.0), Wizards of the Coast, PDF at <https://media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1.pdf> (403 pages). Linked from <https://dnd.wizards.com/resources/systems-reference-document>.
- Citations are `SRD p.N` = PDF page number (equal to the printed "System Reference Document 5.1 N" footer).
- Text was extracted from the PDF and searched. "Absent" below means the string/section was searched for and not found, so treat it as a strong but text-search-based finding. Hyphenation and spacing in the PDF are noisy; values were read from the extracted text, not retyped from memory.
- Nothing here comes from the PHB or secondary write-ups. Where the PHB is known to have more, that is noted only as context for why the SRD is silent; it is not a source.

## 1. Races and subraces (SRD pp.3-7)

All nine races have a trait block: Ability Score Increase, Age, Alignment, Size, Speed, Languages, plus race specifics. Only four races ship a subrace, and each of those has exactly one.

| Race | Ability increase | Size / Speed | Notable level 1 traits and choices | Subrace in SRD |
| --- | --- | --- | --- | --- |
| Dwarf (p.3) | CON +2 | Medium / 25 ft (not reduced by heavy armor) | Darkvision 60, Dwarven Resilience, Dwarven Combat Training, **Tool Proficiency: choose one of smith's tools, brewer's supplies, mason's tools**, Stonecunning; Common, Dwarvish | **Hill Dwarf only** (p.4): WIS +1, Dwarven Toughness (+1 max HP, +1 per level) |
| Elf (p.4) | DEX +2 | Medium / 30 ft | Darkvision 60, Keen Senses (Perception), Fey Ancestry, Trance; Common, Elvish | **High Elf only** (p.4): INT +1, Elf Weapon Training, **one wizard cantrip (INT)**, **one extra language** |
| Halfling (p.4-5) | DEX +2 | Small / 25 ft | Lucky, Brave, Halfling Nimbleness; Common, Halfling | **Lightfoot only** (p.5): CHA +1, Naturally Stealthy |
| Human (p.5) | all six +1 | Medium / 30 ft | **One extra language of choice**; Common | none (no variant human, see 9) |
| Dragonborn (p.5-6) | STR +2, CHA +1 | Medium / 30 ft | **Choose Draconic Ancestry** (10 dragon types giving damage type, breath shape and save), Breath Weapon (2d6 at L1, DC 8 + CON mod + prof), Damage Resistance; Common, Draconic | none |
| Gnome (p.6) | INT +2 | Small / 25 ft | Darkvision 60, Gnome Cunning; Common, Gnomish | **Rock Gnome only** (p.6): CON +1, Artificer's Lore, Tinker (tinker's tools proficiency, clockwork device choice is in-play) |
| Half-Elf (p.6-7) | CHA +2, **two other abilities of choice +1** | Medium / 30 ft | Darkvision 60, Fey Ancestry, **Skill Versatility: two skills of choice**, **one extra language**; Common, Elvish | none |
| Half-Orc (p.7) | STR +2, CON +1 | Medium / 30 ft | Darkvision 60, Menacing (Intimidation), Relentless Endurance, Savage Attacks; Common, Orc | none |
| Tiefling (p.7) | INT +1, CHA +2 | Medium / 30 ft | Darkvision 60, Hellish Resistance (fire), Infernal Legacy (thaumaturgy cantrip at L1; hellish rebuke at 3rd, darkness at 5th); Common, Infernal | none |

Data-model notes: racial traits split cleanly into (a) fixed ability bonuses, (b) fixed proficiencies, languages, resistances and flat HP, (c) player choices (Dragonborn ancestry, Dwarf tool, High Elf cantrip and language, Human language, Half-Elf bonus abilities, skills and language), and (d) narrative-only traits. Languages are drawn from the Standard Languages table (Common, Dwarvish, Elvish, Giant, Gnomish, Goblin, Halfling, Orc; SRD p.59) and, with GM permission, the Exotic list (Abyssal, Celestial, Draconic, Deep Speech, Infernal, Primordial, Sylvan, Undercommon; p.59).

## 2. Classes: level 1 (SRD pp.8-55)

All twelve classes are present. Each has one fully written subclass in the SRD (Berserker, Lore, Life, Land, Champion, Open Hand, Devotion, Hunter, Thief, Draconic Bloodline, Fiend, Evocation). The Barbarian text names Totem Warrior, and the Warlock text names Archfey and Great Old One, but those are not detailed. Three classes choose their subclass at level 1: **Cleric (Divine Domain), Sorcerer (Sorcerous Origin), Warlock (Otherworldly Patron)**. Everyone else picks at level 2 or 3, so it is out of scope.

### 2.1 Core table

Proficiency bonus is +2 for every class at level 1 (Character Advancement table, SRD p.56).

| Class (page) | Hit die / HP at L1 | Armor | Weapons | Tools | Saves | Skills (choose) |
| --- | --- | --- | --- | --- | --- | --- |
| Barbarian (p.8) | d12 / 12 + CON | light, medium, shields | simple, martial | none | STR, CON | 2 of Animal Handling, Athletics, Intimidation, Nature, Perception, Survival |
| Bard (p.11) | d8 / 8 + CON | light | simple, hand crossbow, longsword, rapier, shortsword | **3 musical instruments of choice** | DEX, CHA | **any 3** |
| Cleric (p.15) | d8 / 8 + CON | light, medium, shields (+ heavy with Life domain) | simple | none | WIS, CHA | 2 of History, Insight, Medicine, Persuasion, Religion |
| Druid (p.19) | d8 / 8 + CON | light, medium, shields (no metal) | club, dagger, dart, javelin, mace, quarterstaff, scimitar, sickle, sling, spear | herbalism kit | INT, WIS | 2 of Arcana, Animal Handling, Insight, Medicine, Nature, Perception, Religion, Survival |
| Fighter (p.24) | d10 / 10 + CON | all armor, shields | simple, martial | none | STR, CON | 2 of Acrobatics, Animal Handling, Athletics, History, Insight, Intimidation, Perception, Survival |
| Monk (p.26) | d8 / 8 + CON | none | simple, shortsword | **one artisan's tool type or one instrument** | STR, DEX | 2 of Acrobatics, Athletics, History, Insight, Religion, Stealth |
| Paladin (p.30) | d10 / 10 + CON | all armor, shields | simple, martial | none | WIS, CHA | 2 of Athletics, Insight, Intimidation, Medicine, Persuasion, Religion |
| Ranger (p.35) | d10 / 10 + CON | light, medium, shields | simple, martial | none | STR, DEX | **3** of Animal Handling, Athletics, Insight, Investigation, Nature, Perception, Stealth, Survival |
| Rogue (p.39) | d8 / 8 + CON | light | simple, hand crossbow, longsword, rapier, shortsword | thieves' tools | DEX, INT | **4** of Acrobatics, Athletics, Deception, Insight, Intimidation, Investigation, Perception, Performance, Persuasion, Sleight of Hand, Stealth |
| Sorcerer (p.42) | d6 / 6 + CON | none | dagger, dart, sling, quarterstaff, light crossbow | none | CON, CHA | 2 of Arcana, Deception, Insight, Intimidation, Persuasion, Religion |
| Warlock (p.46) | d8 / 8 + CON | light | simple | none | WIS, CHA | 2 of Arcana, Deception, History, Intimidation, Investigation, Nature, Religion |
| Wizard (p.52) | d6 / 6 + CON | none | dagger, dart, sling, quarterstaff, light crossbow | none | INT, WIS | 2 of Arcana, History, Insight, Investigation, Medicine, Religion |

### 2.2 Level 1 features and choices

| Class | Level 1 features | Player choices at L1 |
| --- | --- | --- |
| Barbarian | Rage (2 uses, +2 damage), Unarmored Defense (AC 10 + DEX + CON, shield allowed) (p.8) | none beyond common ones |
| Bard | Spellcasting, Bardic Inspiration d6 (uses = CHA mod, min 1) (pp.11-12) | 2 cantrips, 4 spells, 3 instruments |
| Cleric | Spellcasting, Divine Domain (Life: heavy armor proficiency, Disciple of Life, domain spells bless and cure wounds always prepared) (pp.15-17) | domain (only Life is detailed), 3 cantrips, prepared spells |
| Druid | Druidic (language), Spellcasting (pp.19-20) | 2 cantrips, prepared spells |
| Fighter | Fighting Style, Second Wind (1d10 + level) (p.24) | style: Archery, Defense, Dueling, Great Weapon Fighting, Protection, Two-Weapon Fighting |
| Monk | Unarmored Defense (AC 10 + DEX + WIS, no armor or shield), Martial Arts (d4) (p.26) | tool/instrument |
| Paladin | Divine Sense (uses 1 + CHA mod), Lay on Hands (pool = level x 5) (pp.30-31) | none. Spellcasting and Fighting Style start at level 2, so no spells at L1 |
| Ranger | Favored Enemy, Natural Explorer (pp.35-36) | favored enemy (a creature type, or two humanoid races, plus an associated language), favored terrain (arctic, coast, desert, forest, grassland, mountain, swamp). Spellcasting and Fighting Style start at level 2, so no spells at L1 |
| Rogue | Expertise (2 skills, or 1 skill + thieves' tools), Sneak Attack 1d6, Thieves' Cant (pp.39-40) | expertise picks |
| Sorcerer | Spellcasting, Sorcerous Origin (Draconic Bloodline: Dragon Ancestor, +1 HP per level, unarmored AC 13 + DEX, Draconic language) (pp.42-45) | origin (only Draconic detailed), dragon type, 4 cantrips, 2 spells |
| Warlock | Otherworldly Patron (Fiend: Dark One's Blessing, expanded spells), Pact Magic (pp.46-47, 50) | patron (only Fiend detailed), 2 cantrips, 2 spells. Pact Boon is not until level 3 |
| Wizard | Spellcasting (spellbook), Arcane Recovery (pp.52-53) | 3 cantrips, 6 spellbook spells, prepared spells |

### 2.3 Starting equipment choice lists (verbatim structure; "in addition to the equipment granted by your background")

- **Barbarian (p.8):** (a) greataxe or (b) any martial melee weapon; (a) two handaxes or (b) any simple weapon; explorer's pack and four javelins.
- **Bard (p.11):** (a) rapier, (b) longsword or (c) any simple weapon; (a) diplomat's pack or (b) entertainer's pack; (a) lute or (b) any other musical instrument; leather armor and a dagger.
- **Cleric (p.15):** (a) mace or (b) warhammer (if proficient); (a) scale mail, (b) leather armor or (c) chain mail (if proficient); (a) light crossbow and 20 bolts or (b) any simple weapon; (a) priest's pack or (b) explorer's pack; a shield and a holy symbol.
- **Druid (p.19):** (a) wooden shield or (b) any simple weapon; (a) scimitar or (b) any simple melee weapon; leather armor, explorer's pack, druidic focus.
- **Fighter (p.24):** (a) chain mail or (b) leather armor, longbow and 20 arrows; (a) a martial weapon and a shield or (b) two martial weapons; (a) light crossbow and 20 bolts or (b) two handaxes; (a) dungeoneer's pack or (b) explorer's pack.
- **Monk (p.26):** (a) shortsword or (b) any simple weapon; (a) dungeoneer's pack or (b) explorer's pack; 10 darts.
- **Paladin (p.30):** (a) a martial weapon and a shield or (b) two martial weapons; (a) five javelins or (b) any simple melee weapon; (a) priest's pack or (b) explorer's pack; chain mail and a holy symbol.
- **Ranger (p.35):** (a) scale mail or (b) leather armor; (a) two shortswords or (b) two simple melee weapons; (a) dungeoneer's pack or (b) explorer's pack; a longbow and a quiver of 20 arrows.
- **Rogue (p.39):** (a) rapier or (b) shortsword; (a) shortbow and quiver of 20 arrows or (b) shortsword; (a) burglar's pack, (b) dungeoneer's pack or (c) explorer's pack; leather armor, two daggers and thieves' tools. (The SRD text labels the last bullet "(a)" with no alternative; read as fixed.)
- **Sorcerer (p.42):** (a) light crossbow and 20 bolts or (b) any simple weapon; (a) component pouch or (b) arcane focus; (a) dungeoneer's pack or (b) explorer's pack; two daggers.
- **Warlock (p.46):** (a) light crossbow and 20 bolts or (b) any simple weapon; (a) component pouch or (b) arcane focus; (a) scholar's pack or (b) dungeoneer's pack; leather armor, any simple weapon and two daggers.
- **Wizard (p.52):** (a) quarterstaff or (b) dagger; (a) component pouch or (b) arcane focus; (a) scholar's pack or (b) explorer's pack; a spellbook.

Reference tables needed to resolve the wildcards: Weapons table (simple/martial, melee/ranged, damage, properties) SRD pp.65-66; Armor table pp.63-64; Equipment Packs contents and prices p.70 (burglar's, diplomat's, dungeoneer's, entertainer's, explorer's, priest's, scholar's); arcane focus (crystal, orb, rod, staff, wand), druidic focus (sprig of mistletoe, totem, wooden staff, yew wand), holy symbol (amulet, emblem, reliquary), component pouch, and musical instruments (bagpipes, drum, dulcimer, flute, lute, lyre, horn, pan flute, shawm, viol) in the Adventuring Gear and Tools tables pp.69-70. Gaps: the SRD lists no "arcane focus" or "holy symbol" as a single item, so the app must pick a default variant (e.g. which of the five arcane focus kinds).

## 3. Spellcasting at level 1

| Class | Cantrips | Spell slots | Spells | Ability | Source |
| --- | --- | --- | --- | --- | --- |
| Bard | 2 | 2 x 1st | **knows** 4 first-level spells | CHA | pp.11-12 |
| Cleric | 3 | 2 x 1st | **prepares** WIS mod + level (min 1) from the whole cleric list; domain spells always prepared and free | WIS | pp.15-17 |
| Druid | 2 | 2 x 1st | **prepares** WIS mod + level (min 1) | WIS | pp.19-20 |
| Sorcerer | 4 | 2 x 1st | **knows** 2 first-level spells | CHA | pp.42-43 |
| Warlock | 2 | **1 slot, 1st-level** (Pact Magic, regained on short or long rest) | **knows** 2 first-level spells (Fiend expanded list adds burning hands, command at 1st) | CHA | pp.46-47, 50 |
| Wizard | 3 | 2 x 1st | spellbook of six 1st-level spells; **prepares** INT mod + level (min 1) from the book | INT | pp.52-53 |
| Paladin, Ranger | none at L1 | none | none (Spellcasting begins at level 2) | n/a | pp.30, 35 |
| Barbarian, Fighter, Monk, Rogue | none | none | none | n/a | n/a |

- Spell save DC = 8 + proficiency bonus + casting modifier; spell attack = proficiency bonus + casting modifier (same pages).
- Racial spells: High Elf (one wizard cantrip, INT), Tiefling (thaumaturgy, CHA) (pp.4, 7).
- Class spell lists with cantrips and 1st-level spells: SRD pp.105-111 ("Spell Lists"). Full text of spells: "Spell Descriptions", starting SRD p.114.
- Level 0 and 1 list sizes in the SRD: Bard 9 cantrips / 20 first-level. Cleric 7 / 15. Druid 7 / 16. Sorcerer 14 / 17. Warlock 7 cantrips / **7 first-level**. Wizard 14 / 27. Paladin and Ranger have first-level lists only (11 each, relevant at level 2+). Counts are from the extracted list text; a few names are shortened relative to the spell headers (e.g. "Floating Disk", "Hideous Laughter"), so name matching between list and description needs care.
- Not checked: that every name on these lists has a matching entry in the Spell Descriptions section.

## 4. Backgrounds (SRD pp.60-61)

- **The SRD ships exactly one background: Acolyte** (skills Insight, Religion; two languages of choice; holy symbol, prayer book or wheel, 5 incense, vestments, common clothes, pouch with 15 gp; feature Shelter of the Faithful). It includes the d8 personality trait, d6 ideal, d6 bond and d6 flaw tables.
- It includes **rules to customize a background** (p.60): replace the feature with another, choose any two skills, choose two tool proficiencies or languages from the sample backgrounds, use the equipment package or spend coin on gear, and choose two personality traits, one ideal, one bond, one flaw. If nothing fits, "work with your GM to create one".
- Duplicate-proficiency rule: if two sources grant the same proficiency, pick a different one of the same kind (p.60).
- Silent: no list of tool proficiencies to draw from other than Acolyte's (which grants none), no other features, no background trait tables beyond Acolyte's. "Choose two tool proficiencies or languages from the sample backgrounds" is effectively empty with one sample.

## 5. Ability scores

- **Generation methods: the SRD is silent.** Searches for "standard array", "point buy", "4d6", and "generat" found nothing relevant. The SRD has no character-creation chapter; it begins with races and classes. The three methods the map assumes (standard array 15/14/13/12/10/8, point buy 27 points, roll 4d6 drop lowest) are PHB content and are **not in the SRD**. The app must define them itself. They are widely used mechanics rather than SRD text; the legal and fidelity call is for the Spec.
- Score range and modifier: modifier = floor((score - 10) / 2); table covers 1 to 30 (Ability Scores and Modifiers, SRD p.76). Adventurers can reach 20 via level-up increases (p.56); maximum 20 (24 for Barbarian capstone) is out of scope at L1.
- Racial increases apply on top (Section 1). No rule caps the total at creation, and the SRD states no creation-time cap.

## 6. Derived-value formulas (all in SRD)

| Value | Rule | Source |
| --- | --- | --- |
| Ability modifier | floor((score - 10) / 2) | p.76 |
| Proficiency bonus | +2 at level 1 (table lookup; there is no closed formula in the SRD, the table is the rule) | p.56 |
| Hit points at L1 | max hit die + CON modifier, per class (12/10/8/6 + CON) | class entries, pp.8-52 |
| HP modifiers | Hill Dwarf +1 (p.4); Draconic Bloodline +1 (p.45). CON modifier can make HP low; the SRD does not state a minimum of 1 for the L1 value | pp.4, 45 |
| Armor Class | armor base from the Armor table plus DEX (light: full; medium: max +2; heavy: none), shield +2; no armor = 10 + DEX | pp.63-64 |
| Unarmored AC variants | Barbarian 10 + DEX + CON (shield ok); Monk 10 + DEX + WIS (no shield); Draconic Sorcerer 13 + DEX (no armor) | pp.8, 26, 45 |
| Fighting Style Defense | +1 AC while wearing armor | p.24 |
| Heavy armor | Strength requirement (Str 13/15): speed -10 if unmet; stealth disadvantage column; no proficiency means disadvantage on STR/DEX rolls and no spellcasting | pp.62-64 |
| Saving throw bonus | ability modifier, plus proficiency bonus if proficient (class grants two) | p.83 |
| Skill bonus | ability modifier of the skill's ability, plus proficiency bonus if proficient; Expertise doubles it | p.78 |
| Skill to ability map | 18 skills: STR Athletics; DEX Acrobatics, Sleight of Hand, Stealth; INT Arcana, History, Investigation, Nature, Religion; WIS Animal Handling, Insight, Medicine, Perception, Survival; CHA Deception, Intimidation, Performance, Persuasion | p.78 |
| Passive check | 10 + all modifiers (e.g. passive Perception) | pp.78-79 |
| Spell save DC / attack | 8 + prof + casting mod / prof + casting mod | class entries |
| Spell slots | class tables at L1 (Section 3) | class entries |
| Prepared spell count | casting mod + level, min 1 (Cleric, Druid, Wizard) | pp.16, 20, 53 |
| Speed | race base speed | Section 1 |

## 7. Thin or silent places (consolidated)

1. **Ability score generation**: standard array, point buy and 4d6-drop-lowest are all absent from the SRD (Section 5).
2. **Backgrounds**: only Acolyte plus a customization rule that points at a sample set of one (Section 4). A usable background for any other concept must come from the customization rule or app-authored content. Personality-trait tables exist only for Acolyte.
3. **Subraces**: only one subrace for each of four races; none for the other five (Section 1). No Mountain Dwarf, Wood or Dark Elf, Stout Halfling, Forest Gnome; no Variant Human (so no level 1 feat).
4. **Subclasses**: one per class; the Cleric, Sorcerer and Warlock choice at level 1 is therefore a single option each (Life, Draconic, Fiend). Totem Warrior, Archfey and Great Old One are named but not written.
5. **Feats**: the SRD has an optional feats rule with a single feat, Grappler (p.75). No creation-time feat path.
6. **Starting wealth / buy-your-own-gear**: the SRD refers to an optional rule to "spend coin on gear" (p.60) but contains no starting-gold-by-class table. Gold-buy is out of scope per the map; if it is ever added, the amounts would have to be app-defined.
7. **Equipment wildcards**: "any simple weapon", "any martial weapon", "any simple melee weapon", "any other musical instrument" resolve against the Weapons and Tools tables, but the SRD gives no list of exactly "monk weapons" beyond a definition, and "(if proficient)" on Cleric choices makes options conditional on the class's own proficiencies (the Cleric has no martial weapon or heavy armor proficiency except heavy armor via the Life domain, so the warhammer and chain mail options depend on a domain choice). The Rogue final bullet is mislabelled "(a)".
8. **Background coin**: the Acolyte package includes 15 gp alongside class equipment (p.61); the SRD states no cap on total coin.
9. **Deity and pantheon**: Acolyte and Cleric text refer to gods from the "Fantasy-Historical Pantheons" appendix (Appendix PH-B, SRD p.360: Celtic, Egyptian, Greek, Norse); the SRD does not ship the Forgotten Realms or Dragonlance pantheons.
10. **Names, height/weight, age tables, physical appearance**: race entries give only prose ranges for age and size. No name lists or random height/weight tables.
11. **Alignment**: nine alignments described (pp.58-59); race text gives tendencies only, not restrictions.
12. **Languages**: Standard and Exotic lists (p.59). Several class and race entries say "your choice" without restricting to Standard.
13. **Class text assumes the PHB's creation order** (e.g. "granted by your background") but the SRD never states the order of choices or a step-by-step procedure. The wizard's step order is therefore an app decision.
14. **Level 1 and CON**: the SRD gives no minimum HP of 1 for a character at level 1 with a very low CON modifier. Not likely to matter, since the lowest L1 die is 6 and the lowest CON modifier on a standard array/point buy is -1, but rolled scores could reach 3 (-4 modifier).
15. **Not verified in this pass**: that every spell on the L0/L1 lists has a Spell Descriptions entry.

## 8. Suggested handoff to downstream tickets

- Rules Data module (#91): needs the table in Section 1 (traits and choices), Section 2 (class definitions and equipment choice lists), Section 3 (spell lists and counts), plus the Weapons, Armor, Packs, and Tools tables.
- The AI-owned (Proposal) surface should cover narrative fields only: background flavor, personality traits, ideal, bond, flaw, name, appearance. The SRD ships one trait set (Acolyte), so the app or the LLM must author the rest.

## 9. Variant Human note

The SRD's Human is the plain version (+1 to all abilities, one extra language). The Variant Human (two +1s, a skill, a feat) is not in the SRD.
