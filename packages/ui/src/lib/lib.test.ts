import { describe, expect, it } from 'vitest'

import { cn } from './cn'
import { formatShortcut, shortcutKeys } from './shortcut'

describe('cn', () => {
  it('lets a later class override an earlier one of the same kind', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4')
    expect(cn('bg-primary', false, 'bg-muted')).toBe('bg-muted')
  })

  it('keeps our own text size next to a text colour', () => {
    // text-2xs is our 11 px size; it must not be mistaken for a colour.
    expect(cn('text-2xs', 'text-muted-foreground')).toBe('text-2xs text-muted-foreground')
    expect(cn('text-sm', 'text-2xs')).toBe('text-2xs')
  })
})

describe('shortcuts', () => {
  it('shows Ctrl and names on Windows and Linux', () => {
    expect(shortcutKeys('Mod+Shift+Z', 'other')).toEqual(['Ctrl', 'Shift', 'Z'])
    expect(formatShortcut('Mod+Z', 'other')).toBe('Ctrl+Z')
  })

  it('shows symbols on a Mac', () => {
    expect(shortcutKeys('Mod+Shift+Z', 'mac')).toEqual(['⌘', '⇧', 'Z'])
    expect(formatShortcut('Mod+Alt+G', 'mac')).toBe('⌘⌥G')
  })

  it('leaves single keys alone', () => {
    expect(formatShortcut('V', 'mac')).toBe('V')
    expect(formatShortcut('?', 'other')).toBe('?')
  })
})
