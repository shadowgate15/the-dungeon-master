// The Exchange contract under evaluation: the Adjudication and Effect output shapes, their
// prompts, and the compact Scene context each request sees. Kept here, not in src/, because the
// Exchange is not built yet; when it is, this file is the starting point for its schemas.
import { z } from 'zod'

export const OUTCOMES = ['happens', 'impossible', 'check', 'ask'] as const
export type Outcome = (typeof OUTCOMES)[number]

/** The 18 SRD 5.1 skills and the 6 ability saving throws, as slugs. */
export const SKILLS = [
  'acrobatics',
  'animal_handling',
  'arcana',
  'athletics',
  'deception',
  'history',
  'insight',
  'intimidation',
  'investigation',
  'medicine',
  'nature',
  'perception',
  'performance',
  'persuasion',
  'religion',
  'sleight_of_hand',
  'stealth',
  'survival'
] as const
export const SAVES = [
  'strength_save',
  'dexterity_save',
  'constitution_save',
  'intelligence_save',
  'wisdom_save',
  'charisma_save'
] as const
export const CHECKS = [...SKILLS, ...SAVES] as const
export type Check = (typeof CHECKS)[number]

/** Code maps the model's difficulty word to a DC; the model never picks a number. */
export const DIFFICULTY_DC = { easy: 10, medium: 15, hard: 20, very_hard: 25 } as const
export const DIFFICULTIES = Object.keys(DIFFICULTY_DC) as (keyof typeof DIFFICULTY_DC)[]

export const adjudicationSchema = z
  .object({
    outcome: z.enum(OUTCOMES),
    skill: z.enum(CHECKS).optional(),
    difficulty: z.enum(['easy', 'medium', 'hard', 'very_hard']).optional(),
    question: z.string().optional(),
    choices: z.array(z.string()).optional()
  })
  .strict()
export type Adjudication = z.infer<typeof adjudicationSchema>

export interface FixtureScene {
  location: { name: string; description: string }
  exits: { id: string; name: string }[]
  objects: string[]
  npcs: { id: string; name: string; note: string }[]
  mode: 'exploration' | 'dialogue'
  dialogueNpcId: string | null
  /** Recent events, oldest first, already rendered as prompt lines. */
  events: string[]
}

export const EFFECTS = ['none', 'move', 'talk', 'end_talk'] as const
export type EffectKind = (typeof EFFECTS)[number]
export interface Effect {
  effect: EffectKind
  exitId?: string
  npcId?: string
}

/** NPCs a conversation can start with: everyone present except the one already being talked to. */
export const talkableNpcs = (scene: FixtureScene) =>
  scene.npcs.filter((n) => n.id !== scene.dialogueNpcId)

/** The effects this Scene allows: move only with exits, talk only with someone to start talking to, end_talk only in dialogue. */
export function allowedEffects(scene: FixtureScene): EffectKind[] {
  return EFFECTS.filter(
    (e) =>
      e === 'none' ||
      (e === 'move' && scene.exits.length > 0) ||
      (e === 'talk' && talkableNpcs(scene).length > 0) ||
      (e === 'end_talk' && scene.mode === 'dialogue')
  )
}

const asTuple = (values: string[]) => values as [string, ...string[]]

/**
 * The Effect schema for one Scene, with exit and NPC ids as enums of that Scene's actual ids.
 * Encoded as one flat object rather than a discriminated union because the app's port takes a
 * `z.ZodObject` as `outputSchema`; code checks that `move` carries `exitId` and `talk` `npcId`.
 */
export function effectSchema(scene: FixtureScene) {
  return z
    .object({
      effect: z.enum(asTuple(allowedEffects(scene))),
      ...(scene.exits.length > 0 && {
        exitId: z.enum(asTuple(scene.exits.map((e) => e.id))).optional()
      }),
      ...(talkableNpcs(scene).length > 0 && {
        npcId: z.enum(asTuple(talkableNpcs(scene).map((n) => n.id))).optional()
      })
    })
    .strict()
}

/** JSON Schema for the raw-wire modes (native tools); the app mode passes the Zod schema. */
export function jsonSchemaOf(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema) as Record<string, unknown>
  delete json.$schema
  return json
}

export const ADJUDICATION_SYSTEM = [
  'You are the referee of a Dungeons & Dragons 5e game. The player declares what their character does.',
  'Decide how the declaration resolves. Do not narrate. Answer only with the JSON object.',
  'outcome is one of:',
  '- "happens": it simply works, with no real chance of failure: speaking, asking a question, looking around, picking up or using an ordinary object, going through an exit, starting or ending a conversation with someone present.',
  '- "impossible": it cannot happen here: physically absurd, or the person or thing it needs is not in the scene.',
  '- "check": it could plausibly work but might fail, and failure would matter. Set skill to the one skill or saving throw that fits best and difficulty to easy, medium, hard or very_hard.',
  '- "ask": the declaration is too vague to resolve, for example it does not say what, where, who or with what. Set question to one short question for the player, and optionally choices to two to four short answers.',
  'Only set skill and difficulty for "check", and question and choices for "ask".',
  'Most declarations simply happen. Call for a check only when something in the scene stands in the way (an obstacle, a hazard, or someone who would resist), never for ordinary walking, talking or handling things.'
].join('\n')

export const EFFECT_SYSTEM = [
  'You are the referee of a Dungeons & Dragons 5e game. The player declared an action and it succeeded.',
  'Pick the one change to the scene it causes. Answer only with the JSON object.',
  'effect is one of:',
  '- "none": the scene stays as it is: speaking, asking, looking, handling objects, fighting, anything that does not leave or start or end a conversation.',
  '- "move": the character leaves through one of the exits. Set exitId to that exit.',
  '- "talk": the character starts a conversation with someone present. Set npcId to that person.',
  '- "end_talk": the character ends the current conversation.',
  'Use only the ids listed in the scene.'
].join('\n')

// ---- fix round: contract variants -------------------------------------------------------------

/**
 * The judgment principle and worked examples, aimed at the failures of the first round: checks on
 * plain movement, insight checks on plain speech, and `ask` for people who are not there. The
 * examples deliberately use situations that are not in the eval cases.
 */
const JUDGMENT = [
  'You are the referee of a Dungeons & Dragons 5e game. The player declares what their character does.',
  'Decide how the declaration resolves. Do not narrate. Answer only with the JSON object.',
  '',
  'The principle: call for a check only when something in the scene resists the action (a person who would object or notice, a lock, a hazard, a hard climb) AND failure would matter. Everything ordinary simply happens.',
  '',
  'outcome is one of:',
  '- "happens": it simply works. Going through a listed exit, up or down stairs or ladders, starting or ending a conversation with someone present, saying or asking anything in a conversation, and handling ordinary objects all happen. A question in conversation is never a check: the NPC answers it in the narration.',
  '- "impossible": it needs a person or thing that is not in the scene (anyone not listed under People present, anything not listed or described), or it is physically absurd.',
  '- "check": something in the scene resists and failure would matter.',
  '- "ask": the declaration does not say what, where, who or with what, so you cannot tell what the character does.',
  '',
  'Skills follow the SRD: climbing, jumping and swimming are athletics; balancing and tumbling are acrobatics; hiding and sneaking are stealth; lock picking and pickpocketing are sleight_of_hand; convincing honestly is persuasion; lying is deception.',
  '',
  'Examples (not from this scene):',
  '- In a mill with an exit "Ladder up to the loft": "I climb up to the loft." -> happens',
  '- Talking with a merchant: "So what brings you to town?" -> happens',
  '- Talking with a merchant: "Have you heard any rumors about the mine?" -> happens',
  '- Nobody named Tobin is present: "I ask Tobin for directions." -> impossible',
  '- A guard is watching the door: "I slip past the guard unseen." -> check, stealth',
  '- A cliff with loose rock: "I climb the cliff." -> check, athletics',
  '- "I look at that." -> ask'
]

/** Field instructions for the first round's schema, where the fields that do not apply are left out. */
const OPTIONAL_FIELDS = [
  '',
  'For "check", set skill to the one skill or saving throw that fits best and difficulty to easy, medium, hard or very_hard. For "ask", set question to one short question for the player and optionally choices to two to four short answers. Leave those fields out otherwise.'
]

/** Field instructions for the flat schema, where every field is always present. */
const FLAT_FIELDS = (resists: boolean) => [
  '',
  'Fill every field:',
  ...(resists
    ? [
        '- resists: first, a few words naming who or what in the scene opposes the action, or "nothing".'
      ]
    : []),
  '- outcome: as above.',
  '- skill: for "check", the one skill or saving throw that fits best; otherwise "none".',
  '- difficulty: for "check", easy, medium, hard or very_hard; otherwise "none".',
  '- question: for "ask", one short question for the player; otherwise "".',
  '- choices: for "ask", two to four short answers; otherwise [].'
]

/**
 * The flat Adjudication wire schema: every field required and non-null, branching on `outcome`.
 * `"none"`, `""` and `[]` mark fields that do not apply; code checks which ones must be filled
 * (`fromFlat`). With `resists`, the model names what opposes the action before it picks an outcome.
 */
export function flatAdjudicationSchema(resists: boolean) {
  return z
    .object({
      ...(resists && { resists: z.string() }),
      outcome: z.enum(OUTCOMES),
      skill: z.enum([...CHECKS, 'none']),
      difficulty: z.enum([...DIFFICULTIES, 'none']),
      question: z.string(),
      choices: z.array(z.string())
    })
    .strict()
}

/**
 * Code-side rules for the flat schema: turns the always-present fields into an Adjudication and
 * rejects a check with no skill or difficulty and an ask with no question. Fields that do not
 * belong to the outcome are dropped, since code dispatching on `outcome` would ignore them.
 */
export function fromFlat(
  parsed: Record<string, unknown>
): { ok: true; object: Adjudication & { resists?: string } } | { ok: false; error: string } {
  const outcome = parsed.outcome as Outcome
  const skill = parsed.skill === 'none' ? undefined : (parsed.skill as Check)
  const difficulty =
    parsed.difficulty === 'none' ? undefined : (parsed.difficulty as Adjudication['difficulty'])
  const question = typeof parsed.question === 'string' ? parsed.question.trim() : ''
  const choices = Array.isArray(parsed.choices) ? (parsed.choices as string[]) : []
  if (outcome === 'check' && (!skill || !difficulty))
    return { ok: false, error: 'check without skill or difficulty' }
  if (outcome === 'ask' && !question) return { ok: false, error: 'ask without a question' }
  return {
    ok: true,
    object: {
      ...(typeof parsed.resists === 'string' && { resists: parsed.resists }),
      outcome,
      ...(outcome === 'check' && { skill, difficulty }),
      ...(outcome === 'ask' && { question, ...(choices.length > 0 && { choices }) })
    }
  }
}

/** The Effect prompt with the first round's failures addressed: speech in a conversation is not `talk`, and only listed exits are `move`. */
export const EFFECT_SYSTEM_V2 = [
  'You are the referee of a Dungeons & Dragons 5e game. The player declared an action and it succeeded.',
  'Pick the one change to the scene it causes. Answer only with the JSON object.',
  'effect is one of:',
  '- "none": the scene stays as it is. Speaking or asking something of the person you are already talking with is "none", and so is looking, handling objects, climbing or crossing something that is not a listed exit, and fighting.',
  '- "move": the character leaves through one of the listed exits. Set exitId to that exit. Only a listed exit counts.',
  '- "talk": the character starts a new conversation with someone present they are not already talking with. Set npcId to that person.',
  '- "end_talk": the character ends the current conversation: a farewell, thanks that close it, or walking away from the person.',
  '',
  'Examples (not from this scene):',
  '- Talking with a merchant: "What do you charge for rope?" -> none',
  '- Talking with a merchant: "I wave farewell and turn back to the market." -> end_talk',
  '- Talking with a merchant, a guard also present: "And how is your family?" -> none',
  '- A mill with an exit "Ladder up to the loft": "I head up to the loft." -> move to that exit',
  '- A river with no exit across it: "I swim across the river." -> none',
  'Use only the ids listed in the scene.'
].join('\n')

export type ContractId = 'v1' | 'v2-prompt' | 'v2-flat' | 'v2-resists'

export interface Contract {
  id: ContractId
  adjudicationSystem: string
  /** The schema the model is constrained to (or, without a wire schema, told to follow). */
  adjudicationWire: z.ZodObject
  /** Whether the wire schema is the flat one, whose answers go through `fromFlat`. */
  flat: boolean
  effectSystem: string
}

export const CONTRACTS: Record<ContractId, Contract> = {
  v1: {
    id: 'v1',
    adjudicationSystem: ADJUDICATION_SYSTEM,
    adjudicationWire: adjudicationSchema,
    flat: false,
    effectSystem: EFFECT_SYSTEM
  },
  'v2-prompt': {
    id: 'v2-prompt',
    adjudicationSystem: [...JUDGMENT, ...OPTIONAL_FIELDS].join('\n'),
    adjudicationWire: adjudicationSchema,
    flat: false,
    effectSystem: EFFECT_SYSTEM_V2
  },
  'v2-flat': {
    id: 'v2-flat',
    adjudicationSystem: [...JUDGMENT, ...FLAT_FIELDS(false)].join('\n'),
    adjudicationWire: flatAdjudicationSchema(false),
    flat: true,
    effectSystem: EFFECT_SYSTEM_V2
  },
  'v2-resists': {
    id: 'v2-resists',
    adjudicationSystem: [...JUDGMENT, ...FLAT_FIELDS(true)].join('\n'),
    adjudicationWire: flatAdjudicationSchema(true),
    flat: true,
    effectSystem: EFFECT_SYSTEM_V2
  }
}

export interface CharacterLine {
  name: string
  summary: string
}

/** The compact Scene context both requests see, ending with the declaration. */
export function sceneContext(
  scene: FixtureScene,
  character: CharacterLine,
  declaration: string
): string {
  const talkingTo = scene.npcs.find((n) => n.id === scene.dialogueNpcId)
  return [
    `Character: ${character.name}, ${character.summary}`,
    `Location: ${scene.location.name}. ${scene.location.description}`,
    `Mode: ${scene.mode === 'dialogue' && talkingTo ? `dialogue, talking with ${talkingTo.name} (${talkingTo.id})` : 'exploration'}`,
    `Exits:\n${scene.exits.map((e) => `- ${e.id}: ${e.name}`).join('\n') || '- none'}`,
    `Objects:\n${scene.objects.map((o) => `- ${o}`).join('\n') || '- none'}`,
    `People present:\n${scene.npcs.map((n) => `- ${n.id}: ${n.name}, ${n.note}`).join('\n') || '- nobody'}`,
    `Recent events:\n${scene.events.join('\n')}`,
    `The player declares: "${declaration}"`
  ].join('\n\n')
}
