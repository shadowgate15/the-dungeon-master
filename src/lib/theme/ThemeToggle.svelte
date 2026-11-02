<script lang="ts">
  import { enhance } from '$app/forms'
  import { THEME_OPTIONS, type ThemeChoice } from './theme.ts'

  let {
    theme,
    redirectTo = '/'
  }: {
    /** The persisted choice, as read from the cookie on the server. */
    theme: ThemeChoice
    /** Where the no-JS POST sends the browser back to. */
    redirectTo?: string
  } = $props()

  // Set on click so the toggle and page react before the server answers.
  let chosen = $state<ThemeChoice | null>(null)
  const active = $derived(chosen ?? theme)

  function apply(value: ThemeChoice) {
    chosen = value
    const root = document.documentElement
    if (value === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', value)
  }
</script>

<form
  method="POST"
  action="/theme"
  aria-label="Theme"
  class="inline-flex"
  use:enhance={({ submitter }) => {
    const value = (submitter as HTMLButtonElement | null)?.value as ThemeChoice | undefined
    if (value) apply(value)
    // The cookie is set by the response; the page already shows the result.
    return async () => {}
  }}
>
  <input type="hidden" name="redirectTo" value={redirectTo} />
  <div class="flex overflow-hidden rounded-control border border-control-border text-sm">
    {#each THEME_OPTIONS as option (option.value)}
      <button
        type="submit"
        name="theme"
        value={option.value}
        title={option.label}
        aria-pressed={active === option.value}
        class="px-3 py-1.5 focus-visible:relative focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus {active ===
        option.value
          ? 'bg-primary text-on-primary'
          : 'bg-surface text-text hover:bg-raised'}"
      >
        <span aria-hidden="true">{option.icon}</span>
        <span class="sr-only">{option.label}</span>
      </button>
    {/each}
  </div>
</form>
