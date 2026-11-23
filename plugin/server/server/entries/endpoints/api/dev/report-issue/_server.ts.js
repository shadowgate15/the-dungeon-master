import { i as json } from "../../../../../chunks/exports.js";
import { d as record, l as number, p as string, u as object } from "../../../../../chunks/schemas.js";
import { tmpdir } from "node:os";
import { execFile, execFileSync, spawn } from "node:child_process";
import { promisify } from "node:util";
// src/lib/server/issue-report/generate-title.ts
var MAX_TITLE_LENGTH = 72;
var TIMEOUT_MS = 3e4;
/**
* Asks the `claude` CLI, which brings its own authentication, with no tools and no saved session.
* It runs from a temp directory so it does not load this project's CLAUDE.md, hooks or MCP servers.
*/
var runClaude = (prompt) => new Promise((resolve, reject) => {
	const child = spawn("claude", [
		"-p",
		"--model",
		"haiku",
		"--tools",
		"",
		"--no-session-persistence",
		"--disable-slash-commands",
		"--output-format",
		"text"
	], {
		cwd: tmpdir(),
		timeout: TIMEOUT_MS,
		stdio: [
			"pipe",
			"pipe",
			"ignore"
		]
	});
	let stdout = "";
	child.stdout.on("data", (chunk) => stdout += chunk);
	child.on("error", reject);
	child.on("close", (code) => code === 0 ? resolve(stdout) : reject(/* @__PURE__ */ new Error(`claude exited with ${code}`)));
	child.stdin.on("error", () => {});
	child.stdin.end(prompt);
});
var prompt = (description) => [
	"Write a GitHub issue title for the bug report or request below.",
	`Answer with the title only: one line, imperative, ${MAX_TITLE_LENGTH} characters or fewer, no quotes, no prefix.`,
	"",
	description
].join("\n");
var tidy = (text) => (text.trim().split("\n")[0] ?? "").trim().replace(/^["'`]+|["'`]+$/g, "").trim().slice(0, MAX_TITLE_LENGTH);
/**
* A title for the report, written by `claude` from the description alone. When `claude` is
* missing, fails, or says nothing, the description's first line stands in, so filing never waits on it.
*/
var generateTitle = async (description, { claude = runClaude } = {}) => {
	return await claude(prompt(description)).then(tidy, () => "") || (description.trim().split("\n")[0] ?? "").trim().slice(0, MAX_TITLE_LENGTH);
};
// src/lib/server/issue-report/create-issue.ts
var execFileAsync = promisify(execFile);
var DEFAULT_REPO = "shadowgate15/the-dungeon-master";
var runGh = async (args) => (await execFileAsync("gh", args)).stdout;
var buildBody = (report, context) => {
	const params = Object.entries(context.params);
	return [
		report.description,
		"## Context",
		`- URL: ${context.url}`,
		`- Route: ${context.route ?? "none"}`,
		...params.map(([name, value]) => `- ${name}: ${value}`),
		`- Viewport: ${context.viewport.width}×${context.viewport.height}`,
		`- User agent: ${context.userAgent}`,
		`- Reported at: ${context.timestamp}`,
		`- Commit: ${context.commit}`
	].join("\n\n");
};
var AUTH_FAILURE = /credentials|unauthori[sz]ed|authenticat|not logged in|\b401\b/i;
var describeFailure = (cause) => {
	const { code, stderr } = cause;
	if (code === "ENOENT") return "`gh` is not installed, so no issue was filed.";
	const reason = stderr?.trim();
	if (!reason) return "`gh` failed without saying why, so no issue was filed.";
	if (AUTH_FAILURE.test(reason) && !reason.includes("gh auth login")) return `${reason}\nRun \`gh auth login\` and try again.`;
	return reason;
};
/** Files the report as a GitHub issue through the `gh` CLI, which brings its own authentication. */
var createIssue = async (report, context, { gh = runGh, generateTitle: generateTitle$1 = generateTitle, repo = DEFAULT_REPO } = {}) => {
	try {
		return {
			ok: true,
			url: (await gh([
				"issue",
				"create",
				"--repo",
				repo,
				"--title",
				await generateTitle$1(report.description),
				"--label",
				"needs-triage",
				"--body",
				buildBody(report, context)
			])).trim()
		};
	} catch (cause) {
		return {
			ok: false,
			error: describeFailure(cause)
		};
	}
};
// src/lib/server/issue-report/handle-report.ts
var reportSchema = object({
	description: string().trim().min(1),
	context: object({
		url: string(),
		route: string().nullable(),
		params: record(string(), string()),
		viewport: object({
			width: number(),
			height: number()
		}),
		userAgent: string()
	})
});
/**
* Files a dev-only issue report. The body is `reportSchema`: what the reporter wrote plus the
* page context the browser captured; the timestamp and commit are added here. Answers
* `{ url }` of the new issue, or `{ error }`. Outside dev it does not exist (404).
*/
var handleReport = async (body, deps) => {
	if (!deps.dev) return json({ error: "Not found" }, { status: 404 });
	const parsed = reportSchema.safeParse(body);
	if (!parsed.success) return json({ error: "Invalid request" }, { status: 400 });
	const { description, context } = parsed.data;
	const result = await deps.createIssue({ description }, {
		...context,
		timestamp: deps.now().toISOString(),
		commit: deps.commit()
	});
	if (!result.ok) return json({ error: result.error }, { status: 502 });
	return json({ url: result.url });
};
// src/routes/api/dev/report-issue/+server.ts
var currentCommit = () => {
	try {
		return execFileSync("git", [
			"rev-parse",
			"--short",
			"HEAD"
		], { encoding: "utf8" }).trim();
	} catch {
		return "unknown";
	}
};
/** Dev-only: files a GitHub issue for a report made from the in-app "Report an issue" dialog. */
var POST = async ({ request }) => handleReport(await request.json().catch(() => null), {
	dev: false,
	now: () => /* @__PURE__ */ new Date(),
	commit: currentCommit,
	createIssue: (report, context) => createIssue(report, context, { repo: process.env.REPORT_ISSUE_REPO })
});
export { POST };

//# sourceMappingURL=_server.ts.js.map