// The plugin's bridge entry point, bundled to plugin/bin/dm-bridge.mjs by `pnpm build:bridge`.
import { startBridge } from './bridge'

await startBridge()
