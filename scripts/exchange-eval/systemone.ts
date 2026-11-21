// The `systemone` wire: the fix-round v2 contract mapped onto a decision model's typed questions
// (LM Studio's POST /v1/systemone, e.g. Cloudflare Clef). A decision model cannot write text, so it
// picks among labelled criteria and returns a probability for each. One request per step:
//
// - Adjudication asks `outcome`, `skill` and `difficulty` together; `skill` and `difficulty` are
//   read only when the outcome is `check`. `ask` is scored on the outcome alone: the question the
//   player sees would be written by the narration model.
// - Effect asks one `effect` choice whose criteria are the Scene's own options
//   (`none`, `move:<exitId>`, `talk:<npcId>`, `end_talk`), each described in words.
//
// The state is the same Scene information the chat prompt gets, as a structured object.
import {
  DIFFICULTY_DC,
  talkableNpcs,
  type CharacterLine,
  type CheckName as Check,
  type Difficulty,
  type ExchangeScene as FixtureScene,
  type Outcome,
  type adjudicationSchema
} from '#lib/server/session/exchange/contract.ts'
import type { z } from 'zod'

export interface ChoiceQuestion {
  type: 'choice'
  instructions: string
  criteria: Record<string, string>
}

export interface SystemOneRequest {
  model: string
  state: Record<string, unknown>
  questions: Record<string, ChoiceQuestion>
}

export interface ChoiceAnswer {
  type: 'choice'
  choice: string
  probabilities: Record<string, number>
  confidence: number
}

/** The Scene as a structured state: what `sceneContext` renders as prompt lines for the chat models. */
export function sceneState(
  scene: FixtureScene,
  character: CharacterLine,
  declaration: string
): Record<string, unknown> {
  const talkingTo = scene.npcs.find((n) => n.id === scene.dialogueNpcId)
  return {
    character: `${character.name}, ${character.summary}`,
    location: scene.location,
    mode:
      scene.mode === 'dialogue' && talkingTo
        ? `dialogue, talking with ${talkingTo.name} (${talkingTo.id})`
        : 'exploration',
    exits: scene.exits,
    objects: scene.objects,
    people_present: scene.npcs,
    recent_events: scene.events,
    declaration
  }
}

const PRINCIPLE =
  'You are the referee of a Dungeons & Dragons 5e game. The player declares what their character does. Decide how the declaration resolves. ' +
  'The principle: call for a check only when something in the scene resists the action (a person who would object or notice, a lock, a hazard, a hard climb) AND failure would matter. Everything ordinary simply happens.'

/** The fix-round examples, in other scenes than the eval cases (see ADJUDICATION_SYSTEM in the app's contract). */
const EXAMPLES =
  ' Examples (not from this scene): in a mill with an exit "Ladder up to the loft", "I climb up to the loft." -> happens. ' +
  'Talking with a merchant, "So what brings you to town?" -> happens. ' +
  'Talking with a merchant, "Have you heard any rumors about the mine?" -> happens. ' +
  'Nobody named Tobin is present, "I ask Tobin for directions." -> impossible. ' +
  'A guard is watching the door, "I slip past the guard unseen." -> check. ' +
  'A cliff with loose rock, "I climb the cliff." -> check. ' +
  '"I look at that." -> ask.'

const OUTCOME_CRITERIA: Record<Outcome, string> = {
  happens:
    'It simply works. Going through a listed exit, up or down stairs or ladders, starting or ending a conversation with someone present, saying or asking anything in a conversation, and handling ordinary objects all happen. A question in conversation is never a check: the NPC answers it in the narration.',
  impossible:
    'It needs a person or thing that is not in the scene (anyone not listed under people_present, anything not listed or described), or it is physically absurd.',
  check: 'Something in the scene resists the action and failure would matter.',
  ask: 'The declaration does not say what, where, who or with what, so you cannot tell what the character does.'
}

const SRD_MAPPING =
  'Skills follow the SRD: climbing, jumping and swimming are athletics; balancing and tumbling are acrobatics; hiding and sneaking are stealth; lock picking and pickpocketing are sleight_of_hand; convincing honestly is persuasion; lying is deception.'

/** One line per SRD 5.1 skill and save, in the SRD's terms. */
const CHECK_CRITERIA: Record<Check, string> = {
  acrobatics:
    'Dexterity: keeping your balance, tumbling, staying on your feet on a narrow or slippery surface.',
  animal_handling: 'Wisdom: calming, controlling or reading an animal.',
  arcana: 'Intelligence: recalling lore about spells, magic items, symbols and the planes.',
  athletics: 'Strength: climbing, jumping, swimming, grappling, forcing something by strength.',
  deception: 'Charisma: lying, misleading or hiding the truth convincingly.',
  history: 'Intelligence: recalling lore about past events, people, kingdoms and wars.',
  insight: 'Wisdom: reading someone’s true intentions or spotting a lie.',
  intimidation: 'Charisma: influencing someone by threats or hostile action.',
  investigation: 'Intelligence: searching for clues and making deductions from them.',
  medicine: 'Wisdom: stabilizing the dying or diagnosing an illness.',
  nature: 'Intelligence: recalling lore about terrain, plants, animals and weather.',
  perception: 'Wisdom: spotting, hearing or noticing something.',
  performance: 'Charisma: entertaining an audience with music, dance or acting.',
  persuasion: 'Charisma: influencing someone honestly, with tact or good nature.',
  religion: 'Intelligence: recalling lore about deities, rites and holy symbols.',
  sleight_of_hand: 'Dexterity: picking a lock or a pocket, palming or planting an object.',
  stealth: 'Dexterity: hiding, or moving without being seen or heard.',
  survival: 'Wisdom: tracking, hunting, navigating the wild, predicting weather.',
  strength_save: 'Strength saving throw: resisting a force that would move or restrain you.',
  dexterity_save: 'Dexterity saving throw: dodging out of harm’s way.',
  constitution_save: 'Constitution saving throw: enduring poison, disease or exhaustion.',
  intelligence_save: 'Intelligence saving throw: resisting a mental assault by logic or memory.',
  wisdom_save: 'Wisdom saving throw: resisting charm, fear or illusion.',
  charisma_save: 'Charisma saving throw: resisting possession or being banished.'
}

const DIFFICULTY_CRITERIA: Record<keyof typeof DIFFICULTY_DC, string> = {
  easy: 'DC 10: a modest obstacle most people could manage.',
  medium: 'DC 15: a real challenge for an untrained person.',
  hard: 'DC 20: hard even for someone skilled.',
  very_hard: 'DC 25: only the very best usually succeed.'
}

export function adjudicationRequest(
  model: string,
  state: Record<string, unknown>,
  examples: boolean
): SystemOneRequest {
  return {
    model,
    state,
    questions: {
      outcome: {
        type: 'choice',
        instructions: PRINCIPLE + (examples ? EXAMPLES : ''),
        criteria: OUTCOME_CRITERIA
      },
      skill: {
        type: 'choice',
        instructions: `If the declaration needs a check, the one skill or saving throw that fits it best. ${SRD_MAPPING}`,
        criteria: CHECK_CRITERIA
      },
      difficulty: {
        type: 'choice',
        instructions: 'If the declaration needs a check, how hard it is.',
        criteria: DIFFICULTY_CRITERIA
      }
    }
  }
}

/** The Scene's Effect options as criteria keys (`move:<exitId>`, `talk:<npcId>`) with a description each. */
export function effectCriteria(scene: FixtureScene): Record<string, string> {
  const talkingTo = scene.npcs.find((n) => n.id === scene.dialogueNpcId)
  return {
    none: `Nothing structural changes: the character stays here${talkingTo ? ` and keeps talking with ${talkingTo.name}; speaking or asking something of ${talkingTo.name} is this` : ''}. Looking, handling objects, climbing or crossing something that is not a listed exit, and fighting are this too.`,
    ...Object.fromEntries(
      scene.exits.map((e) => [
        `move:${e.id}`,
        `The character leaves through this listed exit: ${e.name}.`
      ])
    ),
    ...Object.fromEntries(
      talkableNpcs(scene).map((n) => [
        `talk:${n.id}`,
        `The character starts a new conversation with ${n.name} (${n.note}).`
      ])
    ),
    ...(talkingTo && {
      end_talk: `The character ends the conversation with ${talkingTo.name}: a farewell, thanks that close it, or walking away.`
    })
  }
}

export function effectRequest(
  model: string,
  scene: FixtureScene,
  state: Record<string, unknown>
): SystemOneRequest {
  return {
    model,
    state,
    questions: {
      effect: {
        type: 'choice',
        instructions:
          'You are the referee of a Dungeons & Dragons 5e game. The player declared an action and it succeeded. Pick the one change to the scene it causes.',
        criteria: effectCriteria(scene)
      }
    }
  }
}

/**
 * Reads the answers as the app's flat Adjudication answer, so it goes through the same validation:
 * skill and difficulty count only when the outcome is a check. A decision model writes no text, so
 * an ask gets a placeholder question (the narration model would write it).
 */
export function toAdjudication(
  answers: Record<string, ChoiceAnswer>
): z.infer<typeof adjudicationSchema> {
  const outcome = answers.outcome.choice as Outcome
  return {
    outcome,
    skill: outcome === 'check' ? (answers.skill.choice as Check) : 'none',
    difficulty: outcome === 'check' ? (answers.difficulty.choice as Difficulty) : 'none',
    question: outcome === 'ask' ? '(written by the narration model)' : '',
    choices: []
  }
}

/** Reads an Effect criteria key (`move:<exitId>`, `talk:<npcId>`) as an Effect answer. */
export function toEffect(choice: string): Record<string, string> {
  const [kind, id] = choice.split(':')
  if (kind === 'move') return { effect: 'move', exitId: id }
  if (kind === 'talk') return { effect: 'talk', npcId: id }
  return { effect: kind }
}
