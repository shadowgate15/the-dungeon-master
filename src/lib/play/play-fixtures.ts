import type { PlaySheet } from './sheet'
import type { JournalEntry } from './journal'
import type { PendingDeclaration } from './floor'
import type { OpenCall } from './call'
import type { TimelineEntry } from './timeline'
import type { SessionSummary } from './sessions'

/** Sample sheets for stories and component tests. */
const base = {
  whereabouts: null,
  canAct: true,
  conditions: [],
  concentration: null,
  deathSaves: null,
  spellSlots: [],
  features: [],
  inventory: [],
  hitDice: null,
  coin: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
  levelUp: null,
  details: {
    notes: null,
    personality: 'Wry and watchful',
    appearance: null,
    backstory: 'Raised on the Ember Road by a caravan guard.'
  }
} satisfies Partial<PlaySheet>

/** A level the DM awarded with two spells to pick, as a Wizard's spellbook asks. */
export const levelUpOffer: NonNullable<PlaySheet['levelUp']> = {
  level: 2,
  cantrips: { count: 0, options: [] },
  spells: {
    count: 2,
    options: [
      { slug: 'magic-missile', name: 'Magic Missile' },
      { slug: 'shield', name: 'Shield' },
      { slug: 'sleep', name: 'Sleep' }
    ]
  }
}

export const sheets: PlaySheet[] = [
  {
    ...base,
    id: 'wren',
    name: 'Wren',
    headline: 'Lightfoot Halfling Ranger 1',
    hp: { current: 9, max: 12, temp: 0 },
    ac: { value: 14, note: 'Leather Armor' },
    conditions: ['poisoned'],
    hitDice: { die: 10, total: 1, spent: 0 },
    coin: { cp: 0, sp: 4, ep: 0, gp: 12, pp: 0 },
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
      { name: 'Leather Armor', quantity: 1, equipped: true },
      { name: 'Rope, hempen (50 feet)', quantity: 1, equipped: false },
      { name: 'Arrow', quantity: 20, equipped: false }
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
    conditions: ['unconscious'],
    deathSaves: { successes: 1, failures: 2, stable: false },
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

/** A Journal: one entry two Characters share, one rumour with its source, one field. */
export const journalEntries: JournalEntry[] = [
  {
    id: 'b1',
    about: { name: 'Mira Voss', type: 'npc' },
    text: 'Mira owes the harbourmaster money',
    source: null,
    holders: [
      { id: 'wren', name: 'Wren' },
      { id: 'kael', name: 'Kael' }
    ]
  },
  {
    id: 'b3',
    about: { name: 'Mira Voss', type: 'npc' },
    text: 'Mira sailed for the Isles',
    source: 'a dockhand',
    holders: [{ id: 'wren', name: 'Wren' }]
  },
  {
    id: 'b4',
    about: { name: 'Saltgate', type: 'place' },
    text: 'Saltgate',
    source: null,
    holders: [{ id: 'kael', name: 'Kael' }]
  }
]

/** An open Check Call for two Characters; Bram rolls with advantage. */
export const checkCall: OpenCall = {
  id: 'c1',
  kind: 'check',
  text: null,
  choices: [],
  parts: [
    {
      id: 'p1',
      character: 'Wren',
      player: 'player',
      label: 'Sleight of Hand check',
      reason: 'The lock is old and stiff',
      mode: 'normal',
      answered: false,
      next: null,
      hitDice: null,
      offer: null
    },
    {
      id: 'p2',
      character: 'Bram',
      player: 'player',
      label: 'Perception check',
      reason: 'Bram knows these streets',
      mode: 'advantage',
      answered: false,
      next: null,
      hitDice: null,
      offer: null
    }
  ]
}

/** An open question Call with choices. */
export const questionCall: OpenCall = {
  id: 'c2',
  kind: 'question',
  text: 'Which door?',
  choices: ['Left', 'Right'],
  parts: [
    {
      id: 'p3',
      character: null,
      player: 'player',
      label: null,
      reason: null,
      mode: 'normal',
      answered: false,
      next: null,
      hitDice: null,
      offer: null
    }
  ]
}

/** Two rolls of a Call: a normal one and one on advantage. */
export const rollEntries: TimelineEntry[] = [
  {
    type: 'roll',
    id: 'e4',
    character: 'Wren',
    what: 'Sleight of Hand check',
    dice: [14],
    modifier: 5,
    total: 19,
    outcome: 'success',
    mode: 'normal',
    reason: null,
    target: null
  },
  {
    type: 'roll',
    id: 'e5',
    character: 'Bram',
    what: 'Perception check',
    dice: [4, 17],
    modifier: -1,
    total: 16,
    outcome: 'failure',
    mode: 'advantage',
    reason: 'Bram knows these streets',
    target: null
  },
  { type: 'answer', id: 'e6', player: 'player', question: 'Which door?', text: 'Left' }
]

/** A short rest's Call: Wren has two of three d10 Hit Dice left to spend. */
export const hitDiceCall: OpenCall = {
  id: 'call-3',
  kind: 'hit_dice',
  text: 'How many Hit Dice do you spend?',
  choices: [],
  parts: [
    {
      id: 'part-5',
      character: 'Wren',
      player: 'player',
      label: 'Hit Dice',
      reason: null,
      mode: 'normal',
      answered: false,
      next: null,
      hitDice: { die: 10, available: 2 },
      offer: null
    }
  ]
}

/** An attack Call mid-sequence: Wren has rolled to hit and rolls damage next. */
export const attackCall: OpenCall = {
  id: 'c3',
  kind: 'roll_sequence',
  text: null,
  choices: [],
  parts: [
    {
      id: 'p4',
      character: 'Wren',
      player: 'player',
      label: 'Crossbow, light attack',
      reason: null,
      mode: 'normal',
      answered: false,
      next: 'damage',
      hitDice: null,
      offer: null
    }
  ]
}

/** A reaction offered: Wren can take an opportunity attack on the fleeing goblin, or pass. */
export const reactionCall: OpenCall = {
  id: 'c4',
  kind: 'reaction',
  text: 'Wren can make an opportunity attack on Goblin 1',
  choices: ['Attack', 'Pass'],
  parts: [
    {
      id: 'p5',
      character: 'Wren',
      player: 'player',
      label: 'Opportunity attack',
      reason: null,
      mode: 'normal',
      answered: false,
      next: 'to hit',
      hitDice: null,
      offer: ['Attack', 'Pass']
    }
  ]
}

/** An attack's rolls: a hit, then damage that leaves the goblin bloodied; then a miss. */
export const attackRollEntries: TimelineEntry[] = [
  {
    type: 'roll',
    id: 'e7',
    character: 'Wren',
    what: 'Crossbow, light attack',
    dice: [15],
    modifier: 4,
    total: 19,
    outcome: 'hit',
    mode: 'normal',
    reason: null,
    target: null
  },
  {
    type: 'roll',
    id: 'e8',
    character: 'Wren',
    what: 'Crossbow, light damage',
    dice: [3],
    modifier: 2,
    total: 5,
    outcome: null,
    mode: 'normal',
    reason: null,
    target: { name: 'Grik', state: 'bloodied' }
  },
  {
    type: 'roll',
    id: 'e9-0',
    character: 'Grik',
    what: 'Scimitar attack',
    dice: [2],
    modifier: 4,
    total: 6,
    outcome: 'miss',
    mode: 'normal',
    reason: null,
    target: null
  }
]

/** Two closed Sessions as the Player's Session history shows them, newest first. */
export const sessionSummaries: SessionSummary[] = [
  {
    number: 2,
    startedAt: Date.UTC(2026, 10, 21, 19, 0),
    span: { from: 1_440 + 600, to: 1_440 + 780 },
    summary: 'Wren followed Mira to the docks and learned she sails for the Isles at dawn.',
    threads: ['Why is Mira leaving?', 'Who signed the ledger?']
  },
  {
    number: 1,
    startedAt: Date.UTC(2026, 10, 20, 19, 0),
    span: { from: 0, to: 0 },
    summary: 'Wren picked the lock of the harbour office and found the ledger.',
    threads: []
  }
]
