// PROTOTYPE: mock play-screen data shaped like the plugin-rebuild model
// (Party, Scene, Floor, Calls, Combat, Beliefs). Not real; wipe with the prototype.

export type Character = {
  handle: string
  name: string
  cls: string
  level: number
  hp: number
  maxHp: number
  tempHp?: number
  ac: number
  conditions: string[]
  concentrating?: string
  slots?: { level: number; used: number; max: number }[]
  features?: { name: string; used: number; max: number; per: string }[]
  abilities: Record<'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA', number>
  attacks: { name: string; toHit: number; damage: string }[]
  inventory: string[]
  whereabouts: string | null // null = in the Scene
}

export const party: Character[] = [
  {
    handle: 'char:wren',
    name: 'Wren',
    cls: 'Fighter',
    level: 3,
    hp: 22,
    maxHp: 28,
    ac: 17,
    conditions: [],
    features: [
      { name: 'Second Wind', used: 0, max: 1, per: 'short rest' },
      { name: 'Action Surge', used: 1, max: 1, per: 'short rest' }
    ],
    abilities: { STR: 16, DEX: 12, CON: 14, INT: 10, WIS: 13, CHA: 8 },
    attacks: [
      { name: 'Longsword', toHit: 5, damage: '1d8+3 slashing' },
      { name: 'Light crossbow', toHit: 3, damage: '1d8+1 piercing' }
    ],
    inventory: ['Chain mail', 'Shield', 'Longsword', 'Light crossbow (14 bolts)', '23 gp'],
    whereabouts: null
  },
  {
    handle: 'char:bram',
    name: 'Bram',
    cls: 'Cleric',
    level: 3,
    hp: 9,
    maxHp: 24,
    ac: 16,
    conditions: ['Poisoned'],
    concentrating: 'Bless',
    slots: [
      { level: 1, used: 2, max: 4 },
      { level: 2, used: 1, max: 2 }
    ],
    abilities: { STR: 12, DEX: 10, CON: 14, INT: 11, WIS: 16, CHA: 12 },
    attacks: [{ name: 'Mace', toHit: 3, damage: '1d6+1 bludgeoning' }],
    inventory: ['Scale mail', 'Shield', 'Mace', 'Holy symbol', '8 gp'],
    whereabouts: null
  },
  {
    handle: 'char:ilsa',
    name: 'Ilsa',
    cls: 'Rogue',
    level: 3,
    hp: 19,
    maxHp: 19,
    ac: 14,
    conditions: [],
    abilities: { STR: 8, DEX: 17, CON: 12, INT: 13, WIS: 12, CHA: 14 },
    attacks: [{ name: 'Shortsword', toHit: 5, damage: '1d6+3 piercing' }],
    inventory: ['Leather armor', "Thieves' tools", 'Shortsword', '41 gp'],
    whereabouts: 'the docks'
  }
]

export const scene = {
  place: 'The Drowned Lantern, cellar',
  clock: 'Day 3, 21:40',
  light: 'dim, one lantern',
  npcsPresent: ['Marrow the fence']
}

export type DiceEntry = {
  id: string
  who: string
  what: string
  dice: string
  total: number
  outcome?: string
  note?: string
}

export const dice: DiceEntry[] = [
  { id: 'd1', who: 'Wren', what: 'Perception', dice: 'd20 (11) +1', total: 12 },
  { id: 'd2', who: 'Bram', what: 'Insight', dice: 'd20 (17) +3', total: 20 },
  {
    id: 'd3',
    who: 'Goblin 1',
    what: 'Scimitar vs Bram',
    dice: 'd20 (15) +4',
    total: 19,
    outcome: 'hit'
  },
  { id: 'd4', who: 'Goblin 1', what: 'Damage to Bram', dice: '1d6 (4) +2', total: 6 },
  {
    id: 'd5',
    who: 'Bram',
    what: 'CON save (concentration)',
    dice: 'd20 (13) +2',
    total: 15,
    outcome: 'kept Bless'
  },
  {
    id: 'd6',
    who: 'Wren',
    what: 'Longsword vs Goblin 2',
    dice: '2d20 keep high (6, 18) +5',
    total: 23,
    outcome: 'hit',
    note: 'advantage: goblin is prone'
  },
  {
    id: 'd7',
    who: 'Wren',
    what: 'Damage to Goblin 2',
    dice: '1d8 (7) +3',
    total: 10,
    outcome: 'down'
  }
]

export type Story =
  | { kind: 'narration'; id: string; text: string; recap?: boolean }
  | { kind: 'floor'; id: string; lines: { who: string; text: string }[] }
  | { kind: 'dice'; id: string; ref: string }

export const story: Story[] = [
  {
    kind: 'narration',
    id: 'n0',
    recap: true,
    text: 'Last time: you followed the smuggler’s chalk marks down to the Drowned Lantern, and Marrow agreed to talk, for a price.'
  },
  {
    kind: 'floor',
    id: 'f1',
    lines: [
      { who: 'Wren', text: 'I keep my back to the stairs and watch the cellar door.' },
      { who: 'Bram', text: '“Who else knows you’re down here, Marrow?”' }
    ]
  },
  { kind: 'dice', id: 's1', ref: 'd1' },
  { kind: 'dice', id: 's2', ref: 'd2' },
  {
    kind: 'narration',
    id: 'n1',
    text: 'Marrow’s eyes flick to the barrels a heartbeat too long. “No one,” he says. Bram knows a lie when it sweats. Then the barrel lids burst upward and two goblins spill out, blades already swinging.'
  },
  { kind: 'dice', id: 's3', ref: 'd3' },
  { kind: 'dice', id: 's4', ref: 'd4' },
  { kind: 'dice', id: 's5', ref: 'd5' },
  {
    kind: 'narration',
    id: 'n2',
    text: 'A scimitar opens Bram’s forearm, but his prayer holds. Wren, the second goblin has tripped over its own barrel and is sprawled at your feet.'
  },
  { kind: 'dice', id: 's6', ref: 'd6' },
  { kind: 'dice', id: 's7', ref: 'd7' },
  {
    kind: 'narration',
    id: 'n3',
    text: 'Your longsword comes down once and the goblin stops moving. The other one shrieks and backs toward the cellar’s far drain, eyeing Marrow as if waiting for an order.'
  }
]

/** The Call attached to the latest Narration: one button per Character it names. */
export const openCall = {
  id: 'c44',
  prompt: 'The goblin bolts past Bram.',
  rolls: [{ who: 'Bram', label: 'Opportunity attack (Mace)', options: ['Attack', 'Pass'] }]
}

export const combat = {
  round: 2,
  order: [
    { name: 'Wren', init: 18, kind: 'character', state: '22/28' },
    { name: 'Goblin 1', init: 15, kind: 'creature', state: 'bloodied' },
    { name: 'Bram', init: 11, kind: 'character', state: '9/24' },
    { name: 'Marrow', init: 9, kind: 'npc', state: 'unhurt' },
    { name: 'Goblin 2', init: 7, kind: 'creature', state: 'down' }
  ],
  current: 2,
  economy: { action: true, bonus: false, reaction: false, movement: true }
}

/** What the Party knows: Beliefs held by the Characters (possibly false). */
export const beliefs = [
  { holder: 'Wren', text: 'Marrow fences goods for the Gilded Hand.', source: 'Marrow, Day 3' },
  { holder: 'Bram', text: 'Marrow lied about being alone.', source: 'Insight, Day 3' },
  {
    holder: 'Party',
    text: 'The Drowned Lantern’s cellar floods at high tide.',
    source: 'The lantern-keeper, Day 2'
  },
  {
    holder: 'Ilsa',
    text: 'A grey-sailed cog unloads at the docks after midnight.',
    source: 'Dockhand, Day 3'
  }
]

/** DM tool activity, Player-safe: no handles of hidden Entities, no enemy numbers. */
export const activity = [
  { t: '21:40:02', text: 'looked up rules: Opportunity attack' },
  { t: '21:40:04', text: 'rolled for Goblin 1' },
  { t: '21:40:05', text: 'moved Goblin 1 toward the drain' },
  { t: '21:40:09', text: 'asked Bram for a reaction' }
]

export const sessions = [
  { n: 3, summary: 'Followed chalk marks to the Drowned Lantern; struck a deal with Marrow.' },
  { n: 2, summary: 'Arrived in Saltmere; Ilsa lifted a ledger from a customs clerk.' }
]

export const permission = {
  tool: 'Bash',
  detail: 'git commit -m "campaign: day 3"',
  why: 'The DM wants to run a command outside the game tools.'
}

export type DmStatus = 'idle' | 'thinking' | 'permission'
