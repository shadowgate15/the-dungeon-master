// Runs the whole Exchange eval grid: loads each model variant in LM Studio in turn (only one
// resident at a time), runs its modes, writes one results file per cell and unloads it.
//
//   pnpm eval:exchange:grid [--round 1|fix] [--runs 5] [--only label,label]
//
// Variants are LM Studio variant keys (`lms ls <model> --json`); `lms load` cannot pick a variant,
// so this uses the LM Studio SDK. A variant that fails to load (not downloaded) is reported as
// skipped and the grid carries on.
import { join } from 'node:path'
import { LMStudioClient } from '@lmstudio/sdk'
import type { ContractId } from './contract.ts'
import { runCell, writeResult, type Mode } from './run.ts'

interface GridCell {
  label: string
  variant: string
  modes: Mode[]
  /** Leave the model's thinking on, as the app's port does today (no `reasoning_effort`). */
  think?: boolean
  runs?: number
  contract?: ContractId
  temperature?: number
  sampling?: Record<string, unknown>
  maxTokens?: number
  effects?: boolean
}

/** Round 1: models, quants and wire modes on the first contract. */
export const ROUND_1: GridCell[] = [
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

const MLX4 = 'qwen/qwen3.5-9b@4bit'

/** Fix round: contract and prompt variants, and reasoning on vs off, on the chosen default model. */
export const FIX_ROUND: GridCell[] = [
  { label: 'fix-v2-prompt', variant: MLX4, modes: ['raw-schema'], contract: 'v2-prompt' },
  { label: 'fix-v2-flat', variant: MLX4, modes: ['raw-schema', 'schema'], contract: 'v2-flat' },
  {
    label: 'fix-v2-resists',
    variant: MLX4,
    modes: ['raw-schema', 'schema'],
    contract: 'v2-resists'
  },
  // Thinking on. A wire schema would constrain the reasoning itself, so the schema goes in the
  // prompt and the JSON is read from the final content. Qwen's recommended thinking sampling; at
  // 0.7 without a presence penalty the reasoning loops until max_tokens. Slow, so one run.
  {
    label: 'fix-thinking',
    variant: MLX4,
    modes: ['prompt-json'],
    contract: 'v2-flat',
    think: true,
    runs: 1,
    temperature: 1.0,
    sampling: { presence_penalty: 1.5, top_p: 0.95, top_k: 20 },
    maxTokens: 8192,
    effects: false
  }
]

const ROUNDS: Record<string, GridCell[]> = { '1': ROUND_1, fix: FIX_ROUND }

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
  const grid = ROUNDS[arg('round') ?? 'fix'] ?? FIX_ROUND
  const client = new LMStudioClient({
    logger: { info() {}, warn: console.warn, error: console.error, debug() {} }
  })
  const skipped: string[] = []
  for (const cell of grid.filter((c) => !only || only.includes(c.label))) {
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
        contract: cell.contract,
        runs: cell.runs ?? runs,
        temperature: cell.temperature ?? 0.7,
        think: cell.think ?? false,
        sampling: cell.sampling,
        maxTokens: cell.maxTokens,
        effects: cell.effects,
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
