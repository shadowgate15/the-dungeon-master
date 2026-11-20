import { expect, type APIRequestContext, type Page } from '@playwright/test'
import { arcAnswers, expandArc } from './arc-helpers'

const FAKE_LM_STUDIO = 'http://127.0.0.1:1235'

const queue = async (request: APIRequestContext, ...answers: object[]) => {
  const response = await request.post(`${FAKE_LM_STUDIO}/__control/answers`, {
    data: { answers, replace: true }
  })
  expect(response.ok()).toBe(true)
}

/** What the model answers for the three First Scene stages (situation, place, NPCs). */
export const FIRST_SCENE = {
  place: 'The Gilded Stag',
  exits: ['Front door', 'Cellar stairs'],
  npc: 'Orla'
}

const situation = { content: { situation: 'Rain drives travellers into a crowded inn.' } }

const firstSceneAnswers = () => [
  situation,
  {
    content: {
      name: FIRST_SCENE.place,
      description: 'A low-beamed tavern warm with hearth smoke.',
      exits: FIRST_SCENE.exits,
      objects: ['The hearth', 'A notice board']
    }
  },
  {
    content: {
      npcs: [
        {
          name: FIRST_SCENE.npc,
          description: 'The innkeeper, flour on her sleeves.',
          role: 'Innkeeper',
          attitude: 'friendly',
          knowledge: 'Knows the local gossip.'
        }
      ]
    }
  }
]

/** Generates and accepts the Arc on the Campaign page (a Session requires an accepted Arc). */
export async function acceptArc(page: Page, request: APIRequestContext) {
  await expandArc(page)
  await queue(request, ...arcAnswers(3, 2)) // a short Campaign: 3 Acts, 2 Beats each
  await page.getByRole('button', { name: 'Generate Arc' }).click()
  await page.getByRole('button', { name: 'Accept Arc' }).click()
  await expect(page.getByRole('button', { name: 'Accept Arc' })).toHaveCount(0)
}

/** Queues the model's answers for the First Scene, ready for Start Session. */
export const queueFirstScene = (request: APIRequestContext) =>
  queue(request, ...firstSceneAnswers())

/** Queues a First Scene whose place stage fails (too few exits) after its retry. */
export const queueBrokenFirstScene = (request: APIRequestContext) => {
  const bare = { content: { name: 'Nowhere', description: 'Bare.', exits: [], objects: [] } }
  return queue(request, situation, bare, bare)
}
