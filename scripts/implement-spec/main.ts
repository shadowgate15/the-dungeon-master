// Runs a spec's tickets as a deterministic loop. See README.md beside this file.
//
//   pnpm implement-spec <spec#> [--explore]
import { createClaude, createGit, createTracker } from './ports.ts'
import { runSpec } from './run-spec.ts'

const USAGE = 'usage: pnpm implement-spec <spec#> [--explore]'

const parse = (args: string[]) => {
  const positional = args.filter((arg) => !arg.startsWith('--'))
  const flags = args.filter((arg) => arg.startsWith('--'))
  const unknown = flags.filter((flag) => flag !== '--explore')
  const spec = Number(positional[0])
  if (positional.length !== 1 || !Number.isInteger(spec) || spec <= 0 || unknown.length > 0) {
    return null
  }
  return { spec, explore: flags.includes('--explore') }
}

const parsed = parse(process.argv.slice(2))
if (!parsed) {
  console.error(USAGE)
  process.exit(2)
}

const root = await createGit(process.cwd()).repoRoot()
const result = await runSpec(
  parsed.spec,
  { explore: parsed.explore },
  {
    tracker: createTracker(root),
    git: createGit(root),
    claude: createClaude(),
    log: (line) => console.log(line)
  }
)
process.exit(result.ok ? 0 : 1)
