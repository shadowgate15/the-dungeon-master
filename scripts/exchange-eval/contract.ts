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
