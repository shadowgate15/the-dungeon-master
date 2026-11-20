import { describe, expect, it } from 'vitest'
import {
  allowedEffects,
  validateAdjudication,
  validateEffect,
  type EffectScene
} from './contract.ts'

/** A flat answer as the model sends it: every field present, sentinels where they do not apply. */
const answer = (fields: Record<string, unknown>) => ({
  outcome: 'happens',
  skill: 'none',
  difficulty: 'none',
  question: '',
  choices: [],
  ...fields
})

describe('Adjudication answer validation', () => {
  it('turns the sentinels of a plain ruling into absent fields', () => {
    expect(validateAdjudication(answer({ outcome: 'happens' }))).toEqual({
      ok: true,
      adjudication: { outcome: 'happens' }
    })
    expect(validateAdjudication(answer({ outcome: 'impossible' }))).toEqual({
      ok: true,
      adjudication: { outcome: 'impossible' }
    })
  })

  it('keeps the skill and difficulty of a Check', () => {
    expect(
      validateAdjudication(answer({ outcome: 'check', skill: 'athletics', difficulty: 'hard' }))
    ).toEqual({
      ok: true,
      adjudication: { outcome: 'check', skill: 'athletics', difficulty: 'hard' }
    })
  })

  it('accepts a saving throw as the Check', () => {
    expect(
      validateAdjudication(
        answer({ outcome: 'check', skill: 'dexterity_save', difficulty: 'very_hard' })
      )
    ).toMatchObject({ ok: true, adjudication: { skill: 'dexterity_save' } })
  })

  it('keeps the question of an ask, and its choices only when there are some', () => {
    expect(
      validateAdjudication(
        answer({ outcome: 'ask', question: 'Look at what?', choices: ['The door', 'The chest'] })
      )
    ).toEqual({
      ok: true,
      adjudication: {
        outcome: 'ask',
        question: 'Look at what?',
        choices: ['The door', 'The chest']
      }
    })
    expect(validateAdjudication(answer({ outcome: 'ask', question: 'Look at what?' }))).toEqual({
      ok: true,
      adjudication: { outcome: 'ask', question: 'Look at what?' }
    })
  })

  it('drops fields that do not belong to the outcome', () => {
    expect(
      validateAdjudication(
        answer({ outcome: 'happens', skill: 'stealth', difficulty: 'easy', question: 'Why?' })
      )
    ).toEqual({ ok: true, adjudication: { outcome: 'happens' } })
  })

  it('rejects a Check with no skill', () => {
    expect(
      validateAdjudication(answer({ outcome: 'check', skill: 'none', difficulty: 'medium' }))
    ).toMatchObject({ ok: false })
  })

  it('rejects a Check with no difficulty', () => {
    expect(
      validateAdjudication(answer({ outcome: 'check', skill: 'stealth', difficulty: 'none' }))
    ).toMatchObject({ ok: false })
  })

  it('rejects an ask with no question, counting a blank one as none', () => {
    expect(validateAdjudication(answer({ outcome: 'ask', question: '' }))).toMatchObject({
      ok: false
    })
    expect(validateAdjudication(answer({ outcome: 'ask', question: '   ' }))).toMatchObject({
      ok: false
    })
  })

  it('rejects an answer that does not match the schema', () => {
    expect(validateAdjudication({ outcome: 'happens' })).toMatchObject({ ok: false })
    expect(validateAdjudication(answer({ outcome: 'maybe' }))).toMatchObject({ ok: false })
    expect(validateAdjudication(answer({ skill: 'juggling' }))).toMatchObject({ ok: false })
    expect(validateAdjudication(answer({ extra: 1 }))).toMatchObject({ ok: false })
    expect(validateAdjudication(null)).toMatchObject({ ok: false })
  })
})

const scene = (fields: Partial<EffectScene> = {}): EffectScene => ({
  exits: [
    { id: 'exit-street', name: 'Front door' },
    { id: 'exit-cellar', name: 'Trapdoor' }
  ],
  npcs: [
    { id: 'npc-maren', name: 'Maren' },
    { id: 'npc-voss', name: 'Voss' }
  ],
  mode: 'exploration',
  dialogueNpcId: null,
  ...fields
})
const inDialogueWithMaren = scene({ mode: 'dialogue', dialogueNpcId: 'npc-maren' })

describe('the Effects a Scene allows', () => {
  it('offers move and talk in a Scene with exits and NPCs, but not end_talk outside a conversation', () => {
    expect(allowedEffects(scene())).toEqual(['none', 'move', 'talk'])
  })

  it('offers only none in an empty Scene', () => {
    expect(allowedEffects(scene({ exits: [], npcs: [] }))).toEqual(['none'])
  })

  it('offers end_talk in a conversation', () => {
    expect(allowedEffects(inDialogueWithMaren)).toEqual(['none', 'move', 'talk', 'end_talk'])
  })

  it('does not offer talk when the only NPC present is the dialogue partner', () => {
    const alone = scene({
      npcs: [{ id: 'npc-maren', name: 'Maren' }],
      mode: 'dialogue',
      dialogueNpcId: 'npc-maren'
    })
    expect(allowedEffects(alone)).toEqual(['none', 'move', 'end_talk'])
  })
})

describe('Effect answer validation', () => {
  it('accepts none, and drops ids that do not belong to it', () => {
    expect(validateEffect(scene(), { effect: 'none', exitId: 'exit-street' })).toEqual({
      ok: true,
      effect: { effect: 'none' }
    })
  })

  it("accepts a move through one of the Scene's exits", () => {
    expect(validateEffect(scene(), { effect: 'move', exitId: 'exit-cellar' })).toEqual({
      ok: true,
      effect: { effect: 'move', exitId: 'exit-cellar' }
    })
  })

  it('accepts talk with a present NPC who is not the dialogue partner', () => {
    expect(validateEffect(inDialogueWithMaren, { effect: 'talk', npcId: 'npc-voss' })).toEqual({
      ok: true,
      effect: { effect: 'talk', npcId: 'npc-voss' }
    })
  })

  it('accepts end_talk in a conversation', () => {
    expect(validateEffect(inDialogueWithMaren, { effect: 'end_talk' })).toEqual({
      ok: true,
      effect: { effect: 'end_talk' }
    })
  })

  it('reads null ids as absent, as a strict wire schema sends them', () => {
    expect(validateEffect(scene(), { effect: 'none', exitId: null, npcId: null })).toEqual({
      ok: true,
      effect: { effect: 'none' }
    })
  })

  it('rejects an exit that is not in the Scene', () => {
    expect(validateEffect(scene(), { effect: 'move', exitId: 'exit-moon' })).toMatchObject({
      ok: false
    })
  })

  it('rejects an NPC who is not present, or is already the dialogue partner', () => {
    expect(validateEffect(scene(), { effect: 'talk', npcId: 'npc-tobin' })).toMatchObject({
      ok: false
    })
    expect(
      validateEffect(inDialogueWithMaren, { effect: 'talk', npcId: 'npc-maren' })
    ).toMatchObject({ ok: false })
  })

  it('rejects a move with no exit and a talk with no NPC', () => {
    expect(validateEffect(scene(), { effect: 'move' })).toMatchObject({ ok: false })
    expect(validateEffect(scene(), { effect: 'talk', npcId: null })).toMatchObject({ ok: false })
  })

  it('rejects an Effect the Scene does not allow', () => {
    expect(validateEffect(scene(), { effect: 'end_talk' })).toMatchObject({ ok: false })
    expect(
      validateEffect(scene({ exits: [] }), { effect: 'move', exitId: 'exit-street' })
    ).toMatchObject({ ok: false })
    expect(validateEffect(scene(), { effect: 'teleport' })).toMatchObject({ ok: false })
  })
})
