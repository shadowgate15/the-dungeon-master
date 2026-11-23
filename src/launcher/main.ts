// The `dm` launcher entry point, bundled to plugin/bin/dm.mjs by `pnpm build:bridge`.
import { runLauncher } from './launcher'

process.exitCode = await runLauncher(process.argv.slice(2))
