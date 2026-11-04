import { DATABASE_MIT_NOTICE, SRD_ATTRIBUTION, SRD_LICENSE_URL } from '../../rules/attribution'
import type { RulesRepository } from './repository'

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
      srdVersion: dataset.srdVersion
    }
  }
}
