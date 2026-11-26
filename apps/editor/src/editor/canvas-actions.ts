/*
 * What the quick-actions toolbar and the right-click menu offer, worked out
 * from the selection. Both run the same editor commands as the keyboard
 * shortcuts and the properties panel, so every action is one undo step.
 *
 * To give a kind of object its own actions (arrows, text, graphs, tables),
 * add an entry to `kindQuickActions` or `kindMenuSections`.
 */
import type { MenuAction, MenuSection } from '@biofigure-lab/ui/components/menu/Menu'
import type { QuickAction, QuickActionGroup, QuickButtonAction } from '@biofigure-lab/ui/components/quick-actions/QuickActions'
import { StyleSwatch } from '@biofigure-lab/ui/components/quick-actions/StyleSwatch'
import { ArrowEnds, ChartPencil, ColumnLeft, ColumnRight, DeleteColumn, DeleteRow, FrameCard, RowAbove, RowBelow, TableColumn, TableRow } from '@biofigure-lab/ui/lib/quick-action-icons'
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
  ArrowLeftRight,
  ArrowRight,
  Plus,
  Unlink,
  createLucideIcon,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpToLine,
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
  Layers,
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
import type { ReactNode } from 'react'

import type { AlignEdge } from './arrange'
import { canAddStep, familyOf } from './process-looks'
import type { FigureCanvas, SelectionInfo } from './FigureCanvas'

/** The editor commands the actions run. */
export type Commands = Pick<
  FigureCanvas,
  'cut' | 'copy' | 'paste' | 'reverseArrows' | 'duplicate' | 'deleteSelection' | 'arrange' | 'group' | 'ungroup' | 'toggleLock' | 'align' | 'distribute' | 'selectAll' | 'change' | 'changeText' | 'tableCommand'
>

type Kind = SelectionInfo['kind']

/** The widgets bar buttons open (BIO-82); drawn by the screen (quick-widgets.tsx). */
export type WidgetKind = 'frame' | 'frame-style' | 'style' | 'arrow-style' | 'ends' | 'row' | 'column'

/** A bar button that opens a widget, if the screen can draw widgets. */
function widgetAction(options: QuickActionOptions, kind: WidgetKind, label: string, icon: QuickButtonAction['icon'], extra: Partial<QuickButtonAction> = {}): QuickAction[] {
  const draw = options.widget
  if (!draw) return []
  return [{ id: kind, label, icon, ...extra, widget: { title: label, content: (close) => draw(kind, close) } }]
}

/** What the bar needs from the screen around it. */
export type QuickActionOptions = {
  /** Opens the ⋯ menu (the right-click menu) next to the button. */
  onMore: (button: HTMLElement) => void
  /** Draws a bar button's widget (Frame, Style, Ends, Row, Column) for the current selection; `close` shuts it. */
  widget?: (kind: WidgetKind, close: () => void) => ReactNode
  /** Opens the chart's data card. */
  onEditData?: () => void
  /** Phones have no Delete key or Ctrl+D, so the bar keeps Duplicate and Delete there. */
  phone?: boolean
  /** Sequence blocks (BIO-75); the screen runs them, Make a row and Detach with an Undo toast. */
  sequences?: SequenceActions
}

export type SequenceActions = {
  makeRow: () => void
  addStep: () => void
  setDirection: (direction: 'across' | 'down') => void
  detach: () => void
  /** Experiment timelines (BIO-96). */
  addEvent: () => void
  detachTimeline: () => void
  /** A comparison's two sides trade places (BIO-95). */
  swapSides: () => void
}

/** Three boxes in a row: Make a row. */
const RowOfThree = createLucideIcon('row-of-three', [
  ['rect', { x: '2', y: '8', width: '5', height: '8', rx: '1', key: 'a' }],
  ['rect', { x: '9.5', y: '8', width: '5', height: '8', rx: '1', key: 'b' }],
  ['rect', { x: '17', y: '8', width: '5', height: '8', rx: '1', key: 'c' }],
])

/**
 * The one or two actions a kind of object gets in the bar, before Lock
 * (BIO-82, owner's review 2026-11-25): what people reach for on the canvas
 * and can't do as quickly elsewhere. Colours, text styles, layer order and
 * align live in the side panel, the ⋯ menu and the top bar instead.
 */
const kindQuickActions: Partial<Record<Kind, (selection: SelectionInfo, commands: Commands, options: QuickActionOptions) => QuickAction[]>> = {
  // Swapping the heads is one click here; Ends picks either head without the side panel.
  line: (selection, commands, options) => {
    const look = selection.arrowLook
    if (!look) return []
    return [
      ...(look.start !== look.end ? [{ id: 'reverse', label: 'Reverse', icon: ArrowLeftRight, onClick: () => commands.reverseArrows() }] : []),
      ...widgetAction(options, 'ends', 'Ends', ArrowEnds),
      // Its colour and outline, custom or from a preset (BIO-91, as a shape's Style).
      ...widgetAction(options, 'arrow-style', 'Style', StyleSwatch),
    ]
  },
  shape: (_, __, options) => widgetAction(options, 'style', 'Style', StyleSwatch),
  // Several objects: Group, and Row lines them up as a sequence with arrows (BIO-75, the owner's pick: one click).
  multiple: (selection, commands, options) => {
    const sequences = options.sequences
    return [
      { id: 'group', label: 'Group', icon: Group, shortcut: 'Mod+G', onClick: () => commands.group() },
      ...(sequences && selection.canMakeRow ? [{ id: 'row', label: 'Row', icon: RowOfThree, onClick: () => sequences.makeRow() }] : []),
    ]
  },
  // A sequence: add a step at the end, turn it across or down, or take it apart.
  sequence: (selection, _, options) => {
    const sequences = options.sequences
    if (!sequences) return []
    // A graphical abstract (BIO-107): it only comes apart.
    if (selection.abstract) return [{ id: 'detach', label: 'Detach', icon: Unlink, onClick: () => sequences.detach() }]
    // A comparison (BIO-95): its sides trade places, or it comes apart.
    if (selection.comparison)
      return [
        { id: 'swap-sides', label: 'Swap sides', icon: ArrowLeftRight, onClick: () => sequences.swapSides() },
        { id: 'detach', label: 'Detach', icon: Unlink, onClick: () => sequences.detach() },
      ]
    const across = selection.sequence?.direction !== 'down'
    // A cycle or branching (BIO-96) has no direction; branching adds arms, up to five.
    const family = familyOf(selection.sequence?.look ?? 'arrows')
    const steps = selection.sequence?.steps ?? 0
    return [
      ...(canAddStep(family, steps) ? [{ id: 'add-step', label: family === 'branch' ? 'Add arm' : 'Add step', icon: Plus, onClick: () => sequences.addStep() }] : []),
      // A pathway (BIO-105) always runs down.
      ...(family === 'sequence' && !selection.pathway ? [{ id: 'direction', label: across ? 'Across' : 'Down', icon: across ? ArrowRight : ArrowDown, onClick: () => sequences.setDirection(across ? 'down' : 'across') }] : []),
      { id: 'detach', label: 'Detach', icon: Unlink, onClick: () => sequences.detach() },
    ]
  },
  // An experiment timeline (BIO-96): add an event after the last, or take it apart.
  timeline: (_, __, options) => {
    const sequences = options.sequences
    if (!sequences) return []
    return [
      { id: 'add-event', label: 'Add event', icon: Plus, onClick: () => sequences.addEvent() },
      { id: 'detach', label: 'Detach', icon: Unlink, onClick: () => sequences.detachTimeline() },
    ]
  },
  group: (_, commands) => [{ id: 'ungroup', label: 'Ungroup', icon: Ungroup, shortcut: 'Mod+Shift+G', onClick: () => commands.ungroup() }],
  // One icon: Frame opens No frame and the five styles (the owner's pick 1B); once framed, Style opens the frame's presets.
  icon: (selection, _, options) =>
    selection.frame === undefined
      ? []
      : [
          ...widgetAction(options, 'frame', 'Frame', FrameCard, { pressed: selection.frame !== null }),
          ...(selection.frame ? widgetAction(options, 'frame-style', 'Style', StyleSwatch) : []),
        ],
  chart: (_, __, options) => {
    const onEditData = options.onEditData
    return onEditData ? [{ id: 'edit-data', label: 'Edit data', icon: ChartPencil, onClick: () => onEditData() }] : []
  },
  table: (selection, commands, options) => {
    // Without picked cells, rows and columns are added at the end of the table in one click;
    // with cells picked, Row and Column open what can happen next to them (the owner's pick 5D).
    if (!selection.table?.picked) {
      return [
        { id: 'row-below', label: 'Add row', icon: RowBelow, onClick: () => commands.tableCommand('row-below') },
        { id: 'col-right', label: 'Add column', icon: ColumnRight, onClick: () => commands.tableCommand('col-right') },
      ]
    }
    return [...widgetAction(options, 'row', 'Row', TableRow), ...widgetAction(options, 'column', 'Column', TableColumn)]
  },
}

/** Extra right-click sections for one kind of object, shown before Delete. */
const kindMenuSections: Partial<Record<Kind, (selection: SelectionInfo, commands: Commands) => MenuSection[]>> = {
  table: (selection, commands) => {
    // Without picked cells, rows and columns come and go at the end of the table.
    const which = selection.table?.picked ? '' : ' (last)'
    const canUnmerge = selection.table?.canUnmerge && !selection.table.canMerge
    return [
      {
        label: 'Rows and columns',
        showLabel: true,
        actions: [
          { label: 'Add row above', icon: RowAbove, onClick: () => commands.tableCommand('row-above') },
          { label: 'Add row below', icon: RowBelow, onClick: () => commands.tableCommand('row-below') },
          { label: 'Add column left', icon: ColumnLeft, onClick: () => commands.tableCommand('col-left') },
          { label: 'Add column right', icon: ColumnRight, onClick: () => commands.tableCommand('col-right') },
          { label: `Delete row${which}`, icon: DeleteRow, onClick: () => commands.tableCommand('delete-rows') },
          { label: `Delete column${which}`, icon: DeleteColumn, onClick: () => commands.tableCommand('delete-cols') },
          { label: 'Make columns even', icon: Columns3, onClick: () => commands.tableCommand('even-cols') },
          { label: 'Make rows even', icon: Rows3, onClick: () => commands.tableCommand('even-rows') },
        ],
      },
      {
        label: 'Cells',
        showLabel: true,
        actions: canUnmerge
          ? [{ label: 'Unmerge cells', icon: TableCellsSplit, onClick: () => commands.tableCommand('unmerge') }]
          : [{ label: 'Merge cells', icon: TableCellsMerge, disabled: !selection.table?.canMerge, onClick: () => commands.tableCommand('merge') }],
      },
    ]
  },
}

/**
 * Highlighted characters while typing get a small bar of their own that
 * styles just those: bold, italic, sub- and superscript, underline,
 * strikethrough and colour.
 */
function textRangeQuickActions(selection: SelectionInfo, commands: Commands): QuickActionGroup[] {
  const text = selection.text
  if (!text) return []
  const script = (pressed: 'sub' | 'super') => void commands.changeText({ script: text.script === pressed ? 'none' : pressed })
  return [
    {
      id: 'style',
      actions: [
        { id: 'bold', label: 'Bold', icon: Bold, shortcut: 'Mod+B', pressed: text.bold, onClick: () => void commands.changeText({ bold: !text.bold }) },
        { id: 'italic', label: 'Italic', icon: Italic, shortcut: 'Mod+I', pressed: text.italic, onClick: () => void commands.changeText({ italic: !text.italic }) },
        { id: 'subscript', label: 'Subscript', icon: Subscript, shortcut: 'Mod+=', pressed: text.script === 'sub', onClick: () => script('sub') },
        { id: 'superscript', label: 'Superscript', icon: Superscript, shortcut: 'Mod+Shift+=', pressed: text.script === 'super', onClick: () => script('super') },
        { id: 'underline', label: 'Underline', icon: Underline, shortcut: 'Mod+U', pressed: text.underline, onClick: () => void commands.changeText({ underline: !text.underline }) },
        { id: 'strikethrough', label: 'Strikethrough', icon: Strikethrough, pressed: text.strikethrough, onClick: () => void commands.changeText({ strikethrough: !text.strikethrough }) },
      ],
    },
    { id: 'colour', actions: [{ id: 'colour', label: 'Colour', swatch: 'fill', colour: text.colour, onColour: (colour) => void commands.changeText({ colour }) }] },
  ]
}

/**
 * The bar above the selection, the same layout for every kind (BIO-82):
 * the kind's own actions, then Lock, then ⋯. A locked object gets only
 * Unlock and ⋯; phones also keep Duplicate and Delete.
 */
export function quickActionGroups(selection: SelectionInfo, commands: Commands, options: QuickActionOptions): QuickActionGroup[] {
  if (selection.textRange) return textRangeQuickActions(selection, commands)
  const more: QuickActionGroup = { id: 'more', actions: [{ id: 'more', label: 'More actions', icon: MoreHorizontal, onClick: options.onMore }] }
  const lock: QuickActionGroup = { id: 'lock', actions: [lockAction(selection, commands)] }
  if (selection.locked) return [lock, more]
  const groups: QuickActionGroup[] = []
  const own = kindQuickActions[selection.kind]?.(selection, commands, options) ?? []
  if (own.length > 0) groups.push({ id: 'kind', actions: own })
  if (options.phone) {
    groups.push({
      id: 'edit',
      actions: [
        { id: 'duplicate', label: 'Duplicate', icon: CopyPlus, shortcut: 'Mod+D', onClick: () => void commands.duplicate() },
        { id: 'delete', label: 'Delete', icon: Trash2, shortcut: 'Delete', danger: true, onClick: () => commands.deleteSelection() },
      ],
    })
  }
  groups.push(lock, more)
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

/**
 * The right-click menu, which the bar's ⋯ opens too: for the selection, or
 * Paste and Select all on empty page. Align is in the top bar and Lock in
 * the quick-actions bar, so neither is repeated here (BIO-82).
 */
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
      actions: [
        {
          // One row that opens the four layer moves on hover, so they don't fill the menu (BIO-82).
          label: 'Arrange',
          icon: Layers,
          submenu: [
            { label: 'Bring to front', icon: ArrowUpToLine, shortcut: 'Mod+]', onClick: () => commands.arrange('front') },
            { label: 'Bring forward', icon: ArrowUp, shortcut: 'Mod+Shift+]', onClick: () => commands.arrange('forward') },
            { label: 'Send backward', icon: ArrowDown, shortcut: 'Mod+Shift+[', onClick: () => commands.arrange('backward') },
            { label: 'Send to back', icon: ArrowDownToLine, shortcut: 'Mod+[', onClick: () => commands.arrange('back') },
          ],
        },
      ],
    },
    ...(selection.count > 1 || selection.hasGroup
      ? [
          {
            label: 'Group',
            showLabel: true,
            actions: [
              ...(selection.count > 1 ? [{ label: 'Group', icon: Group, shortcut: 'Mod+G', onClick: () => commands.group() }] : []),
              ...(selection.hasGroup ? [{ label: 'Ungroup', icon: Ungroup, shortcut: 'Mod+Shift+G', onClick: () => commands.ungroup() }] : []),
            ],
          },
        ]
      : []),
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
