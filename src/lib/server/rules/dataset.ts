import { rulesDataset, type RulesDataset } from '../../rules/schema'
import meta from '../../rules/data/meta.json'
import abilities from '../../rules/data/abilities.json'
import skills from '../../rules/data/skills.json'
import languages from '../../rules/data/languages.json'
import alignments from '../../rules/data/alignments.json'
import damageTypes from '../../rules/data/damageTypes.json'
import magicSchools from '../../rules/data/magicSchools.json'
import weaponProperties from '../../rules/data/weaponProperties.json'
import proficiencies from '../../rules/data/proficiencies.json'
import equipmentCategories from '../../rules/data/equipmentCategories.json'
import equipment from '../../rules/data/equipment.json'
import traits from '../../rules/data/traits.json'
import races from '../../rules/data/races.json'
import subraces from '../../rules/data/subraces.json'
import classes from '../../rules/data/classes.json'
import classLevels from '../../rules/data/classLevels.json'
import subclasses from '../../rules/data/subclasses.json'
import subclassLevels from '../../rules/data/subclassLevels.json'
import features from '../../rules/data/features.json'
import spells from '../../rules/data/spells.json'
import backgrounds from '../../rules/data/backgrounds.json'
import abilityScoreMethods from '../../rules/data/abilityScoreMethods.json'

/** The committed, normalized Rules Data, validated on load. */
export function loadRulesDataset(): RulesDataset {
  return rulesDataset.parse({
    meta,
    abilities,
    skills,
    languages,
    alignments,
    damageTypes,
    magicSchools,
    weaponProperties,
    proficiencies,
    equipmentCategories,
    equipment,
    traits,
    races,
    subraces,
    classes,
    classLevels,
    subclasses,
    subclassLevels,
    features,
    spells,
    backgrounds,
    abilityScoreMethods
  })
}
