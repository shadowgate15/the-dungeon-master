// PROTOTYPE (throwaway): the hand-written mini scenario. See src/lib/prototype/README.md.

export const PLAYER = 'Rowan, a human rogue'

export interface NpcDef {
  id: string
  name: string
  occupation: string
  persona: string
  attitude: string
  knowledge: string
  home: string
}

export interface LocationDef {
  id: string
  name: string
  description: string
  objects: string[]
  exits: { id: string; label: string; to: string }[]
}

export const LOCATIONS: Record<string, LocationDef> = {
  tavern: {
    id: 'tavern',
    name: 'The Sleeping Griffin',
    description:
      'A low-beamed common room smelling of smoke and stew. Rain drums on the shutters, and a handful of farmers eye the stranger who just walked in.',
    objects: ['a notice board', 'the hearth', 'a locked cellar door'],
    exits: [{ id: 'road', label: 'the muddy road outside', to: 'road' }]
  },
  road: {
    id: 'road',
    name: 'The Mud Road',
    description:
      'A rutted track climbing toward the hills under a low grey sky. A wrecked wagon lies on its side in the ditch, half hidden by brambles.',
    objects: ['the wrecked wagon', 'a signpost', 'fresh wheel ruts'],
    exits: [{ id: 'tavern', label: 'the Sleeping Griffin inn', to: 'tavern' }]
  }
}

export const NPCS: NpcDef[] = [
  {
    id: 'marta',
    name: 'Marta Brightkettle',
    occupation: 'innkeeper',
    persona:
      'Gruff and practical, speaks in short sentences, has a soft spot for strays and no patience for trouble in her taproom.',
    attitude: 'neutral, warming to anyone who buys a drink',
    knowledge:
      'The Harlow caravan is three days overdue. She has a spare key to the cellar but will not lend it without a good reason.',
    home: 'tavern'
  },
  {
    id: 'tobb',
    name: 'Old Tobb',
    occupation: 'retired soldier',
    persona: 'Boastful, rambling and half drunk. Loves an audience and exaggerates wildly.',
    attitude: 'friendly, eager to trade stories for ale',
    knowledge:
      'Saw strange green lights at the abandoned mill two nights ago, but is afraid to say so when sober.',
    home: 'tavern'
  },
  {
    id: 'vey',
    name: 'Sister Vey',
    occupation: 'travelling priest',
    persona: 'Formal, wary and precise. Speaks in clipped sentences and distrusts strangers.',
    attitude: 'suspicious',
    knowledge:
      "The wagon's crates carry a cult sigil she recognizes: a circle split by three lines. She is hunting the people who made it.",
    home: 'road'
  }
]

/** The DC a code rule table assigns to each check the director may ask for. */
export const ROLL_DCS: Record<string, number> = {
  perception: 12,
  persuasion: 13,
  insight: 12,
  intimidation: 14,
  investigation: 12
}

/** The flat modifier code adds to the player's d20 in the prototype. */
export const ROLL_MODIFIER = 2

export const OPENING =
  'Rain hammers the shutters as you push open the door of the Sleeping Griffin and shake the water from your cloak.'
