// Runs the whole Exchange eval grid: loads each model variant in LM Studio in turn (only one
// resident at a time), runs its modes, writes one results file per cell and unloads it.
//
//   pnpm eval:exchange:grid [--runs 5] [--only label,label]
//
// Variants are LM Studio variant keys (`lms ls <model> --json`); `lms load` cannot pick a variant,
// so this uses the LM Studio SDK. A variant that fails to load (not downloaded) is reported as
// skipped and the grid carries on.
import { join } from 'node:path'
import { LMStudioClient } from '@lmstudio/sdk'
import { runCell, writeResult, type Mode } from './run.ts'

interface GridCell {
  label: string
  variant: string
  modes: Mode[]
  /** Leave the model's thinking on, as the app's port does today (no `reasoning_effort`). */
  think?: boolean
  runs?: number
}

export const GRID: GridCell[] = [
  { label: 'qwen3-4b-2507-mlx4', variant: 'qwen/qwen3-4b-2507', modes: ['schema', 'raw-schema'] },
  {
    label: 'qwen3.5-9b-mlx4',
    variant: 'qwen/qwen3.5-9b@4bit',
    modes: ['schema', 'raw-schema', 'tools']
  },
  // The app's port as it is today: no reasoning_effort, so the model thinks. One run is enough to show it.
  {
    label: 'qwen3.5-9b-mlx4-thinking',
    variant: 'qwen/qwen3.5-9b@4bit',
    modes: ['schema'],
    think: true,
    runs: 1
  },
  {
    label: 'qwen3.5-9b-gguf-q4km',
    variant: 'qwen/qwen3.5-9b@q4_k_m',
    modes: ['schema', 'raw-schema', 'tools']
  },
  {
    label: 'qwen3.5-9b-gguf-q8',
    variant: 'qwen/qwen3.5-9b@q8_0',
    modes: ['schema', 'raw-schema', 'tools']
  },
  { label: 'qwen3.5-9b-mlx8', variant: 'qwen/qwen3.5-9b@8bit', modes: ['schema', 'raw-schema'] }
]

const CONTEXT_LENGTH = 8192
const IDENTIFIER = 'exchange-eval'

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > 0 ? process.argv[i + 1] : undefined
}

async function unloadAll(client: LMStudioClient) {
  for (const model of await client.llm.listLoaded()) await client.llm.unload(model.identifier)
}

if (import.meta.main) {
  const runs = Number(arg('runs') ?? 5)
  const only = arg('only')?.split(',')
  const client = new LMStudioClient({
    logger: { info() {}, warn: console.warn, error: console.error, debug() {} }
  })
  const skipped: string[] = []
  for (const cell of GRID.filter((c) => !only || only.includes(c.label))) {
    await unloadAll(client)
    let memory: string
    try {
      const model = await client.llm.load(cell.variant, {
        identifier: IDENTIFIER,
        config: { contextLength: CONTEXT_LENGTH },
        verbose: false
      })
      const info = await model.getModelInfo()
      memory = `${(info.sizeBytes / 2 ** 30).toFixed(2)} GiB (${info.format}, ${info.quantization?.name ?? '?'})`
      console.log(`Loaded ${cell.variant} as ${IDENTIFIER}: ${memory}`)
    } catch (error) {
      skipped.push(
        `${cell.label} (${cell.variant}): ${error instanceof Error ? error.message.split('\n')[0] : error}`
      )
      console.log(`SKIPPED ${cell.label}: could not load ${cell.variant}`)
      continue
    }
    for (const mode of cell.modes) {
      const label = `${cell.label}-${mode}`
      const result = await runCell({
        label,
        model: IDENTIFIER,
        mode,
        runs: cell.runs ?? runs,
        temperature: 0.7,
        think: cell.think ?? false,
        memory,
        log: (line) => console.log(line)
      })
      writeResult(result, join(import.meta.dirname, 'results', `${label}.json`))
      console.log(`DONE ${label}`)
    }
  }
  await unloadAll(client)
  if (skipped.length) console.log(`Skipped:\n${skipped.join('\n')}`)
  console.log('GRID COMPLETE')
  process.exit(0)
}
