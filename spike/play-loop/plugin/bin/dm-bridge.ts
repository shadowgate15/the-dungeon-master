// PROTOTYPE — stateless stdio MCP/channel bridge for the play-loop spike (#298).
// Claude Code spawns this. It owns nothing: tools come from the server, calls are proxied,
// channel events and permission verdicts are relayed from the server's SSE stream.
// Raw JSON-RPC (no SDK) so we control the protocol version (channels break on 2026-07-28).
import { readFileSync, appendFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

const SUPPORTED = ['2025-06-18', '2025-03-26', '2024-11-05'];
const CAMPAIGN = process.env.DM_SPIKE_CAMPAIGN || process.env.CLAUDE_PROJECT_DIR || process.cwd();
const LOG = join(homedir(), '.dm-spike', 'bridge.log');

function dbg(...a: unknown[]) {
	const line = `${new Date().toISOString()} [${process.pid}] ${a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ')}\n`;
	process.stderr.write(line);
	try {
		appendFileSync(LOG, line);
	} catch {}
}

function runtime(): { port: number; token: string } | null {
	try {
		return JSON.parse(readFileSync(join(homedir(), '.dm-spike', 'runtime.json'), 'utf8'));
	} catch {
		return null;
	}
}

async function api(path: string, init?: RequestInit) {
	const rt = runtime();
	if (!rt) throw new Error('game server not running (no runtime file). Start it with the dm-spike launcher.');
	const sep = path.includes('?') ? '&' : '?';
	return fetch(`http://127.0.0.1:${rt.port}${path}${sep}campaign=${encodeURIComponent(CAMPAIGN)}`, {
		...init,
		headers: { 'x-dm-token': rt.token, 'content-type': 'application/json' }
	});
}

function send(msg: unknown) {
	process.stdout.write(JSON.stringify(msg) + '\n');
}

let refused: string | null = null;

async function streamFromServer() {
	try {
		const res = await api('/bridge/stream');
		if (res.status === 409) {
			refused = (await res.json()).error;
			dbg('refused by server:', refused);
			return;
		}
		if (!res.ok || !res.body) throw new Error(`stream status ${res.status}`);
		dbg('stream open for', CAMPAIGN);
		const dec = new TextDecoder();
		let buf = '';
		for await (const chunk of res.body as any) {
			buf += dec.decode(chunk, { stream: true });
			let i;
			while ((i = buf.indexOf('\n\n')) >= 0) {
				const block = buf.slice(0, i);
				buf = buf.slice(i + 2);
				const ev = /^event: (.*)$/m.exec(block)?.[1];
				const data = /^data: (.*)$/m.exec(block)?.[1];
				if (!ev || !data) continue;
				const d = JSON.parse(data);
				if (ev === 'channel') {
					dbg('→ channel', d);
					send({ jsonrpc: '2.0', method: 'notifications/claude/channel', params: d });
				} else if (ev === 'permission') {
					dbg('→ permission verdict', d);
					send({ jsonrpc: '2.0', method: 'notifications/claude/channel/permission', params: d });
				}
			}
		}
		dbg('stream ended');
	} catch (e) {
		dbg('stream error', String(e));
	}
	if (!refused) setTimeout(streamFromServer, 2000); // server restarted? reconnect
}

const INSTRUCTIONS = `You are the Dungeon Master for a D&D 5e table. The player is in a web UI, not this terminal.
Player actions arrive as <channel source="dm-spike" character="..."> events.
Anything the player should see MUST go through the reply tool — your transcript text never reaches them.
Never invent numbers: use the roll tool for every check, attack and damage roll, and apply_damage for HP changes.
Keep replies short (2–5 sentences) and end by prompting the player. The party: Brakka (fighter) and Wren (rogue).
Campaign folder: ${CAMPAIGN}`;

async function handle(msg: any) {
	const { id, method, params } = msg;
	if (method === 'initialize') {
		const asked = params?.protocolVersion;
		const protocolVersion = SUPPORTED.includes(asked) ? asked : SUPPORTED[0];
		dbg('initialize; client asked', asked, '→ answering', protocolVersion, 'campaign', CAMPAIGN, {
			fromEnv: !!process.env.DM_SPIKE_CAMPAIGN,
			projectDir: process.env.CLAUDE_PROJECT_DIR,
			cwd: process.cwd()
		});
		return send({
			jsonrpc: '2.0',
			id,
			result: {
				protocolVersion,
				capabilities: { tools: {}, experimental: { 'claude/channel': {}, 'claude/channel/permission': {} } },
				serverInfo: { name: 'dm-spike', version: '0.0.0' },
				instructions: INSTRUCTIONS
			}
		});
	}
	if (method === 'notifications/initialized') {
		streamFromServer();
		return;
	}
	if (method === 'ping') return send({ jsonrpc: '2.0', id, result: {} });
	if (method === 'tools/list') {
		try {
			const { tools } = await (await api('/bridge/tools')).json();
			return send({ jsonrpc: '2.0', id, result: { tools } });
		} catch (e) {
			dbg('tools/list failed', String(e));
			return send({ jsonrpc: '2.0', id, result: { tools: [] } });
		}
	}
	if (method === 'tools/call') {
		if (refused) return send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: refused }], isError: true } });
		try {
			const r = await (await api('/bridge/call', { method: 'POST', body: JSON.stringify(params) })).json();
			return send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: r.text ?? r.error }], isError: !!r.isError || !!r.error } });
		} catch (e) {
			return send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: `game server not running: ${e}` }], isError: true } });
		}
	}
	if (method === 'notifications/claude/channel/permission_request') {
		dbg('← permission_request', params);
		api('/bridge/permission_request', { method: 'POST', body: JSON.stringify(params) }).catch((e) => dbg(String(e)));
		return;
	}
	if (id !== undefined) {
		dbg('unhandled request', method);
		return send({ jsonrpc: '2.0', id, error: { code: -32601, message: `method not found: ${method}` } });
	}
	dbg('ignored notification', method);
}

createInterface({ input: process.stdin }).on('line', (line) => {
	if (!line.trim()) return;
	try {
		handle(JSON.parse(line));
	} catch (e) {
		dbg('bad line', line, String(e));
	}
});
process.stdin.on('end', () => process.exit(0));
