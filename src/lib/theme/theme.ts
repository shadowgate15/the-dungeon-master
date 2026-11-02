export type ThemeChoice = 'system' | 'light' | 'dark'

/** A theme that is stored in the cookie; "system" means no cookie. */
export type StoredTheme = Exclude<ThemeChoice, 'system'>

export const THEME_COOKIE = 'theme'

export const THEME_OPTIONS: { value: ThemeChoice; icon: string; label: string }[] = [
  { value: 'system', icon: '◐', label: 'System' },
  { value: 'light', icon: '☀', label: 'Light' },
  { value: 'dark', icon: '☾', label: 'Dark' }
]

export function isStoredTheme(value: unknown): value is StoredTheme {
  return value === 'light' || value === 'dark'
}

/** Reads a raw cookie value; anything but light or dark means follow the OS. */
export function parseTheme(value: string | null | undefined): ThemeChoice {
  return isStoredTheme(value) ? value : 'system'
}
