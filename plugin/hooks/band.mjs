// The mod band: draws the game's URL above the DM session's prompt. The URLs come from
// `dm-hooks.mjs band`, which reads the runtime file `dm` prints from and is inert outside a Campaign folder.
const REFRESH_MS = 5000

export const register = on => {
  let lines = []
  let checkedAt = 0

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const now = await $.clock.now()
    if (now - checkedAt > REFRESH_MS) {
      checkedAt = now
      lines = await bandLines($)
    }
    if (e.props.hasSurvey || lines.length === 0) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    return h(
      Box,
      { flexDirection: 'column' },
      ...lines.map((line, i) => h(Text, { key: String(i), dimColor: true }, line))
    )
  })
}

async function bandLines($) {
  try {
    const env = await $.process.hookEnv()
    const root = env.CLAUDE_PLUGIN_ROOT
    if (!root) return []
    const cwd = await $.session.cwd()
    const { exitCode, stdout } = await $.process.run(['node', `${root}/hooks/dm-hooks.mjs`, 'band'], {
      env,
      stdin: JSON.stringify({ cwd }),
      timeoutMs: 3000
    })
    if (exitCode !== 0 || !stdout.trim()) return []
    return JSON.parse(stdout).lines ?? []
  } catch {
    return []
  }
}
