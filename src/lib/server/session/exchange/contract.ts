/**
 * The Exchange contract: the Adjudication and Effect wire schemas, the code-side validation of
 * their answers, their system prompts, the Scene context both requests see and the difficulty to
 * DC map. This is the fix-round `v2-flat` contract that passed the eval
 * (docs/research/exchange-model-eval.md); `pnpm eval:exchange` imports it, so the gate always tests
 * what ships. Change a prompt or schema here, then re-run the eval. See GLOSSARY.md and ADR 0005.
 */
import { z } from 'zod'
import type { Clarification } from '#lib/session/call.ts'
import type { Mode } from '#lib/session/enums.ts'

export const OUTCOMES = ['happens', 'impossible', 'check', 'ask'] as const
export type Outcome = (typeof OUTCOMES)[number]

/** The 18 SRD 5.1 skills, as the slugs the model answers with. */
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
/** The 6 ability saving throws. */
export const SAVES = [
  'strength_save',
  'dexterity_save',
  'constitution_save',
  'intelligence_save',
  'wisdom_save',
  'charisma_save'
] as const
/** What a Check can roll: a skill or a saving throw. */
export const CHECKS = [...SKILLS, ...SAVES] as const
export type CheckName = (typeof CHECKS)[number]

/** Code maps the model's difficulty tier to the DC; the model never picks a number. */
export const DIFFICULTY_DC = { easy: 10, medium: 15, hard: 20, very_hard: 25 } as const
export type Difficulty = keyof typeof DIFFICULTY_DC
export const DIFFICULTIES = Object.keys(DIFFICULTY_DC) as Difficulty[]

/**
 * The Adjudication wire schema: flat, strict, every field required and non-null. `"none"`, `""`
 * and `[]` mark fields that do not apply to the outcome; `validateAdjudication` turns them into
 * absent fields. Having no optional fields means the port sends it unchanged.
 */
export const adjudicationSchema = z
  .object({
    outcome: z.enum(OUTCOMES),
    skill: z.enum([...CHECKS, 'none']),
    difficulty: z.enum([...DIFFICULTIES, 'none']),
    question: z.string(),
    choices: z.array(z.string())
  })
  .strict()

/** A validated Adjudication: only the fields its outcome uses. */
export type Adjudication =
  | { outcome: 'happens' }
  | { outcome: 'impossible' }
  | { outcome: 'check'; skill: CheckName; difficulty: Difficulty }
  | { outcome: 'ask'; question: string; choices?: string[] }

export type Validated<T> = { ok: true } & T
export type Rejected = { ok: false; error: string }

/**
 * Validates a model's Adjudication answer: it must match the wire schema, a Check must name a
 * skill or save and a difficulty, and an ask must carry a question. Fields that do not belong to
 * the outcome are dropped, and an ask's empty choices are left out.
 */
export function validateAdjudication(
  answer: unknown
): Validated<{ adjudication: Adjudication }> | Rejected {
  const parsed = adjudicationSchema.safeParse(answer)
  if (!parsed.success) return { ok: false, error: issues(parsed.error) }
  const { outcome, skill, difficulty, choices } = parsed.data
  const question = parsed.data.question.trim()
  switch (outcome) {
    case 'check':
      if (skill === 'none' || difficulty === 'none')
        return { ok: false, error: 'check without skill or difficulty' }
      return { ok: true, adjudication: { outcome, skill, difficulty } }
    case 'ask':
      if (!question) return { ok: false, error: 'ask without a question' }
      return {
        ok: true,
        adjudication: { outcome, question, ...(choices.length > 0 && { choices }) }
      }
    default:
      return { ok: true, adjudication: { outcome } }
  }
}

/** What the Adjudication and Effect requests see of the Scene, with recent events already rendered. */
export interface ExchangeScene {
  location: { name: string; description: string }
  exits: { id: string; name: string }[]
  objects: string[]
  /** Present NPCs, each with a short note (role, attitude). */
  npcs: { id: string; name: string; note: string }[]
  mode: Mode
  /** The NPC being talked to while `mode` is `dialogue`, else null. */
  dialogueNpcId: string | null
  /** Recent events, oldest first, already rendered as prompt lines. */
  events: string[]
}

/** The part of the Scene the Effect options are built from. */
export type EffectScene = Pick<ExchangeScene, 'exits' | 'mode' | 'dialogueNpcId'> & {
  npcs: { id: string; name: string }[]
}

export const EFFECTS = ['none', 'move', 'talk', 'end_talk'] as const
export type EffectKind = (typeof EFFECTS)[number]

/** A validated Effect: a move names one of the Scene's exits, a talk one of its NPCs. */
export type Effect =
  | { effect: 'none' }
  | { effect: 'move'; exitId: string }
  | { effect: 'talk'; npcId: string }
  | { effect: 'end_talk' }

/**
 * An Effect decided before the Exchange (a clicked exit or NPC, #274), applied instead of asking
 * the Effect step once the Declaration happens, and carried on any Call raised meanwhile.
 */
export type CarriedEffect = Extract<Effect, { effect: 'move' | 'talk' }>

const carriedEffectSchema = z.discriminatedUnion('effect', [
  z.object({ effect: z.literal('move'), exitId: z.string().min(1) }),
  z.object({ effect: z.literal('talk'), npcId: z.string().min(1) })
])

/**
 * Reads a clicked exit's or NPC's Effect from a request: a `move` with an exit id or a `talk` with
 * an NPC id. Anything malformed is dropped, so the Declaration runs as if typed; whether the Scene
 * still allows it is checked when the Exchange starts.
 */
export function parseCarriedEffect(value: unknown): CarriedEffect | undefined {
  const parsed = carriedEffectSchema.safeParse(value)
  return parsed.success ? parsed.data : undefined
}

/** NPCs a conversation can start with: everyone present except the one already being talked to. */
export const talkableNpcs = <S extends EffectScene>(scene: S): S['npcs'] =>
  scene.npcs.filter((n) => n.id !== scene.dialogueNpcId)

/** The Effects this Scene allows: move only with exits, talk only with someone new to talk to, end_talk only in dialogue. */
export function allowedEffects(scene: EffectScene): EffectKind[] {
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
 * The Effect wire schema for one Scene, with exit and NPC ids as enums of that Scene's ids. One
 * flat object rather than a discriminated union, because the port takes a `z.ZodObject`;
 * `validateEffect` checks that `move` carries `exitId` and `talk` `npcId`.
 */
export function effectSchema(scene: EffectScene) {
  const npcs = talkableNpcs(scene)
  return z
    .object({
      effect: z.enum(asTuple(allowedEffects(scene))),
      ...(scene.exits.length > 0 && {
        exitId: z.enum(asTuple(scene.exits.map((e) => e.id))).optional()
      }),
      ...(npcs.length > 0 && { npcId: z.enum(asTuple(npcs.map((n) => n.id))).optional() })
    })
    .strict()
}

/**
 * Validates a model's Effect answer against the Scene's options. `null` ids count as absent (a
 * strict wire schema sends optional fields as nullable), ids that do not belong to the Effect are
 * dropped, and a move without an exit or a talk without an NPC is rejected.
 */
export function validateEffect(
  scene: EffectScene,
  answer: unknown
): Validated<{ effect: Effect }> | Rejected {
  const parsed = effectSchema(scene).safeParse(dropNulls(answer))
  if (!parsed.success) return { ok: false, error: issues(parsed.error) }
  const { effect, exitId, npcId } = parsed.data as {
    effect: EffectKind
    exitId?: string
    npcId?: string
  }
  switch (effect) {
    case 'move':
      return exitId
        ? { ok: true, effect: { effect, exitId } }
        : { ok: false, error: 'move without an exit' }
    case 'talk':
      return npcId
        ? { ok: true, effect: { effect, npcId } }
        : { ok: false, error: 'talk without an NPC' }
    default:
      return { ok: true, effect: { effect } }
  }
}

/**
 * The Adjudication system prompt: the judgment principle, an SRD skill mapping, seven worked
 * examples set in other scenes than the eval cases, and the flat schema's sentinels.
 */
export const ADJUDICATION_SYSTEM = [
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
  '- "I look at that." -> ask',
  '',
  'Fill every field:',
  '- outcome: as above.',
  '- skill: for "check", the one skill or saving throw that fits best; otherwise "none".',
  '- difficulty: for "check", easy, medium, hard or very_hard; otherwise "none".',
  '- question: for "ask", one short question for the player; otherwise "".',
  '- choices: for "ask", two to four short answers; otherwise [].'
].join('\n')

/** The Effect system prompt: speech in a conversation is not `talk`, and only listed exits are `move`. */
export const EFFECT_SYSTEM = [
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

/** The player's Character as one prompt line. */
export interface CharacterLine {
  name: string
  /** A short description, e.g. "a level 1 human rogue". */
  summary: string
}

/**
 * The compact Scene context both requests see as the user message, ending with the Declaration
 * and, while it is being clarified, each question asked about it and the player's answer.
 */
export function sceneContext(
  scene: ExchangeScene,
  character: CharacterLine,
  declaration: string,
  clarifying: Clarification[] = []
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
    `The player declares: "${declaration}"`,
    ...(clarifying.length > 0
      ? [
          [
            'Asked what they meant:',
            ...clarifying.map(
              (c) => `- You asked: "${c.question}" The player answered: "${c.answer}"`
            ),
            'Rule on the declaration as these answers clarify it.'
          ].join('\n')
        ]
      : [])
  ].join('\n\n')
}

function dropNulls(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== null))
}

function issues(error: z.ZodError): string {
  return error.issues.map((i) => `${i.path.join('.') || 'answer'}: ${i.message}`).join('; ')
}
