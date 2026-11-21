/**
 * Test-only: scripted model answers for the Exchange's structured steps, in the flat wire shape
 * the contract asks for. A Reply is plain text: script it with `says`.
 */
import { answers, type Script } from './scripted-chat-port'

type Ruling =
  | { outcome: 'happens' | 'impossible' }
  | { outcome: 'check'; skill: string; difficulty: string }
  | { outcome: 'ask'; question: string; choices?: string[] }

/** An Adjudication answer, with the flat schema's sentinels filled in. */
export const rules = (ruling: Ruling): Script =>
  answers({
    skill: 'none',
    difficulty: 'none',
    question: '',
    choices: [],
    ...ruling
  })

export const happens = () => rules({ outcome: 'happens' })
export const impossible = () => rules({ outcome: 'impossible' })

/** An Effect answer. */
export const effect = (
  answer:
    | { effect: 'none' }
    | { effect: 'move'; exitId: string }
    | { effect: 'talk'; npcId: string }
    | { effect: 'end_talk' }
): Script => answers(answer)
