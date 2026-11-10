import { expect, test, type APIRequestContext } from '@playwright/test'

const FAKE_LM_STUDIO = 'http://127.0.0.1:1235'

const EMPTY = { name: '', premise: '', genreFlavor: '', scale: '', magicLevel: '', techLevel: '' }

const post = (request: APIRequestContext, path: string, data: unknown) =>
  request.post(`${FAKE_LM_STUDIO}/__control/${path}`, { data })

const field = (request: APIRequestContext, body: Record<string, unknown>) =>
  request.post('/api/ai/field', {
    data: { flow: 'world', field: 'scale', mode: 'generate', values: EMPTY, ...body }
  })

// The fake's scenario and answer queue are process-wide state.
test.describe.configure({ mode: 'serial' })
test.afterEach(async ({ request }) => {
  await post(request, 'scenario', { scenario: 'ready' })
  await post(request, 'answers', { answers: [], replace: true })
})

test('generates a World seed enum and text field through the real adapter', async ({ request }) => {
  const scale = await (await field(request, { field: 'scale' })).json()
  expect(scale).toEqual({ ok: true, value: 'single region' })

  await post(request, 'answers', { answers: [{ content: { value: 'The Salt Coast' } }] })
  const name = await (await field(request, { field: 'name' })).json()
  expect(name).toEqual({ ok: true, value: 'The Salt Coast' })
})

test('revises a field from feedback', async ({ request }) => {
  await post(request, 'answers', { answers: [{ content: { value: 'Brighter Eldoria' } }] })

  const result = await (
    await field(request, {
      field: 'name',
      mode: 'feedback',
      values: { ...EMPTY, name: 'Eldoria' },
      current: 'Eldoria',
      note: 'more hopeful'
    })
  ).json()

  expect(result).toEqual({ ok: true, value: 'Brighter Eldoria' })
})

test('rejects a malformed request', async ({ request }) => {
  const response = await field(request, { field: 'nonsense' })

  expect(response.status()).toBe(400)
})

test('reports invalid-output after the single retry', async ({ request }) => {
  await post(request, 'scenario', { scenario: 'bad-output' })

  const result = await (await field(request, {})).json()

  expect(result).toMatchObject({ ok: false, failure: { kind: 'invalid-output' } })
})

test('reports an unreachable model as not-connected', async ({ request }) => {
  await post(request, 'scenario', { scenario: 'unreachable' })

  const response = await field(request, {})

  expect(response.status()).toBe(503)
  expect(await response.json()).toMatchObject({ ok: false, failure: { kind: 'not-connected' } })
})
