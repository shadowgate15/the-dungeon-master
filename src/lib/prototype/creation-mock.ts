// PROTOTYPE: mock creation-state data (Seed card, Character drafts, DM conversation). Wipe me.

export const seed = [
  { key: 'name', label: 'Campaign name', value: 'The Salt Road', by: 'player' },
  { key: 'tone', label: 'Tone', value: 'Grim but hopeful; low magic', by: 'dm' },
  {
    key: 'premise',
    label: 'Premise',
    value:
      'A drowned trade road resurfaces each spring, and smugglers race the tide for what it uncovers.',
    by: 'dm'
  },
  { key: 'length', label: 'Length', value: 'Short (2–3 Arcs)', by: 'player' },
  { key: 'themes', label: 'Themes', value: '', by: null },
  { key: 'limits', label: 'Lines & veils', value: 'No harm to children', by: 'player' }
] as const

export const wizardSteps = ['Ancestry', 'Class', 'Abilities', 'Background', 'Equipment', 'Details']

export const characters = [
  { name: 'Wren', summary: 'Human Fighter 1', status: 'saved' as const, step: 6 },
  { name: 'Bram', summary: 'Dwarf Cleric 1', status: 'draft' as const, step: 3 }
]

export const draft = {
  name: 'Bram',
  step: 3,
  fields: [
    { label: 'Background', value: 'Acolyte', by: 'dm' },
    { label: 'Personality trait', value: 'Quotes scripture at the worst moments.', by: 'dm' },
    { label: 'Ideal', value: '', by: null },
    { label: 'Bond', value: 'Owes his life to the Saltmere lighthouse keeper.', by: 'player' }
  ]
}

export const chat = [
  { who: 'player', text: 'Can you help me make the campaign feel more coastal?' },
  {
    who: 'dm',
    text: 'Gladly. I’ve set the tone to grim but hopeful and written a premise about a drowned trade road. Want themes too, or leave those to you?'
  },
  { who: 'tool', text: 'set Seed: tone, premise' },
  { who: 'player', text: 'Leave themes. Now help Bram: he’s a cleric, what background?' },
  {
    who: 'dm',
    text: 'Acolyte fits a cleric of a sea shrine. I’ve filled it in with a personality trait; take a look in the wizard.'
  },
  { who: 'tool', text: 'set draft Bram: background, personality trait' }
]

export const beginReady = { seedValid: true, partyCount: 1 }
