import { DATABASE_MIT_NOTICE, SRD_ATTRIBUTION, SRD_LICENSE_URL } from '../../rules/attribution'
import type { RulesRepository } from './repository'

/** Each kind of SRD content the seeded Rules Data includes, with how many entries it has. */
function contents(repo: RulesRepository) {
  return [
    { name: 'Races', count: repo.races().length },
    { name: 'Subraces', count: repo.subraces().length },
    { name: 'Classes', count: repo.classes().length },
    { name: 'Subclasses', count: repo.subclasses().length },
    { name: 'Class features', count: repo.features().length },
    { name: 'Backgrounds', count: repo.backgrounds().filter((b) => !b.appAuthored).length },
    { name: 'Spells', count: repo.spells().length },
    { name: 'Equipment', count: repo.equipment().length },
    { name: 'Magic items', count: repo.magicItems().length },
    { name: 'Monsters', count: repo.monsters().length },
    { name: 'Conditions', count: repo.conditions().length },
    { name: 'Rules sections', count: repo.ruleSections().length }
  ]
}

/** What the credits page shows: the licence texts and the seeded dataset version. */
export function loadCredits(repo: RulesRepository) {
  const dataset = repo.datasetInfo()
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
  }
}
