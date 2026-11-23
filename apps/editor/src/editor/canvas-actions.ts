/*
 * What the quick-actions toolbar and the right-click menu offer, worked out
 * from the selection. Both run the same editor commands as the keyboard
 * shortcuts and the properties panel, so every action is one undo step.
 *
 * To give a kind of object its own actions (arrows, text, graphs, tables),
 * add an entry to `kindQuickActions` or `kindMenuSections`.
 */
import type { MenuAction, MenuSection } from '@biofigure-lab/ui/components/menu/Menu'
import type { QuickAction, QuickActionGroup } from '@biofigure-lab/ui/components/quick-actions/QuickActions'
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalSpaceAround,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalSpaceAround,
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpToLine,
  BetweenHorizontalEnd,
  BetweenHorizontalStart,
  BetweenVerticalEnd,
  BetweenVerticalStart,
  Columns3,
  Rows3,
  TableCellsMerge,
  TableCellsSplit,
  Bold,
  BoxSelect,
  ClipboardPaste,
  Copy,
  CopyPlus,
  Group,
  Italic,
  Strikethrough,
  Underline,
  Lock,
  LockOpen,
  MoreHorizontal,
  Scissors,
  Subscript,
  Superscript,
  Trash2,
  Ungroup,
} from 'lucide-react'

import type { AlignEdge } from './arrange'
import type { FigureCanvas, SelectionInfo } from './FigureCanvas'

/** The editor commands the actions run. */
export type Commands = Pick<
  FigureCanvas,
  'cut' | 'copy' | 'paste' | 'duplicate' | 'deleteSelection' | 'arrange' | 'group' | 'ungroup' | 'toggleLock' | 'align' | 'distribute' | 'selectAll' | 'change' | 'changeText' | 'tableCommand'
>

type Kind = SelectionInfo['kind']

/** Extra quick actions for one kind of object, shown after the colours. */
const kindQuickActions: Partial<Record<Kind, (selection: SelectionInfo, commands: Commands) => QuickAction[]>> = {
  multiple: (_, commands) => [{ id: 'group', label: 'Group', icon: Group, shortcut: 'Mod+G', onClick: () => commands.group() }],
  group: (_, commands) => [{ id: 'ungroup', label: 'Ungroup', icon: Ungroup, shortcut: 'Mod+Shift+G', onClick: () => commands.ungroup() }],
  table: (selection, commands) => [
    { id: 'row-below', label: 'Add row below', icon: BetweenHorizontalEnd, onClick: () => commands.tableCommand('row-below') },
    { id: 'col-right', label: 'Add column right', icon: BetweenVerticalEnd, onClick: () => commands.tableCommand('col-right') },
    selection.table?.canUnmerge && !selection.table.canMerge
      ? { id: 'unmerge', label: 'Unmerge cells', icon: TableCellsSplit, onClick: () => commands.tableCommand('unmerge') }
      : { id: 'merge', label: 'Merge cells', icon: TableCellsMerge, disabled: !selection.table?.canMerge, onClick: () => commands.tableCommand('merge') },
  ],
}

/** Extra right-click sections for one kind of object, shown before Delete. */
const kindMenuSections: Partial<Record<Kind, (selection: SelectionInfo, commands: Commands) => MenuSection[]>> = {
  table: (selection, commands) => {
    // Without picked cells, rows and columns come and go at the end of the table.
    const which = selection.table?.picked ? '' : ' (last)'
    return [
      {
        label: 'Rows and columns',
        showLabel: true,
        actions: [
          { label: 'Add row above', icon: BetweenHorizontalStart, onClick: () => commands.tableCommand('row-above') },
          { label: 'Add row below', icon: BetweenHorizontalEnd, onClick: () => commands.tableCommand('row-below') },
          { label: 'Add column left', icon: BetweenVerticalStart, onClick: () => commands.tableCommand('col-left') },
          { label: 'Add column right', icon: BetweenVerticalEnd, onClick: () => commands.tableCommand('col-right') },
          { label: `Delete row${which}`, icon: Rows3, onClick: () => commands.tableCommand('delete-rows') },
          { label: `Delete column${which}`, icon: Columns3, onClick: () => commands.tableCommand('delete-cols') },
          { label: 'Make columns even', icon: Columns3, onClick: () => commands.tableCommand('even-cols') },
          { label: 'Make rows even', icon: Rows3, onClick: () => commands.tableCommand('even-rows') },
        ],
      },
      {
        label: 'Cells',
        showLabel: true,
        actions: [
          { label: 'Merge cells', icon: TableCellsMerge, disabled: !selection.table?.canMerge, onClick: () => commands.tableCommand('merge') },
          { label: 'Unmerge cells', icon: TableCellsSplit, disabled: !selection.table?.canUnmerge, onClick: () => commands.tableCommand('unmerge') },
        ],
      },
    ]
  },
}

/** Fill and line colour, as far as the kind of object has them. */
function colourActions(selection: SelectionInfo, commands: Commands): QuickAction[] {
  const actions: QuickAction[] = []
  // A chart has a colour per group, set in the properties panel.
  if (selection.kind === 'chart') return actions
  if (selection.kind !== 'line') {
    const label = selection.kind === 'text' || selection.kind === 'icon' ? 'Colour' : selection.kind === 'table' ? 'Cell fill' : 'Fill'
    actions.push({ id: 'fill', label, swatch: 'fill', colour: selection.fill, onColour: (fill) => commands.change({ fill }) })
  }
  if (selection.kind !== 'text' && selection.kind !== 'icon') {
    actions.push({ id: 'stroke', label: 'Line colour', swatch: 'line', colour: selection.stroke, onColour: (stroke) => commands.change({ stroke }) })
  }
  return actions
}

/**
 * Text gets a short bar of its own (picked design A): bold, italic, sub- and
 * superscript, its colour and More. The rest is in the Text panel. With
 * characters selected while typing, the bar styles just those and swaps More
 * for underline and strikethrough.
 */
function textQuickActions(selection: SelectionInfo, commands: Commands, onMore: (button: HTMLElement) => void): QuickActionGroup[] {
  const text = selection.text
  if (!text) return []
  const script = (pressed: 'sub' | 'super') => void commands.changeText({ script: text.script === pressed ? 'none' : pressed })
  const lines: QuickAction[] = [
    { id: 'underline', label: 'Underline', icon: Underline, shortcut: 'Mod+U', pressed: text.underline, onClick: () => void commands.changeText({ underline: !text.underline }) },
    { id: 'strikethrough', label: 'Strikethrough', icon: Strikethrough, pressed: text.strikethrough, onClick: () => void commands.changeText({ strikethrough: !text.strikethrough }) },
  ]
  return [
    {
      id: 'style',
      actions: [
        { id: 'bold', label: 'Bold', icon: Bold, shortcut: 'Mod+B', pressed: text.bold, onClick: () => void commands.changeText({ bold: !text.bold }) },
        { id: 'italic', label: 'Italic', icon: Italic, shortcut: 'Mod+I', pressed: text.italic, onClick: () => void commands.changeText({ italic: !text.italic }) },
        { id: 'subscript', label: 'Subscript', icon: Subscript, shortcut: 'Mod+=', pressed: text.script === 'sub', onClick: () => script('sub') },
        { id: 'superscript', label: 'Superscript', icon: Superscript, shortcut: 'Mod+Shift+=', pressed: text.script === 'super', onClick: () => script('super') },
        ...(selection.textRange ? lines : []),
      ],
    },
    {
      id: 'more',
      actions: [
        { id: 'colour', label: 'Colour', swatch: 'fill', colour: text.colour, onColour: (colour) => void commands.changeText({ colour }) },
        ...(selection.textRange ? [] : [{ id: 'more', label: 'More actions', icon: MoreHorizontal, onClick: onMore }]),
      ],
    },
  ]
}

export function quickActionGroups(selection: SelectionInfo, commands: Commands, onMore: (button: HTMLElement) => void): QuickActionGroup[] {
  // Typing in a shape gives the text's actions too.
  if (selection.kind === 'text' || selection.text) return textQuickActions(selection, commands, onMore)
  const colours = colourActions(selection, commands)
  const groups: QuickActionGroup[] = []
  if (colours.length > 0) groups.push({ id: 'colour', actions: colours })
  groups.push({
    id: 'edit',
    actions: [
      ...(kindQuickActions[selection.kind]?.(selection, commands) ?? []),
      { id: 'duplicate', label: 'Duplicate', icon: CopyPlus, shortcut: 'Mod+D', onClick: () => void commands.duplicate() },
      lockAction(selection, commands),
      { id: 'delete', label: 'Delete', icon: Trash2, shortcut: 'Delete', danger: true, onClick: () => commands.deleteSelection() },
    ],
  })
  groups.push({ id: 'more', actions: [{ id: 'more', label: 'More actions', icon: MoreHorizontal, onClick: onMore }] })
  return groups
}

function lockAction(selection: SelectionInfo, commands: Commands): QuickAction {
  return {
    id: 'lock',
    label: selection.locked ? 'Unlock' : 'Lock',
    icon: selection.locked ? LockOpen : Lock,
    shortcut: 'Mod+Shift+L',
    pressed: selection.locked,
    onClick: () => commands.toggleLock(),
  }
}

export const alignActions: { edge: AlignEdge; label: string; icon: typeof Lock }[] = [
  { edge: 'left', label: 'Align left', icon: AlignStartVertical },
  { edge: 'centre', label: 'Align centre', icon: AlignCenterVertical },
  { edge: 'right', label: 'Align right', icon: AlignEndVertical },
  { edge: 'top', label: 'Align top', icon: AlignStartHorizontal },
  { edge: 'middle', label: 'Align middle', icon: AlignCenterHorizontal },
  { edge: 'bottom', label: 'Align bottom', icon: AlignEndHorizontal },
]

/** The right-click menu: for the selection, or Paste and Select all on empty page. */
export function menuSections(selection: SelectionInfo | null, commands: Commands, canPaste: boolean): MenuSection[] {
  const paste = { label: 'Paste', icon: ClipboardPaste, shortcut: 'Mod+V', disabled: !canPaste, onClick: () => void commands.paste() }
  if (!selection) {
    return [{ label: 'Page', actions: [paste, { label: 'Select all', icon: BoxSelect, shortcut: 'Mod+A', onClick: () => commands.selectAll() }] }]
  }
  return [
    {
      label: 'Edit',
      actions: [
        { label: 'Cut', icon: Scissors, shortcut: 'Mod+X', onClick: () => void commands.cut() },
        { label: 'Copy', icon: Copy, shortcut: 'Mod+C', onClick: () => void commands.copy() },
        paste,
        { label: 'Duplicate', icon: CopyPlus, shortcut: 'Mod+D', onClick: () => void commands.duplicate() },
      ],
    },
    {
      label: 'Arrange',
      showLabel: true,
      actions: [
        { label: 'Bring to front', icon: ArrowUpToLine, shortcut: 'Mod+]', onClick: () => commands.arrange('front') },
        { label: 'Bring forward', icon: ArrowUp, shortcut: 'Mod+Shift+]', onClick: () => commands.arrange('forward') },
        { label: 'Send backward', icon: ArrowDown, shortcut: 'Mod+Shift+[', onClick: () => commands.arrange('backward') },
        { label: 'Send to back', icon: ArrowDownToLine, shortcut: 'Mod+[', onClick: () => commands.arrange('back') },
      ],
    },
    {
      label: 'Group',
      showLabel: true,
      actions: [
        { label: 'Group', icon: Group, shortcut: 'Mod+G', disabled: selection.count < 2, onClick: () => commands.group() },
        { label: 'Ungroup', icon: Ungroup, shortcut: 'Mod+Shift+G', disabled: !selection.hasGroup, onClick: () => commands.ungroup() },
        { label: selection.locked ? 'Unlock' : 'Lock', icon: selection.locked ? LockOpen : Lock, shortcut: 'Mod+Shift+L', onClick: () => commands.toggleLock() },
      ],
    },
    {
      label: selection.count > 1 ? 'Align' : 'Align to page',
      showLabel: true,
      layout: 'icons',
      actions: alignActions.map(({ edge, label, icon }) => ({ label, icon, onClick: () => commands.align(edge) })),
    },
    ...(kindMenuSections[selection.kind]?.(selection, commands) ?? []),
    { label: 'Remove', actions: [{ label: 'Delete', icon: Trash2, shortcut: 'Delete', danger: true, onClick: () => commands.deleteSelection() }] },
  ]
}

/**
 * The top bar's align buttons, in order: left, centre, right, top, middle,
 * bottom, then distribute across and down (three or more objects). The ⋯
 * menu next to them shows all of them as tiles.
 */
export function alignBarActions(selection: SelectionInfo, commands: Commands): MenuAction[] {
  // One object lines up with the page; several line up with each other.
  const toPage = selection.count === 1 ? ' to page' : ''
  return [
    ...alignActions.map(({ edge, label, icon }) => ({ label: label + toPage, icon, onClick: () => commands.align(edge) })),
    { label: 'Distribute horizontally', icon: AlignHorizontalSpaceAround, disabled: selection.count < 3, onClick: () => commands.distribute('horizontal') },
    { label: 'Distribute vertically', icon: AlignVerticalSpaceAround, disabled: selection.count < 3, onClick: () => commands.distribute('vertical') },
  ]
}
