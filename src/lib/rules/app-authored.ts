import type { AbilityScoreMethod, Background } from './schema.ts'

/**
 * Rules the app defines itself because the SRD 5.1 is silent. They are written into the committed
 * Rules Data by the normalizer and marked `appAuthored`, so they are never mistaken for SRD text.
 */

export const ABILITY_SCORE_METHODS: AbilityScoreMethod[] = [
  {
    slug: 'standard-array',
    name: 'Standard array',
    description: 'Assign 15, 14, 13, 12, 10 and 8 to the six abilities, one value each.',
    appAuthored: true,
    config: { type: 'standardArray', values: [15, 14, 13, 12, 10, 8] }
  },
  {
    slug: 'point-buy',
    name: 'Point buy',
    description:
      'Spend up to 27 points. Every ability starts at 8 and can be raised to 15 before racial bonuses.',
    appAuthored: true,
    config: {
      type: 'pointBuy',
      budget: 27,
      min: 8,
      max: 15,
      costs: { '8': 0, '9': 1, '10': 2, '11': 3, '12': 4, '13': 5, '14': 7, '15': 9 }
    }
  },
  {
    slug: 'roll',
    name: 'Roll',
    description:
      'Roll 4d6 six times, dropping the lowest die each time, then assign the totals to the abilities.',
    appAuthored: true,
    config: { type: 'roll', count: 6, dice: 4, sides: 6, dropLowest: 1 }
  }
]

/**
 * The SRD ships one background (Acolyte) and a customization rule (SRD 5.1 p.60). This row is that
 * rule as a pickable background: the player writes the feature, picks two skills and two tools or
 * languages, and gets a fixed equipment package mirroring Acolyte's shape.
 */
export const CUSTOM_BACKGROUND: Background = {
  slug: 'custom',
  name: 'Custom background',
  appAuthored: true,
  description:
    'Build your own background from the SRD customization rule: a name, two skill proficiencies, two tool or language proficiencies, and a feature you write yourself.',
  feature: null,
  proficiencies: [],
  startingEquipment: [
    { item: 'clothes-common', quantity: 1 },
    { item: 'pouch', quantity: 1 }
  ],
  startingGoldQuantity: 15,
  startingGoldUnit: 'gp',
  options: [],
  choiceGroups: []
}
