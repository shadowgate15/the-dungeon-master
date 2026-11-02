<!-- PROTOTYPE (throwaway): three theme-toggle placements. Every control is a plain
     <form method="POST"> button, so it works without JS; here the submit is
     intercepted to stand in for the cookie round-trip. -->
<script lang="ts">
  type Pref = 'system' | 'light' | 'dark'
  let { variant = 'A', initial = 'system' }: { variant?: 'A' | 'B' | 'C'; initial?: Pref } =
    $props()

  // svelte-ignore state_referenced_locally
  let pref = $state<Pref>(initial)
  const order: Pref[] = ['system', 'light', 'dark']
  const icon = { system: '◐', light: '☀', dark: '☾' }
  const label = { system: 'System', light: 'Light', dark: 'Dark' }
  const next = $derived(order[(order.indexOf(pref) + 1) % 3])

  function submit(e: SubmitEvent) {
    e.preventDefault()
    const form = e.currentTarget as HTMLFormElement
    pref = (e.submitter as HTMLButtonElement).value as Pref
    form.closest('details')?.removeAttribute('open')
  }
</script>

<div class="frame" data-theme={pref === 'system' ? undefined : pref}>
  <header>
    <strong class="brand">The Dungeon Master</strong>
    <nav><a href="#a">Worlds</a><a href="#b">Campaigns</a></nav>

    {#if variant === 'A'}
      <!-- A: segmented three-way control in the header -->
      <form method="POST" action="/theme" onsubmit={submit} class="seg" aria-label="Theme">
        {#each order as p (p)}
          <button name="theme" value={p} aria-pressed={pref === p} title={label[p]}>
            <span aria-hidden="true">{icon[p]}</span><span class="sr">{label[p]}</span>
          </button>
        {/each}
      </form>
    {:else if variant === 'B'}
      <!-- B: single button that cycles system, light, dark -->
      <form method="POST" action="/theme" onsubmit={submit}>
        <button
          name="theme"
          value={next}
          class="cycle"
          title="Theme: {label[pref]}. Switch to {label[next]}"
        >
          <span aria-hidden="true">{icon[pref]}</span>
          {label[pref]}
        </button>
      </form>
    {:else}
      <!-- C: disclosure menu (<details> opens without JS) -->
      <details class="menu">
        <summary aria-label="Theme: {label[pref]}"
          ><span aria-hidden="true">{icon[pref]}</span> Theme ▾</summary
        >
        <form method="POST" action="/theme" onsubmit={submit}>
          {#each order as p (p)}
            <button name="theme" value={p} aria-current={pref === p}>
              <span aria-hidden="true">{pref === p ? '●' : '○'}</span>
              {label[p]}
            </button>
          {/each}
        </form>
      </details>
    {/if}
  </header>

  <main>
    <h1>Worlds</h1>
    <p class="muted">
      Mode: <b>{label[pref]}</b> (cookie <code>theme={pref === 'system' ? '(absent)' : pref}</code>)
    </p>
    <div class="card">
      <h2>Aldermoor</h2>
      <p class="muted">High fantasy · regional</p>
      <button class="primary">Open</button>
    </div>
  </main>
</div>

<style>
  .frame {
    --bg: #e9e5dc;
    --surface: #f4f1ea;
    --raised: #fbf9f4;
    --border: #c4bdae;
    --text: #23211d;
    --muted: #625d52;
    --primary: #8a2a2f;
    --on-primary: #fbf9f4;
    --accent: #8a6518;
    --focus: #1d4f8a;
    min-height: 360px;
    background: var(--bg);
    color: var(--text);
    font-family: Inter, system-ui, sans-serif;
  }
  @media (prefers-color-scheme: dark) {
    .frame:not([data-theme='light']) {
      --bg: #121215;
      --surface: #1b1b20;
      --raised: #25252b;
      --border: #3b3b44;
      --text: #e6e2d8;
      --muted: #9d9a90;
      --primary: #e6a23c;
      --on-primary: #17110a;
      --accent: #d4a24a;
      --focus: #79b0ec;
    }
  }
  .frame[data-theme='dark'] {
    --bg: #121215;
    --surface: #1b1b20;
    --raised: #25252b;
    --border: #3b3b44;
    --text: #e6e2d8;
    --muted: #9d9a90;
    --primary: #e6a23c;
    --on-primary: #17110a;
    --accent: #d4a24a;
    --focus: #79b0ec;
  }
  header {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.6rem 1rem;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
  }
  .brand {
    color: var(--accent);
    font-family: Metamorphous, serif;
    margin-right: auto;
  }
  nav {
    display: flex;
    gap: 1rem;
  }
  a {
    color: var(--text);
  }
  main {
    padding: 1.5rem 1rem;
  }
  .muted {
    color: var(--muted);
  }
  code {
    background: var(--raised);
    padding: 0 0.25rem;
  }
  .card {
    background: var(--raised);
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    padding: 1rem;
    max-width: 20rem;
  }
  button {
    font: inherit;
    color: var(--text);
    cursor: pointer;
  }
  button:focus-visible,
  summary:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  .primary {
    background: var(--primary);
    color: var(--on-primary);
    border: 0;
    border-radius: 0.375rem;
    padding: 0.35rem 0.8rem;
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }
  .seg {
    display: inline-flex;
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    overflow: hidden;
  }
  .seg button {
    background: transparent;
    border: 0;
    padding: 0.3rem 0.6rem;
  }
  .seg button[aria-pressed='true'] {
    background: var(--primary);
    color: var(--on-primary);
  }
  .cycle {
    background: var(--raised);
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    padding: 0.3rem 0.7rem;
  }
  .menu {
    position: relative;
  }
  .menu summary {
    cursor: pointer;
    list-style: none;
    padding: 0.3rem 0.7rem;
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    background: var(--raised);
  }
  .menu form {
    position: absolute;
    right: 0;
    top: 2.2rem;
    z-index: 5;
    display: grid;
    min-width: 9rem;
    background: var(--raised);
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    padding: 0.25rem;
    box-shadow: 0 6px 20px #0004;
  }
  .menu form button {
    text-align: left;
    background: transparent;
    border: 0;
    padding: 0.35rem 0.6rem;
    border-radius: 0.25rem;
  }
  .menu form button[aria-current='true'] {
    color: var(--primary);
    font-weight: 600;
  }
</style>
