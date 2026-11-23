import type { MenuSection } from '@biofigure-lab/ui/components/menu/Menu'
import type { QuickActionGroup } from '@biofigure-lab/ui/components/quick-actions/QuickActions'
import { describe, expect, it, vi } from 'vitest'

import { alignBarActions, menuSections, quickActionGroups, type Commands } from './canvas-actions'
import type { SelectionInfo } from './FigureCanvas'
import { DEFAULT_TEXT_STYLE } from './text-style'

const commands = (): Commands => ({
  cut: vi.fn(),
  copy: vi.fn(),
  paste: vi.fn(),
  duplicate: vi.fn(),
  deleteSelection: vi.fn(),
  arrange: vi.fn(),
  group: vi.fn(),
  ungroup: vi.fn(),
  toggleLock: vi.fn(),
  align: vi.fn(),
  distribute: vi.fn(),
  selectAll: vi.fn(),
  change: vi.fn(),
  tableCommand: vi.fn(),
  changeText: vi.fn(),
})

const selection = (extra: Partial<SelectionInfo> = {}): SelectionInfo => ({
  kind: 'shape',
  name: 'Rectangle',
  count: 1,
  hasGroup: false,
  locked: false,
  bounds: { left: 0, top: 0, width: 10, height: 10 },
  fill: '#ffffff',
  stroke: '#000000',
  strokeWidth: 1,
  opacity: 1,
  left: 0,
  top: 0,
  width: 10,
  height: 10,
  ...extra,
})

const labels = (groups: QuickActionGroup[]) => groups.flatMap((group) => group.actions.map((action) => action.label))
const item = (sections: MenuSection[], label: string) => sections.flatMap((section) => section.actions).find((action) => action.label === label)

describe('quick actions', () => {
  it('offers the colours a kind of object has', () => {
    expect(labels(quickActionGroups(selection(), commands(), vi.fn()))).toEqual(['Fill', 'Line colour', 'Duplicate', 'Lock', 'Delete', 'More actions'])
    expect(labels(quickActionGroups(selection({ kind: 'line' }), commands(), vi.fn()))).not.toContain('Fill')
  })

  it('gives text its own short bar, and switches a subscript off again', () => {
    const run = commands()
    const text = selection({ kind: 'text', text: { ...DEFAULT_TEXT_STYLE, script: 'sub' } })
    const groups = quickActionGroups(text, run, vi.fn())
    expect(labels(groups)).toEqual(['Bold', 'Italic', 'Subscript', 'Superscript', 'Colour', 'More actions'])
    const subscript = groups[0]?.actions[2]
    if (!subscript || !('onClick' in subscript)) throw new Error('no subscript action')
    expect(subscript.pressed).toBe(true)
    subscript.onClick({} as HTMLElement)
    expect(run.changeText).toHaveBeenCalledWith({ script: 'none' })
  })

  it('styles just the selected characters while typing, with underline and strikethrough instead of More', () => {
    const run = commands()
    const groups = quickActionGroups(selection({ kind: 'text', text: DEFAULT_TEXT_STYLE, textRange: true }), run, vi.fn())
    expect(labels(groups)).toEqual(['Bold', 'Italic', 'Subscript', 'Superscript', 'Underline', 'Strikethrough', 'Colour'])
    const underline = groups[0]?.actions[4]
    if (!underline || !('onClick' in underline)) throw new Error('no underline action')
    underline.onClick({} as HTMLElement)
    expect(run.changeText).toHaveBeenCalledWith({ underline: true })
  })

  it('adds Group for several objects and Ungroup for a group', () => {
    expect(labels(quickActionGroups(selection({ kind: 'multiple', count: 2 }), commands(), vi.fn()))).toContain('Group')
    expect(labels(quickActionGroups(selection({ kind: 'group' }), commands(), vi.fn()))).toContain('Ungroup')
  })

  it('runs the editor command, so it is one undo step like the shortcut', () => {
    const run = commands()
    const fill = quickActionGroups(selection(), run, vi.fn())[0]?.actions[0]
    if (!fill || !('onColour' in fill)) throw new Error('no fill action')
    fill.onColour('#ff0000')
    expect(run.change).toHaveBeenCalledWith({ fill: '#ff0000' })
  })
})

describe('right-click menu', () => {
  it('shows only Paste and Select all on empty page', () => {
    const sections = menuSections(null, commands(), false)
    expect(sections.flatMap((section) => section.actions.map((action) => action.label))).toEqual(['Paste', 'Select all'])
    expect(item(sections, 'Paste')?.disabled).toBe(true)
  })

  it('offers what fits the selection', () => {
    const one = menuSections(selection(), commands(), true)
    expect(item(one, 'Group')?.disabled).toBe(true)
    expect(item(one, 'Ungroup')?.disabled).toBe(true)
    expect(item(one, 'Paste')?.disabled).toBe(false)
    expect(item(menuSections(selection({ locked: true }), commands(), true), 'Unlock')).toBeDefined()
  })

  it('moves one layer at a time from the menu', () => {
    const run = commands()
    item(menuSections(selection(), run, false), 'Bring forward')?.onClick?.()
    expect(run.arrange).toHaveBeenCalledWith('forward')
  })
})

describe('top bar align buttons', () => {
  it('come in the set order, and distribute only works for three or more', () => {
    const one = alignBarActions(selection(), commands())
    expect(one.map((action) => action.label)).toEqual([
      'Align left to page',
      'Align centre to page',
      'Align right to page',
      'Align top to page',
      'Align middle to page',
      'Align bottom to page',
      'Distribute horizontally',
      'Distribute vertically',
    ])
    expect(one.find((action) => action.label === 'Distribute horizontally')?.disabled).toBe(true)
    expect(alignBarActions(selection({ kind: 'multiple', count: 3 }), commands()).every((action) => !action.disabled)).toBe(true)
  })

  it('run the editor command', () => {
    const run = commands()
    alignBarActions(selection({ count: 3, kind: 'multiple' }), run).at(-1)?.onClick?.()
    expect(run.distribute).toHaveBeenCalledWith('vertical')
  })
})
