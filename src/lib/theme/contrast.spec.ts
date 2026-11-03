import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// The CSS token file is the single source of truth for the palette.
const css = readFileSync(new URL('../../routes/layout.css', import.meta.url), 'utf8')

function block(opening: RegExp): string {
  const match = opening.exec(css)
  if (!match) throw new Error(`No CSS block matching ${opening}`)
  let depth = 1
  let i = match.index + match[0].length
  const start = i
  while (depth > 0 && i < css.length) {
    if (css[i] === '{') depth++
    else if (css[i] === '}') depth--
    i++
  }
  return css.slice(start, i - 1)
}

function declarations(body: string, prefix: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of body.matchAll(new RegExp(`--(${prefix}[\\w-]*):\\s*([^;]+);`, 'g'))) {
    out[m[1]] = m[2].trim()
  }
  return out
}

const raw = declarations(block(/^:root\s*\{/m), '')
const resolve = (value: string): string => {
  const ref = /^var\(--([\w-]+)\)$/.exec(value)
  return ref ? resolve(raw[ref[1]]) : value
}

function theme(body: string): Record<string, string> {
  const roles = declarations(body, 'color-')
  return Object.fromEntries(
    Object.entries(roles).map(([name, v]) => [name.replace('color-', ''), resolve(v)])
  )
}

const themes: Record<string, Record<string, string>> = {
  light: theme(block(/@theme\s*\{/)),
  dark: theme(block(/:root\[data-theme='dark'\]\s*\{/))
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const textPairs: [string, string][] = [
  ['text', 'bg'],
  ['text', 'surface'],
  ['text', 'raised'],
  ['muted', 'bg'],
  ['muted', 'surface'],
  ['muted', 'raised'],
  ['on-primary', 'primary'],
  ['primary', 'bg'],
  ['primary', 'surface'],
  ['accent', 'bg'],
  ['accent', 'surface'],
  ['accent', 'raised'],
  ['danger', 'danger-bg'],
  ['success', 'success-bg'],
  ['warning', 'warning-bg'],
  ['info', 'info-bg']
]

const uiPairs: [string, string][] = [
  ['focus', 'bg'],
  ['focus', 'surface'],
  ['focus', 'raised'],
  ['control-border', 'bg'],
  ['control-border', 'surface'],
  ['control-border', 'raised']
]

describe.each(Object.keys(themes))('%s theme token contrast', (name) => {
  const t = themes[name]
  it.each(textPairs)('text %s on %s is at least 4.5:1', (fg, bg) => {
    expect(contrast(t[fg], t[bg])).toBeGreaterThanOrEqual(4.5)
  })
  it.each(uiPairs)('UI %s against %s is at least 3:1', (fg, bg) => {
    expect(contrast(t[fg], t[bg])).toBeGreaterThanOrEqual(3)
  })
})

describe('system dark media block', () => {
  it('matches the explicit dark theme', () => {
    const media = theme(block(/@media \(prefers-color-scheme: dark\)\s*\{/))
    expect(media).toEqual(themes.dark)
  })
})
