// Scripted Exchange cases: a fixture Scene, a declaration, the expected Adjudication outcome
// (plus acceptable skills for checks) and, where the case has one, the expected Effect.
import type { Check, Effect, FixtureScene, Outcome } from './contract.ts'

export const CHARACTER = { name: 'Mira Ashdown', summary: 'a level 1 human rogue' }

const TAVERN: FixtureScene = {
  location: {
    name: 'The Drowned Lantern',
    description: 'A low, smoky harbor tavern. Rain drums on the shutters.'
  },
  exits: [
    { id: 'exit-street', name: 'Front door out to Harbor Street' },
    { id: 'exit-cellar', name: 'Trapdoor down to the cellar' },
    { id: 'exit-stairs', name: 'Stairs up to the rented rooms' }
  ],
  objects: [
    'a half-full mug of ale on your table',
    'a notice board by the door',
    'a cold hearth',
    'a locked iron-bound chest behind the bar'
  ],
  npcs: [
    { id: 'npc-maren', name: 'Maren Holt', note: 'the barkeep, friendly' },
    { id: 'npc-voss', name: 'Sergeant Voss', note: 'an off-duty city watchman, suspicious' }
  ],
  mode: 'exploration',
  dialogueNpcId: null,
  events: [
    'narrator: You shake the rain from your cloak as the door bangs shut behind you.',
    'narrator: Maren wipes down the bar. Sergeant Voss watches you over his tankard.',
    'Player: I sit at a corner table and order an ale.',
    'narrator: Maren sets a mug in front of you and returns to the bar.'
  ]
}

const TAVERN_DIALOGUE: FixtureScene = {
  ...TAVERN,
  mode: 'dialogue',
  dialogueNpcId: 'npc-maren',
  events: [
    'Player: I lean on the bar and ask Maren how business is.',
    'npc: (Maren Holt) Slow, with the watch sniffing round every night. Smugglers, they say.',
    'Player: Smugglers? Here?',
    'npc: (Maren Holt) Don’t look at me like that. I just pour the ale.'
  ]
}

const HARBOR_WALL: FixtureScene = {
  location: {
    name: 'The Harbor Wall',
    description:
      'Night, heavy rain. A fifteen-foot seawall slick with water separates the docks from the old city.'
  },
  exits: [
    { id: 'exit-gate', name: 'The city gate, watched by a guard' },
    { id: 'exit-docks', name: 'Stone steps down to the docks' },
    { id: 'exit-alley', name: 'A narrow alley running east' }
  ],
  objects: [
    'the rain-slick seawall, fifteen feet high',
    'a stack of wet crates',
    'a lantern hanging on an iron hook'
  ],
  npcs: [{ id: 'npc-brannoc', name: 'Brannoc', note: 'the gate guard, suspicious of strangers' }],
  mode: 'exploration',
  dialogueNpcId: null,
  events: [
    'narrator: The gate is shut for the night. Brannoc stamps his feet against the cold, spear in hand.',
    'Player: I keep to the shadows by the crates and watch the gate.'
  ]
}

const CLEARING: FixtureScene = {
  location: {
    name: 'Mossy Clearing',
    description:
      'A quiet forest clearing at midday. A shallow, fast stream runs along the west edge.'
  },
  exits: [
    { id: 'exit-north', name: 'A path north toward the ruined tower' },
    { id: 'exit-west', name: 'The far bank of the stream, to the west' }
  ],
  objects: [
    'an old wooden door set into the hillside, unlocked and ajar',
    'a moss-covered fallen log across the stream',
    'a ring of standing stones'
  ],
  npcs: [],
  mode: 'exploration',
  dialogueNpcId: null,
  events: [
    'narrator: Birdsong fills the clearing. Nobody else is here.',
    'Player: I catch my breath and look around.'
  ]
}

export type Category =
  'trivial' | 'move' | 'talk' | 'end_talk' | 'speech' | 'impossible' | 'check' | 'vague'

export interface Case {
  id: string
  category: Category
  scene: FixtureScene
  declaration: string
  outcome: Outcome
  /** For checks: the skills or saves that count as a sensible pick. */
  skills?: Check[]
  /** The expected Effect when the declaration succeeds; absent when the case scores no Effect. */
  effect?: Effect
}

export const CASES: Case[] = [
  // trivial: happens, no structural change
  {
    id: 'sip-ale',
    category: 'trivial',
    scene: TAVERN,
    declaration: 'I pick up my mug of ale and take a sip.',
    outcome: 'happens',
    effect: { effect: 'none' }
  },
  {
    id: 'open-door',
    category: 'trivial',
    scene: CLEARING,
    declaration: 'I open the wooden door in the hillside.',
    outcome: 'happens',
    effect: { effect: 'none' }
  },
  {
    id: 'read-notices',
    category: 'trivial',
    scene: TAVERN,
    declaration: 'I read the notices on the board.',
    outcome: 'happens',
    effect: { effect: 'none' }
  },
  {
    id: 'take-lantern',
    category: 'trivial',
    scene: HARBOR_WALL,
    declaration: 'I take the lantern off its hook.',
    outcome: 'happens',
    effect: { effect: 'none' }
  },

  // move via an exit, some named loosely
  {
    id: 'out-front',
    category: 'move',
    scene: TAVERN,
    declaration: 'I head out the front door onto Harbor Street.',
    outcome: 'happens',
    effect: { effect: 'move', exitId: 'exit-street' }
  },
  {
    id: 'down-cellar',
    category: 'move',
    scene: TAVERN,
    declaration: 'I climb down into the cellar.',
    outcome: 'happens',
    effect: { effect: 'move', exitId: 'exit-cellar' }
  },
  {
    id: 'go-to-bed',
    category: 'move',
    scene: TAVERN,
    declaration: 'I go up to my room to sleep.',
    outcome: 'happens',
    effect: { effect: 'move', exitId: 'exit-stairs' }
  },
  {
    id: 'to-the-water',
    category: 'move',
    scene: HARBOR_WALL,
    declaration: 'I take the steps down to the water.',
    outcome: 'happens',
    effect: { effect: 'move', exitId: 'exit-docks' }
  },
  {
    id: 'toward-tower',
    category: 'move',
    scene: CLEARING,
    declaration: 'I follow the trail toward the tower.',
    outcome: 'happens',
    effect: { effect: 'move', exitId: 'exit-north' }
  },

  // talk to a present NPC
  {
    id: 'chat-maren',
    category: 'talk',
    scene: TAVERN,
    declaration: 'I walk up to the bar and start chatting with Maren.',
    outcome: 'happens',
    effect: { effect: 'talk', npcId: 'npc-maren' }
  },
  {
    id: 'greet-sergeant',
    category: 'talk',
    scene: TAVERN,
    declaration: 'I sit down next to the sergeant and say hello.',
    outcome: 'happens',
    effect: { effect: 'talk', npcId: 'npc-voss' }
  },
  {
    id: 'hail-guard',
    category: 'talk',
    scene: HARBOR_WALL,
    declaration: 'I call out to the guard at the gate.',
    outcome: 'happens',
    effect: { effect: 'talk', npcId: 'npc-brannoc' }
  },

  // end the current conversation
  {
    id: 'leave-maren',
    category: 'end_talk',
    scene: TAVERN_DIALOGUE,
    declaration: 'Thanks, Maren. I’ll leave you to your work.',
    outcome: 'happens',
    effect: { effect: 'end_talk' }
  },
  {
    id: 'nod-goodbye',
    category: 'end_talk',
    scene: TAVERN_DIALOGUE,
    declaration: 'I nod goodbye and step away from the bar.',
    outcome: 'happens',
    effect: { effect: 'end_talk' }
  },

  // plain speech while in dialogue: happens, nothing structural changes
  {
    id: 'last-night',
    category: 'speech',
    scene: TAVERN_DIALOGUE,
    declaration: 'Where were you last night?',
    outcome: 'happens',
    effect: { effect: 'none' }
  },
  {
    id: 'smugglers',
    category: 'speech',
    scene: TAVERN_DIALOGUE,
    declaration: 'What do you know about the smugglers working the docks?',
    outcome: 'happens',
    effect: { effect: 'none' }
  },
  {
    id: 'another-ale',
    category: 'speech',
    scene: TAVERN_DIALOGUE,
    declaration: 'I’ll have another ale, please.',
    outcome: 'happens',
    effect: { effect: 'none' }
  },

  // impossible: absurd, or the target is not here
  {
    id: 'moon',
    category: 'impossible',
    scene: CLEARING,
    declaration: 'I jump to the moon.',
    outcome: 'impossible'
  },
  {
    id: 'absent-innkeeper',
    category: 'impossible',
    scene: CLEARING,
    declaration: 'I ask the innkeeper for a room.',
    outcome: 'impossible'
  },
  {
    id: 'absent-dragon',
    category: 'impossible',
    scene: TAVERN,
    declaration: 'I talk to the dragon sitting in the corner.',
    outcome: 'impossible'
  },
  {
    id: 'fly-wall',
    category: 'impossible',
    scene: HARBOR_WALL,
    declaration: 'I flap my arms and fly over the city wall.',
    outcome: 'impossible'
  },
  {
    id: 'lift-tavern',
    category: 'impossible',
    scene: TAVERN,
    declaration: 'I lift the whole tavern over my head.',
    outcome: 'impossible'
  },

  // uncertain with consequence: check
  {
    id: 'climb-wall',
    category: 'check',
    scene: HARBOR_WALL,
    declaration: 'I climb the rain-slick seawall.',
    outcome: 'check',
    skills: ['athletics'],
    effect: { effect: 'none' }
  },
  {
    id: 'sneak-guard',
    category: 'check',
    scene: HARBOR_WALL,
    declaration: 'I sneak past the guard and slip through the gate.',
    outcome: 'check',
    skills: ['stealth'],
    effect: { effect: 'move', exitId: 'exit-gate' }
  },
  {
    id: 'persuade-guard',
    category: 'check',
    scene: HARBOR_WALL,
    declaration: 'I try to persuade the guard to let me through the gate without papers.',
    outcome: 'check',
    skills: ['persuasion']
  },
  {
    id: 'lie-sergeant',
    category: 'check',
    scene: TAVERN,
    declaration: 'I convince Sergeant Voss that I am a member of the city watch.',
    outcome: 'check',
    skills: ['deception']
  },
  {
    id: 'pick-chest',
    category: 'check',
    scene: TAVERN,
    declaration: 'While nobody is looking, I pick the lock on the chest behind the bar.',
    outcome: 'check',
    skills: ['sleight_of_hand', 'stealth']
  },
  {
    id: 'cross-log',
    category: 'check',
    scene: CLEARING,
    declaration: 'I balance my way across the slippery fallen log.',
    outcome: 'check',
    skills: ['acrobatics', 'dexterity_save']
  },

  // vague: ask
  {
    id: 'do-the-thing',
    category: 'vague',
    scene: TAVERN,
    declaration: 'I do the thing.',
    outcome: 'ask'
  },
  {
    id: 'over-there',
    category: 'vague',
    scene: HARBOR_WALL,
    declaration: 'I go over there.',
    outcome: 'ask'
  },
  { id: 'use-it', category: 'vague', scene: CLEARING, declaration: 'I use it.', outcome: 'ask' },
  {
    id: 'try-something',
    category: 'vague',
    scene: TAVERN,
    declaration: 'I try something.',
    outcome: 'ask'
  }
]
