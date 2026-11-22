// PROTOTYPE — auto-allow the spike's own MCP tools when the launcher ran with --auto-allow.
// Without it, this hook does nothing and you feel the real permission prompts.
if (process.env.DM_SPIKE_AUTOALLOW === '1') {
	process.stdout.write(
		JSON.stringify({
			hookSpecificOutput: {
				hookEventName: 'PreToolUse',
				permissionDecision: 'allow',
				permissionDecisionReason: 'dm-spike auto-allows its own game tools'
			}
		})
	);
}
