import { startFakeLmStudio } from './server.ts'

/** Runs the fake LM Studio as a standalone process (Playwright's web server). */
const fake = await startFakeLmStudio({
  port: Number(process.env.FAKE_LM_STUDIO_PORT ?? 1235),
  model: process.env.FAKE_LM_STUDIO_MODEL ?? 'fake-model',
  scenario: process.env.FAKE_LM_STUDIO_SCENARIO ?? 'ready'
})

console.log(`Fake LM Studio listening at ${fake.baseUrl}`)

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => void fake.close().then(() => process.exit(0)))
}
