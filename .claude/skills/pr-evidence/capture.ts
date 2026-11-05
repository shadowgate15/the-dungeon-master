import { parseArgs } from 'node:util'
import { mkdirSync, renameSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from '@playwright/test'
import type { Page } from '@playwright/test'

const { values } = parseArgs({
  options: {
    url: { type: 'string' },
    out: { type: 'string' },
    name: { type: 'string' },
    flow: { type: 'string' },
    video: { type: 'boolean', default: false },
    'full-page': { type: 'boolean', default: false },
    width: { type: 'string', default: '1280' },
    height: { type: 'string', default: '800' }
  }
})

if (!values.url || !values.out || !values.name) {
  console.error(
    'usage: capture.ts --url <url> --out <dir> --name <name> [--flow <file>] [--video] [--full-page]'
  )
  process.exit(2)
}

const out = resolve(values.out)
const viewport = { width: Number(values.width), height: Number(values.height) }
mkdirSync(out, { recursive: true })

const videoTmp = join(out, `.video-${values.name}`)
const browser = await chromium.launch()
const context = await browser.newContext({
  viewport,
  ...(values.video && { recordVideo: { dir: videoTmp, size: viewport } })
})
const page = await context.newPage()

const consoleErrors: string[] = []
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text())
})
page.on('pageerror', (error) => consoleErrors.push(error.message))

try {
  await page.goto(values.url, { waitUntil: 'networkidle' })
  if (values.flow) {
    const flow = (await import(pathToFileURL(resolve(values.flow)).href)).default as (
      page: Page
    ) => Promise<void>
    await flow(page)
  }
  await page.screenshot({
    path: join(out, `${values.name}.png`),
    fullPage: values['full-page']
  })
  console.log(`screenshot: ${join(out, `${values.name}.png`)}`)
} finally {
  const recording = values.video ? page.video() : undefined
  await context.close()
  if (recording) {
    renameSync(await recording.path(), join(out, `${values.name}.webm`))
    rmSync(videoTmp, { recursive: true, force: true })
    console.log(`video: ${join(out, `${values.name}.webm`)}`)
  }
  await browser.close()
}

if (consoleErrors.length > 0) {
  console.error(`page logged ${consoleErrors.length} error(s); capture is suspect:`)
  for (const message of consoleErrors) console.error(`  ${message}`)
  process.exit(1)
}
