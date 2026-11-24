// The plugin's hooks entry point, bundled to plugin/hooks/dm-hooks.mjs by `pnpm build:bridge`.
// Usage: node dm-hooks.mjs <pre-tool-use | stop | session-start>, with the hook input on stdin.
import { runHook, type HookInput, type HookName } from './hooks'

const chunks: Buffer[] = []
for await (const chunk of process.stdin) chunks.push(chunk as Buffer)
const text = Buffer.concat(chunks).toString('utf8')
const input = (text.trim() ? JSON.parse(text) : {}) as HookInput
const output = await runHook(process.argv[2] as HookName, input)
if (output) process.stdout.write(JSON.stringify(output) + '\n')
