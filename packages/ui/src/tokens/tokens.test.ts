import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const src = join(import.meta.dirname, '..')
const read = (path: string) => readFileSync(join(src, path), 'utf8')

const tokensCss = read('styles/tokens.css')
const themeCss = read('styles/theme.css')
const indexCss = read('styles/index.css')

/** Token name -> raw value, for every `--name: value;` in a CSS text (comments removed). */
function declarations(css: string) {
  const tokens = new Map<string, string>()
  for (const [, name, value] of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/--([\w-]+):\s*([^;]+);/g)) {
    if (name && value) tokens.set(name, value.trim())
  }
  return tokens
}

/** The light and dark colour of a value like `light-dark(#fff, #000)` or `#fff`. */
function colours(value: string | undefined): { light: string; dark: string } | undefined {
  const pair = value?.match(/^light-dark\((#[0-9a-f]{6}),\s*(#[0-9a-f]{6})\)$/i)
  if (pair?.[1] && pair[2]) return { light: pair[1], dark: pair[2] }
  if (value && /^#[0-9a-f]{6}$/i.test(value)) return { light: value, dark: value }
  return undefined
}

/** WCAG 2.2 contrast ratio between two #rrggbb colours. */
function contrast(a: string, b: string) {
  const luminance = (hex: string) => {
    const [r = 0, g = 0, bl = 0] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl
  }
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

const theme = declarations(themeCss)
const shared = declarations(tokensCss)
const token = (name: string) => theme.get(name) ?? shared.get(name)

// Not tokens: Base UI sets these on popups while the page runs (the trigger's
// size, the free space on screen, the point a popup grows from).
const baseUiVariables = new Set(['available-height', 'available-width', 'anchor-width', 'anchor-height', 'transform-origin'])

describe('theme', () => {
  it('is part of the one stylesheet, after the tokens', () => {
    expect(indexCss).toContain('@import "./tokens.css";\n@import "./theme.css";')
  })

  it('defines every token the stylesheets and screens use', () => {
    const screens = readdirSync(src, { recursive: true, encoding: 'utf8' })
      .filter((f) => f.endsWith('.tsx'))
      .map((f) => read(f))
    const used = new Set(
      [tokensCss, indexCss, ...screens].flatMap((text) => [...text.matchAll(/(?:var)?\(--([\w-]+)\)/g)].map((m) => m[1])),
    )
    expect([...used].filter((name) => name && !theme.has(name) && !shared.has(name) && !baseUiVariables.has(name))).toEqual([])
  })

  it('sets its values again on nested data-theme elements, so light inside dark works', () => {
    expect(themeCss).toMatch(/^:root,\n\[data-theme\] \{/m)
  })
})

describe('colour contrast (WCAG 2.2 AA)', () => {
  // [text or mark, background, minimum ratio]: 4.5 for text, 3 for focus rings, selection and field outlines.
  const pairs: [string, string, number][] = [
    ['foreground', 'background', 4.5],
    ['foreground', 'panel', 4.5],
    ['muted-foreground', 'panel', 4.5],
    ['muted-foreground', 'muted', 4.5],
    ['muted-foreground', 'canvas', 4.5],
    ['muted-foreground', 'input', 4.5],
    ['accent-foreground', 'accent', 4.5],
    ['primary-foreground', 'primary', 4.5],
    ['primary-foreground', 'primary-hover', 4.5],
    ['primary-subtle-foreground', 'primary-subtle', 4.5],
    ['primary-subtle-foreground', 'primary-subtle-hover', 4.5],
    ['popover-foreground', 'popover', 4.5],
    ['tooltip-foreground', 'tooltip', 4.5],
    ['muted-foreground', 'tooltip', 4.5],
    ['destructive-foreground', 'destructive', 4.5],
    ['destructive-text', 'panel', 4.5],
    ['destructive-text', 'input', 4.5],
    ['primary', 'panel', 3],
    ['ring', 'panel', 3],
    ['ring', 'canvas', 3],
    // No 3:1 rule for field outlines: the owner picked the soft outline the buttons use (2026-11-12).
    ['selection', 'page', 3],
  ]

  for (const mode of ['light', 'dark'] as const) {
    it(`passes in ${mode} mode`, () => {
      const failures = pairs.flatMap(([fg, bg, min]) => {
        const a = colours(token(fg))?.[mode]
        const b = colours(token(bg))?.[mode]
        if (!a || !b) return [`${fg} on ${bg}: not a plain colour`]
        const ratio = contrast(a, b)
        return ratio < min ? [`${fg} on ${bg}: ${ratio.toFixed(2)} (needs ${min})`] : []
      })
      expect(failures).toEqual([])
    })
  }
})

describe('shared tokens', () => {
  it('keeps the figure page white in light and dark mode', () => {
    expect(shared.get('page')).toBe('#ffffff')
    expect(theme.has('page')).toBe(false)
  })

  it('turns animation off when the system asks for reduced motion', () => {
    const reduced = tokensCss.match(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/)?.[1] ?? ''
    const durations = [...shared.keys()].filter((name) => name.startsWith('duration-'))
    expect(durations.length).toBeGreaterThan(0)
    for (const name of durations) expect(reduced, name).toContain(`--${name}: 0ms;`)
  })
})
