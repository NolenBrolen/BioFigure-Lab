import type { MenuSection } from '@biofigure-lab/ui/components/menu/Menu'
import type { QuickActionGroup } from '@biofigure-lab/ui/components/quick-actions/QuickActions'
import { describe, expect, it, vi } from 'vitest'

import { alignBarActions, menuSections, quickActionGroups, type Commands, type QuickActionOptions } from './canvas-actions'
import type { SelectionInfo } from './FigureCanvas'
import { DEFAULT_TEXT_STYLE } from './text-style'

const commands = (): Commands => ({
  cut: vi.fn(),
  copy: vi.fn(),
  paste: vi.fn(),
  reverseArrows: vi.fn(),
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
// Looks inside submenus too (Arrange).
const item = (sections: MenuSection[], label: string) => sections.flatMap((section) => section.actions.flatMap((action) => [action, ...(action.submenu ?? [])])).find((action) => action.label === label)

// The screen draws the widgets; here each widget is just its kind, to check which one a button opens.
const bar = (extra: Partial<SelectionInfo> = {}, run = commands(), options: Partial<QuickActionOptions> = {}) =>
  quickActionGroups(selection(extra), run, { onMore: vi.fn(), widget: (kind) => kind, ...options })
const button = (groups: QuickActionGroup[], label: string) => {
  const found = groups.flatMap((group) => group.actions).find((each) => each.label === label)
  if (!found || 'swatch' in found) throw new Error(`no ${label}`)
  return { ...found, click: () => found.onClick?.({} as HTMLElement), opens: found.widget?.content(vi.fn()) }
}

describe('quick actions', () => {
  it('gives every kind the same layout: its own actions, then Lock and More (BIO-82)', () => {
    expect(labels(bar())).toEqual(['Style', 'Lock', 'More actions'])
    expect(button(bar(), 'Style').opens).toBe('style')
    expect(labels(bar({ kind: 'text', text: DEFAULT_TEXT_STYLE }))).toEqual(['Lock', 'More actions'])
    expect(labels(bar({ kind: 'multiple', count: 2 }))).toEqual(['Group', 'Lock', 'More actions'])
    expect(labels(bar({ kind: 'group' }))).toEqual(['Ungroup', 'Lock', 'More actions'])
    // No colours, Duplicate or Delete on desktop: the panel and the keyboard do those.
    expect(labels(bar({ kind: 'icon', frame: null }))).not.toContain('Delete')
  })

  it('keeps Duplicate and Delete on phones, which have no keyboard', () => {
    const run = commands()
    const groups = bar({}, run, { phone: true })
    expect(labels(groups)).toEqual(['Style', 'Duplicate', 'Delete', 'Lock', 'More actions'])
    button(groups, 'Delete').click()
    expect(run.deleteSelection).toHaveBeenCalled()
  })

  it('shows only Unlock and More on a locked object', () => {
    const run = commands()
    const groups = bar({ kind: 'table', locked: true, table: { picked: true } as SelectionInfo['table'] }, run, { phone: true })
    expect(labels(groups)).toEqual(['Unlock', 'More actions'])
    button(groups, 'Unlock').click()
    expect(run.toggleLock).toHaveBeenCalled()
  })

  it('gives an arrow Reverse when its ends differ, Ends to pick either head, and Style for its colours', () => {
    const run = commands()
    const look = { route: 'straight', line: 'solid', start: 'none', end: 'filled', mid: 'none' } as const
    const groups = bar({ kind: 'line', arrowLook: look }, run)
    expect(labels(groups)).toEqual(['Reverse', 'Ends', 'Style', 'Lock', 'More actions'])
    button(groups, 'Reverse').click()
    expect(run.reverseArrows).toHaveBeenCalled()
    expect(button(groups, 'Ends').opens).toBe('ends')
    expect(button(groups, 'Style').opens).toBe('arrow-style')
    // Both ends alike: reversing would change nothing.
    expect(labels(bar({ kind: 'line', arrowLook: { ...look, end: 'none' } }))).toEqual(['Ends', 'Style', 'Lock', 'More actions'])
  })

  it('gives a chart Edit data, which opens its data', () => {
    const onEditData = vi.fn()
    const groups = bar({ kind: 'chart' }, commands(), { onEditData })
    expect(labels(groups)).toEqual(['Edit data', 'Lock', 'More actions'])
    button(groups, 'Edit data').click()
    expect(onEditData).toHaveBeenCalled()
  })

  it('adds rows and columns at the end of a table, or next to the picked cells', () => {
    const run = commands()
    const whole = bar({ kind: 'table', table: { picked: false } as SelectionInfo['table'] }, run)
    expect(labels(whole)).toEqual(['Add row', 'Add column', 'Lock', 'More actions'])
    button(whole, 'Add column').click()
    expect(run.tableCommand).toHaveBeenCalledWith('col-right')
    // Picked cells: Row and Column open what can happen next to them.
    const cells = bar({ kind: 'table', table: { picked: true } as SelectionInfo['table'] }, run)
    expect(labels(cells)).toEqual(['Row', 'Column', 'Lock', 'More actions'])
    expect(button(cells, 'Row').opens).toBe('row')
    expect(button(cells, 'Column').opens).toBe('column')
  })

  it('gives one icon a Frame button that opens the frame styles, pressed while it has a frame', () => {
    const plain = bar({ kind: 'icon', frame: null })
    expect(labels(plain)).toEqual(['Frame', 'Lock', 'More actions'])
    expect(button(plain, 'Frame').opens).toBe('frame')
    expect(button(plain, 'Frame').pressed).toBe(false)
    const framed = bar({ kind: 'icon', frame: { style: 'tile', shape: 'rounded', fill: '#eee', outline: null, padding: 12, corners: 12, caption: 'inside', header: false, captionText: 'IgG', captionStyle: DEFAULT_TEXT_STYLE } })
    expect(button(framed, 'Frame').pressed).toBe(true)
    // A framed icon also gets Style, for the frame's colour presets.
    expect(labels(framed)).toEqual(['Frame', 'Style', 'Lock', 'More actions'])
    expect(button(framed, 'Style').opens).toBe('frame-style')
  })

  it('styles just the highlighted characters while typing, and switches a subscript off again', () => {
    const run = commands()
    const groups = bar({ kind: 'text', text: { ...DEFAULT_TEXT_STYLE, script: 'sub' }, textRange: true }, run)
    expect(labels(groups)).toEqual(['Bold', 'Italic', 'Subscript', 'Superscript', 'Underline', 'Strikethrough', 'Colour'])
    const subscript = button(groups, 'Subscript')
    expect(subscript.pressed).toBe(true)
    subscript.click()
    expect(run.changeText).toHaveBeenCalledWith({ script: 'none' })
  })
})

describe('right-click menu', () => {
  it('shows only Paste and Select all on empty page', () => {
    const sections = menuSections(null, commands(), false)
    expect(sections.flatMap((section) => section.actions.map((action) => action.label))).toEqual(['Paste', 'Select all'])
    expect(item(sections, 'Paste')?.disabled).toBe(true)
  })

  it('offers what fits the selection, without the align and lock the bars already have', () => {
    const one = menuSections(selection(), commands(), true)
    expect(item(one, 'Group')).toBeUndefined()
    expect(item(one, 'Ungroup')).toBeUndefined()
    expect(item(one, 'Paste')?.disabled).toBe(false)
    expect(item(one, 'Lock')).toBeUndefined()
    expect(item(one, 'Align left')).toBeUndefined()
    expect(item(menuSections(selection({ kind: 'multiple', count: 2 }), commands(), true), 'Group')).toBeDefined()
    expect(item(menuSections(selection({ kind: 'group', hasGroup: true }), commands(), true), 'Ungroup')).toBeDefined()
  })

  it('moves one layer at a time from the Arrange submenu', () => {
    const run = commands()
    const sections = menuSections(selection(), run, false)
    expect(item(sections, 'Arrange')?.submenu?.map((action) => action.label)).toEqual(['Bring to front', 'Bring forward', 'Send backward', 'Send to back'])
    item(sections, 'Bring forward')?.onClick?.()
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
