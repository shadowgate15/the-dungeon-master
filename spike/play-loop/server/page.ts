// PROTOTYPE — the browser side of the play-loop spike (#298). Deliberately unpolished.
export const PAGE = /* html */ `<!doctype html>
<html><head><meta charset="utf-8"><title>DM spike</title>
<style>
  body{font:15px/1.5 system-ui;margin:0;display:grid;grid-template-columns:1fr 260px;height:100vh;background:#1b1712;color:#eadfcb}
  main{display:flex;flex-direction:column;min-height:0}
  #log{flex:1;overflow:auto;padding:16px}
  .e{margin:0 0 10px;white-space:pre-wrap}
  .player{color:#9fc7ff}.narration{color:#f3e7cf}.roll{color:#e0b45c;font-family:monospace;font-size:13px}
  .state{color:#e07a5c;font-family:monospace;font-size:13px}.system,.timing{color:#8a7f6d;font-size:12px;font-family:monospace}
  form{display:flex;gap:8px;padding:12px;border-top:1px solid #3a3226}
  input,select,button{font:inherit;background:#2a241b;color:inherit;border:1px solid #4a4030;padding:6px 10px;border-radius:4px}
  input{flex:1}
  aside{border-left:1px solid #3a3226;padding:16px;overflow:auto}
  #thinking{padding:0 16px 8px;color:#e0b45c;font-style:italic;display:none}
  .perm{border:1px solid #e0b45c;padding:8px;margin:8px 0;border-radius:4px;font-size:13px}
  .badge{font-size:12px;padding:2px 6px;border-radius:3px}
  .on{background:#2f5e35}.off{background:#5e2f2f}
</style></head><body>
<main>
  <div style="padding:10px 16px;border-bottom:1px solid #3a3226">
    Campaign: <select id="camp"></select> <span id="sess" class="badge off">no session</span>
  </div>
  <div id="log"></div>
  <div id="thinking">The DM is thinking… <span id="clock"></span></div>
  <form id="f"><select id="who"></select><input id="txt" placeholder="What do you do?" autocomplete="off"><button>Send</button></form>
</main>
<aside><h3 style="margin-top:0">Party</h3><div id="party"></div><h3>Permission prompts</h3><div id="perms"><span style="color:#8a7f6d;font-size:13px">none</span></div></aside>
<script>
const token = new URLSearchParams(location.search).get('token');
const q = (p, extra='') => p + '?token=' + token + extra;
let campaign = null, es = null, thinkStart = 0, timer = null;
const $ = (id) => document.getElementById(id);

async function loadCampaigns() {
  let r;
  try { r = await fetch(q('/api/campaigns')); } catch { r = null; }
  if (!r || !r.ok) {
    $('sess').textContent = r ? 'server rejected this tab (restarted?) — open the URL the launcher printed' : 'game server not reachable';
    $('sess').className = 'badge off'; return;
  }
  const list = await r.json();
  const cur = $('camp').value;
  $('camp').innerHTML = list.map(c => '<option value="' + c.path + '">' + c.name + (c.session ? ' ●' : '') + '</option>').join('');
  if (cur) $('camp').value = cur;
  if (!campaign && list.length) connect(list[list.length - 1].path);
}
$('camp').onchange = () => connect($('camp').value);
setInterval(loadCampaigns, 5000);

function entry(e) {
  const d = document.createElement('p'); d.className = 'e ' + e.kind; d.textContent = e.text;
  $('log').appendChild(d); $('log').scrollTop = 1e9;
}
function connect(path) {
  campaign = path; $('camp').value = path; $('log').innerHTML = '';
  if (es) es.close();
  es = new EventSource(q('/api/stream', '&campaign=' + encodeURIComponent(path)));
  es.onerror = () => { $('sess').textContent = 'lost the game server stream'; $('sess').className = 'badge off'; };
  let first = true;
  es.addEventListener('state', (m) => {
    const s = JSON.parse(m.data);
    if (first) { s.log.forEach(entry); first = false; }
    $('sess').textContent = s.session ? 'DM session live' : 'no session'; $('sess').className = 'badge ' + (s.session ? 'on' : 'off');
    $('party').innerHTML = s.party.map(p => '<div>' + p.name + ' — ' + p.hp + '/' + p.maxHp + ' HP</div>').join('');
    const cur = $('who').value;
    $('who').innerHTML = s.party.map(p => '<option>' + p.name + '</option>').join(''); if (cur) $('who').value = cur;
  });
  es.addEventListener('log', (m) => entry(JSON.parse(m.data)));
  es.addEventListener('thinking', (m) => {
    const on = JSON.parse(m.data).on; $('thinking').style.display = on ? 'block' : 'none';
    clearInterval(timer);
    if (on) { thinkStart = Date.now(); timer = setInterval(() => $('clock').textContent = ((Date.now() - thinkStart)/1000).toFixed(0) + 's', 250); }
  });
  es.addEventListener('permission_request', (m) => {
    const p = JSON.parse(m.data);
    if ($('perms').querySelector('span')) $('perms').innerHTML = '';
    const d = document.createElement('div'); d.className = 'perm'; d.id = 'perm-' + p.request_id;
    d.innerHTML = '<b>' + p.tool_name + '</b><br>' + (p.description || '') + '<pre style="white-space:pre-wrap">' + (p.input_preview || '') + '</pre>';
    for (const b of ['allow', 'deny']) {
      const btn = document.createElement('button'); btn.textContent = b; btn.style.marginRight = '6px';
      btn.onclick = () => fetch(q('/api/permission', '&campaign=' + encodeURIComponent(campaign)), { method: 'POST', body: JSON.stringify({ request_id: p.request_id, behavior: b }) });
      d.appendChild(btn);
    }
    $('perms').appendChild(d);
  });
  es.addEventListener('permission_done', (m) => { const el = $('perm-' + JSON.parse(m.data).request_id); if (el) el.remove(); });
}
$('f').onsubmit = async (ev) => {
  ev.preventDefault(); const text = $('txt').value.trim(); if (!text || !campaign) return;
  const r = await fetch(q('/api/input', '&campaign=' + encodeURIComponent(campaign)), { method: 'POST', body: JSON.stringify({ text, character: $('who').value }) });
  if (!r.ok) entry({ kind: 'system', text: 'input refused: ' + (await r.json()).error }); else $('txt').value = '';
};
loadCampaigns();
</script></body></html>`;
