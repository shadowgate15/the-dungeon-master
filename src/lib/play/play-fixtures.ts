import type { PlaySheet } from './sheet'
import type { PendingDeclaration } from './floor'
import type { TimelineEntry } from './timeline'

/** Sample sheets for stories and component tests. */
const base = {
  whereabouts: null,
  canAct: true,
  conditions: [],
  concentration: null,
  spellSlots: [],
  features: [],
  inventory: []
} satisfies Partial<PlaySheet>

export const sheets: PlaySheet[] = [
  {
    ...base,
    id: 'wren',
    name: 'Wren',
    headline: 'Lightfoot Halfling Ranger 1',
    hp: { current: 9, max: 12, temp: 0 },
    ac: { value: 14, note: 'unarmored' },
    conditions: ['poisoned'],
    concentration: 'bless',
    abilities: [
      { key: 'str', score: 10, modifier: 0 },
      { key: 'dex', score: 16, modifier: 3 },
      { key: 'con', score: 14, modifier: 2 },
      { key: 'int', score: 10, modifier: 0 },
      { key: 'wis', score: 14, modifier: 2 },
      { key: 'cha', score: 8, modifier: -1 }
    ],
    attacks: [{ name: 'Shortbow', attackBonus: 5, damage: '1d6+3 piercing' }],
    spellSlots: [{ level: 1, max: 2, spent: 1 }],
    features: [
      { slug: 'second-wind', name: 'Second Wind', spent: 1 },
      { slug: 'favored-enemy', name: 'Favored Enemy', spent: 0 }
    ],
    inventory: [
      { name: 'Rope, hempen (50 feet)', quantity: 1 },
      { name: 'Arrow', quantity: 20 }
    ]
  },
  {
    ...base,
    id: 'bram',
    name: 'Bram',
    headline: 'Hill Dwarf Cleric 1',
    whereabouts: 'the cellar',
    hp: { current: 11, max: 11, temp: 0 },
    ac: { value: 10, note: 'unarmored' },
    abilities: [
      { key: 'str', score: 14, modifier: 2 },
      { key: 'dex', score: 10, modifier: 0 },
      { key: 'con', score: 15, modifier: 2 },
      { key: 'int', score: 8, modifier: -1 },
      { key: 'wis', score: 16, modifier: 3 },
      { key: 'cha', score: 12, modifier: 1 }
    ],
    attacks: [{ name: 'Mace', attackBonus: 4, damage: '1d6+2 bludgeoning' }]
  },
  {
    ...base,
    id: 'osric',
    name: 'Osric',
    headline: 'Human Wizard 1',
    canAct: false,
    hp: { current: 0, max: 8, temp: 0 },
    ac: { value: 11, note: 'unarmored' },
    abilities: [],
    attacks: []
  }
]

export const declarations: PendingDeclaration[] = [
  {
    id: 'd1',
    character: 'wren',
    characterName: 'Wren',
    player: 'player',
    text: 'I keep my back to the stairs.'
  },
  { id: 'd2', character: 'bram', characterName: 'Bram', player: 'player', text: 'I bar the door.' }
]

/** A short play turn, for the timeline. */
export const timelineEntries: TimelineEntry[] = [
  { type: 'declaration', id: 'e1', character: 'Wren', player: 'player', text: 'I pick the lock.' },
  { type: 'activity', id: 'a1', text: 'DM checks their notes' },
  { type: 'narration', id: 'e2', text: 'The lock clicks open.', voice: null },
  { type: 'narration', id: 'e3', text: '"You are late," she says.', voice: 'Mira Voss' }
]
