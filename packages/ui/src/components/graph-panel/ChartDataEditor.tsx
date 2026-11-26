/*
 * Chart data editor: the numbers behind the selected chart, in the drawer
 * under the page. Two views of the same data, switched at the top:
 * - Table: a spreadsheet grid, one column per group, one row per replicate.
 * - Groups: one card per group with its colour, values side by side.
 * Typing changes the chart right away. Pasting a block from Excel or Google
 * Sheets fills the cells from the one pasted into, growing the table.
 * Groups change places by dragging their grip (or Alt+arrow keys in a group's
 * name), which also changes their order on the chart.
 *
 * In a phone's sheet (`ExpandedControls`) the sheet names it, so there is no
 * heading, and the Groups view shows the groups as columns side by side (see
 * `GroupColumns`).
 */
import { ChartColumn, ChartLine, ChevronUp, GripVertical, Maximize2, Minimize2, Pencil, Plus, Trash2, X } from 'lucide-react'
import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type CSSProperties,
  type DragEvent,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from 'react'

import { cn } from '../../lib/cn'
import { useExpandedControls } from '../../lib/expanded-controls'
import { IconButton } from '../icon-button/IconButton'
import { Tabs } from '../tabs/Tabs'

export type DataView = 'table' | 'groups'
export type DataGroup = { name: string; values: (number | null)[] }
export type DataLine = {
  /** The bars' and the line's measures, as headings over their tables. */
  barsTitle: string
  title: string
  /** One list per group, in the groups' order. */
  values: (number | null)[][]
  onValue: (group: number, row: number, text: string) => void
  /** A block pasted into a cell of the line's table. */
  onPaste: (text: string, at: { group: number; row: number }) => void
  onAddRow: () => void
}

export type ChartDataEditorProps = {
  groups: DataGroup[]
  colours: string[]
  view: DataView
  onViewChange: (view: DataView) => void
  /** A value typed into a cell (the text as typed; empty clears it). */
  onValue: (group: number, row: number, text: string) => void
  onRename: (group: number, name: string) => void
  /** A block pasted into a cell; `row` -1 is the names row. */
  onPaste: (text: string, at: { group: number; row: number }) => void
  onAddGroup: () => void
  onRemoveGroup: (group: number) => void
  /** A group dragged to another place: it lands before the group now at `to`. */
  onMoveGroup: (from: number, to: number) => void
  onAddRow: () => void
  /**
   * Heatmaps: each row's name, typed in the table's first column instead of its number (a missing name is empty).
   * A block pasted into that column has its names in its first column (`group` -1).
   */
  rowNames?: string[]
  onRenameRow?: (row: number, name: string) => void
  /**
   * Bar + line charts: the line's values for each group (its second measure), shown as a second table, "Line", under
   * the bars' one, and under each group's values in the Groups view. `title` names the two parts' headings.
   */
  line?: DataLine
  /** Phones: takes a row out of every group. */
  onRemoveRow?: (row: number) => void
  /** Minimised: only the header bar shows. One button minimises (×) and opens it again (↑). Without `onCollapsedChange` there is no such button. */
  collapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
  /** Closes the card (×). Takes the place of the minimise button when given. */
  onClose?: () => void
  /** Full screen: the card is shown over the whole canvas area (the app lays it out). Without `onFullScreenChange` there is no button, as on a phone. Escape inside the card leaves it. */
  fullScreen?: boolean
  onFullScreenChange?: (on: boolean) => void
  /** Shown in a card in the bottom-right corner while in full screen (the app passes a live picture of the chart). */
  preview?: ReactNode
  className?: string
  style?: CSSProperties
}

const show = (value: number | null | undefined) => (value === null || value === undefined ? '' : String(value))

/** One editable cell. It keeps what's being typed ("1." or "-") until it loses focus. */
function Cell({ value, label, onCommit, onPaste, onMove, className }: { value: string; label: string; onCommit: (text: string) => void; onPaste?: (text: string) => void; onMove?: (step: number) => void; className?: string }) {
  const [text, setText] = useState(value)
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    if (!focused) setText(value)
  }, [value, focused])
  const paste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData('text/plain')
    // A single value is typed in as usual; a block goes to the editor.
    if (!onPaste || !/[\t\n]/.test(pasted.trim())) return
    event.preventDefault()
    onPaste(pasted)
  }
  const keys = (event: KeyboardEvent<HTMLInputElement>) => {
    if (onMove && event.altKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      event.preventDefault()
      onMove(event.key === 'ArrowLeft' ? -1 : 1)
      return
    }
    const moves: Record<string, [number, number]> = { Enter: [1, 0], ArrowDown: [1, 0], ArrowUp: [-1, 0] }
    const move = moves[event.key]
    if (!move) return
    const cell = event.currentTarget.closest<HTMLElement>('[data-cell]')
    const [r = 0, c = 0] = (cell?.dataset.cell ?? '').split(',').map(Number)
    const next = cell?.closest('[data-grid]')?.querySelector<HTMLInputElement>(`[data-cell="${r + move[0]},${c}"] input`)
    if (!next) return
    event.preventDefault()
    next.focus()
    next.select()
  }
  return (
    <input
      aria-label={label}
      value={text}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(event) => {
        setText(event.target.value)
        onCommit(event.target.value)
      }}
      onPaste={paste}
      onKeyDown={keys}
      className={cn('w-full min-w-0 bg-transparent px-1.5 py-1 outline-none focus:bg-primary-subtle', className)}
    />
  )
}

export function ChartDataEditor(props: ChartDataEditorProps) {
  const { view, onViewChange, onAddGroup, collapsed = false, onCollapsedChange, onClose, fullScreen = false, onFullScreenChange, preview, className, style } = props
  const expanded = useExpandedControls()
  return (
    <section aria-label="Chart data" className={cn('flex min-h-0 flex-col bg-panel text-sm text-foreground', className)} style={style}
      onKeyDown={(event) => {
        if (fullScreen && event.key === 'Escape' && onFullScreenChange) {
          event.stopPropagation()
          onFullScreenChange(false)
        }
      }}
    >
      {/* Phones: the view switch starts where the first column of values does, past the row numbers. */}
      <div className={cn('flex h-10 shrink-0 items-center gap-3', expanded ? (view === 'groups' ? 'h-11 pl-[3.25rem]' : 'h-11 pl-8') : 'px-3', !collapsed && !expanded && 'border-b')}>
        {!expanded && <h2 className="font-medium">Data</h2>}
        <Tabs
          variant="segmented"
          label="Data view"
          value={view}
          onValueChange={(value) => onViewChange(value as DataView)}
          tabs={[
            { value: 'table', label: 'Table' },
            { value: 'groups', label: 'Groups' },
          ]}
        />
        <div className="ml-auto flex items-center gap-1">
          {expanded ? (
            <button type="button" onClick={onAddGroup} className="flex h-11 items-center gap-1.5 rounded-md px-3 text-sm ring-1 ring-border ring-inset hover:bg-accent">
              <Plus className="size-4" aria-hidden="true" /> Group
            </button>
          ) : (
            <IconButton icon={Plus} label="Add group" size="sm" onClick={onAddGroup} />
          )}
          {onFullScreenChange && <IconButton icon={fullScreen ? Minimize2 : Maximize2} label={fullScreen ? 'Exit full screen' : 'Full screen'} size="sm" onClick={() => onFullScreenChange(!fullScreen)} />}
          {onClose ? (
            <IconButton icon={X} label="Close the data" size="sm" onClick={onClose} />
          ) : onCollapsedChange && <IconButton icon={collapsed ? ChevronUp : X} label={collapsed ? 'Show the data' : 'Minimise the data'} size="sm" aria-expanded={!collapsed} onClick={() => onCollapsedChange(!collapsed)} />}
        </div>
      </div>
      {!collapsed && (
        <Body {...props} expanded={expanded} showPreview={fullScreen && !!preview && !expanded} />
      )}
    </section>
  )
}

/** Rows drawn at least, when the box can't be measured yet (or is short), and extra rows kept above and below the view. */
const WINDOW_MIN = 30
const WINDOW_EXTRA = 10
/** Fixed row heights, in px, so a long data set only draws the rows in view: a table row, and a row of four values in a group card (with its gap). */
const TABLE_ROW = 28
const CARD_ROW = 32

/**
 * Which rows of a long list to draw. The rows have a fixed height; `grid` is
 * the element their first row starts at, inside a scrolling box marked
 * `data-scroll`. Rows outside the view (plus a few spare ones) aren't drawn,
 * the space they'd take is kept by the caller, so switching views or typing
 * stays quick with hundreds of rows. A short list is drawn whole.
 */
function useRowWindow(rows: number, rowHeight: number, grid: RefObject<HTMLElement | null>, least = WINDOW_MIN) {
  const [range, setRange] = useState({ start: 0, end: least })
  useEffect(() => {
    const element = grid.current
    const box = element?.closest<HTMLElement>('[data-scroll]')
    if (!element || !box) return
    let frame = 0
    const measure = () => {
      frame = 0
      const top = element.getBoundingClientRect().top - box.getBoundingClientRect().top
      const height = box.clientHeight || least * rowHeight
      const first = Math.floor(-top / rowHeight)
      const last = Math.ceil((height - top) / rowHeight)
      const start = Math.max(0, first - WINDOW_EXTRA)
      const end = Math.min(rows, Math.max(last + WINDOW_EXTRA, start + least))
      setRange((now) => (now.start === start && now.end === end ? now : { start, end }))
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }
    measure()
    box.addEventListener('scroll', schedule, { passive: true })
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(schedule)
    observer?.observe(box)
    return () => {
      box.removeEventListener('scroll', schedule)
      observer?.disconnect()
      if (frame) cancelAnimationFrame(frame)
    }
  }, [grid, rows, rowHeight, least])
  const end = Math.min(range.end, rows)
  return { start: Math.min(range.start, end), end }
}

/** The corner card's width limits: at least this many px, at most this share of the data card's width. */
const PREVIEW_MIN = 240
const PREVIEW_MAX_SHARE = 0.8

type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

/** Where each corner puts the card (12 px in from the edges). */
const CORNER_CLASS: Record<Corner, string> = {
  'top-left': 'top-3 left-3',
  'top-right': 'top-3 right-3',
  'bottom-left': 'bottom-3 left-3',
  'bottom-right': 'bottom-3 right-3',
}

/** The corner mark (two short diagonal lines, like a text box's) is drawn for a bottom-right corner and flipped for the others. */
const GRIP_FLIP: Record<Corner, string> = {
  'bottom-right': '',
  'bottom-left': 'scaleX(-1)',
  'top-right': 'scaleY(-1)',
  'top-left': 'scale(-1, -1)',
}

const opposite = (corner: Corner): Corner => `${corner.startsWith('top') ? 'bottom' : 'top'}-${corner.endsWith('left') ? 'right' : 'left'}` as Corner

/**
 * The data, and in full screen the chart's preview as a card in a corner of the data card, over the data. It starts
 * bottom right, 360 px wide (`--data-preview-width`), its height following the chart. Drag the card to move it: it
 * follows the pointer, and on letting go settles, with a little spring, into the nearest corner. Its resize mark sits
 * on the corner facing the middle; dragging it makes the card larger or smaller, growing away from its corner. The
 * card can be folded away to a small button. Corner and size are kept while the data card is open, not saved.
 * At a bottom corner the data keeps room under the card, so every row can be scrolled clear of it; at a top corner
 * the card floats over the table and nothing moves.
 */
function Body(props: ChartDataEditorProps & { expanded: boolean; showPreview: boolean }) {
  const { view, expanded, showPreview, preview } = props
  const [open, setOpen] = useState(true)
  const [corner, setCorner] = useState<Corner>('bottom-right')
  const [width, setWidth] = useState<number | null>(null)
  const [cardHeight, setCardHeight] = useState(0)
  const [offset, setOffset] = useState<{ x: number; y: number } | null>(null)
  const body = useRef<HTMLDivElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const resize = useRef<{ x: number; width: number; max: number } | null>(null)
  const move = useRef<{ x: number; y: number; centre: { x: number; y: number } } | null>(null)
  const settleFrom = useRef<DOMRect | null>(null)
  const top = corner.startsWith('top')
  const left = corner.endsWith('left')
  const gripAt = opposite(corner)

  // How tall the card (or the button it folds into) is, so the data can leave that much room.
  useEffect(() => {
    const element = card.current
    if (!showPreview || !element) return
    const measure = () => setCardHeight(element.getBoundingClientRect().height)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [showPreview, open])

  // After letting go: the card is now at its new corner; start it where it was dropped and let it settle in with a little spring.
  useLayoutEffect(() => {
    const element = card.current
    const from = settleFrom.current
    settleFrom.current = null
    if (!element || !from) return
    const to = element.getBoundingClientRect()
    const calm = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
    element.style.transition = 'none'
    element.style.transform = `translate(${from.left - to.left}px, ${from.top - to.top}px)`
    void element.offsetWidth
    element.style.transition = calm ? 'transform 120ms ease-out' : 'transform 350ms cubic-bezier(0.34, 1.56, 0.64, 1)'
    element.style.transform = ''
  }, [corner])

  // Room to scroll the last rows clear of a card at a bottom corner. A card at a top corner just floats over the table: nothing moves.
  const roomStyle = showPreview && !top ? { paddingBottom: `calc(0.75rem + 0.75rem + ${cardHeight}px)` } : undefined
  const data = (
    <div data-scroll className={cn('min-h-0 min-w-0', expanded ? 'pt-3' : 'h-full overflow-auto p-3', expanded && view === 'table' && 'overflow-auto')} style={roomStyle}>
      {view === 'table' ? <TableView {...props} /> : <GroupsView {...props} />}
    </div>
  )
  if (!showPreview) return <div className="min-h-0 flex-1">{data}</div>

  const capture = (event: ReactPointerEvent<HTMLElement>) => {
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // No pointer to capture (it is already gone); the move and up events still arrive where they can.
    }
  }

  const startResize = (event: ReactPointerEvent<HTMLElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const now = card.current?.getBoundingClientRect().width ?? 0
    const room = body.current?.getBoundingClientRect().width ?? 0
    resize.current = { x: event.clientX, width: now, max: Math.max(PREVIEW_MIN, room * PREVIEW_MAX_SHARE) }
    capture(event)
  }
  const moveResize = (event: ReactPointerEvent<HTMLElement>) => {
    const start = resize.current
    if (!start) return
    // The card grows away from its corner: dragging toward the middle makes it larger.
    const grow = left ? event.clientX - start.x : start.x - event.clientX
    setWidth(Math.round(Math.min(start.max, Math.max(PREVIEW_MIN, start.width + grow))))
  }

  const startMove = (event: ReactPointerEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest('button')) return
    event.preventDefault()
    const rect = card.current?.getBoundingClientRect()
    move.current = { x: event.clientX, y: event.clientY, centre: { x: (rect?.left ?? 0) + (rect?.width ?? 0) / 2, y: (rect?.top ?? 0) + (rect?.height ?? 0) / 2 } }
    capture(event)
  }
  const doMove = (event: ReactPointerEvent<HTMLElement>) => {
    const start = move.current
    if (start) setOffset({ x: event.clientX - start.x, y: event.clientY - start.y })
  }
  const endMove = () => {
    const start = move.current
    move.current = null
    if (!start) return
    const dropped = card.current?.getBoundingClientRect()
    const room = body.current?.getBoundingClientRect()
    const dx = offset?.x ?? 0
    const dy = offset?.y ?? 0
    setOffset(null)
    if (!dropped || !room) return
    const x = start.centre.x + dx
    const y = start.centre.y + dy
    const next = `${y < room.top + room.height / 2 ? 'top' : 'bottom'}-${x < room.left + room.width / 2 ? 'left' : 'right'}` as Corner
    settleFrom.current = dropped
    setCorner(next)
  }

  const gripTop = gripAt.startsWith('top')
  const gripLeft = gripAt.endsWith('left')
  return (
    <div ref={body} className="relative min-h-0 flex-1">
      {data}
      {open ? (
        <div
          ref={card}
          role="group"
          aria-label="Chart preview card"
          data-corner={corner}
          className={cn('absolute flex max-h-[70%] max-w-[80%] touch-none flex-col overflow-hidden rounded-lg border bg-panel shadow-(--elevation-lg) select-none', CORNER_CLASS[corner], offset ? 'cursor-grabbing' : 'cursor-grab')}
          style={{ width: width === null ? 'var(--data-preview-width, 360px)' : `${width}px`, ...(offset ? { transform: `translate(${offset.x}px, ${offset.y}px)`, transition: 'none' } : undefined) }}
          onPointerDown={startMove}
          onPointerMove={doMove}
          onPointerUp={endMove}
          onPointerCancel={endMove}
        >
          <div
            data-resize-grip
            data-grip={gripAt}
            aria-hidden="true"
            title="Drag to resize, double-click to reset"
            className={cn('absolute z-10 grid size-4 place-items-center text-muted-foreground', gripTop ? 'top-0' : 'bottom-0', gripLeft ? 'left-0' : 'right-0', gripAt === 'top-left' || gripAt === 'bottom-right' ? 'cursor-nwse-resize' : 'cursor-nesw-resize')}
            onPointerDown={startResize}
            onPointerMove={moveResize}
            onPointerUp={() => (resize.current = null)}
            onPointerCancel={() => (resize.current = null)}
            onDoubleClick={() => setWidth(null)}
          >
            <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ transform: GRIP_FLIP[gripAt] }}>
              <path d="M11 4 4 11M11 8 8 11" />
            </svg>
          </div>
          <div className={cn('flex h-8 shrink-0 items-center justify-between text-xs font-medium text-muted-foreground', gripTop && gripLeft ? 'pr-1 pl-6' : gripTop ? 'pr-6 pl-3' : 'pr-1 pl-3')}>
            Chart preview
            <IconButton icon={Minimize2} label="Hide the preview" size="sm" onClick={() => setOpen(false)} />
          </div>
          <div className="min-h-0 flex-1">{preview}</div>
        </div>
      ) : (
        <div ref={card} className={cn('absolute rounded-lg border bg-panel shadow-(--elevation-lg)', CORNER_CLASS[corner])}>
          <IconButton icon={ChartColumn} label="Show the preview" size="sm" onClick={() => setOpen(true)} />
        </div>
      )}
    </div>
  )
}

/** A heading over one of a bar + line chart's two tables: what it holds, and its measure's name. */
function PartHeading({ part, title }: { part: string; title: string }) {
  return (
    <h3 className="text-xs font-medium">
      {part}
      {title.trim() && title.trim() !== part && <span className="font-normal text-muted-foreground"> · {title}</span>}
    </h3>
  )
}

/**
 * A bar + line chart's line values: one column per group (named as in the bars' table above, which is where groups are
 * renamed, added and moved), one row per replicate. Short, so it is drawn whole.
 */
function LineTable({ groups, colours, line }: { groups: DataGroup[]; colours: string[]; line: DataLine }) {
  const rows = Math.max(1, ...line.values.map((values) => values.length))
  return (
    <div className="flex flex-col items-start gap-2">
      <PartHeading part="Line" title={line.title} />
      <table data-grid aria-label="Line values" className="border-collapse text-xs tabular-nums">
        <thead>
          <tr>
            <th scope="col" className="w-8 border border-border bg-muted px-1.5 text-right font-normal text-muted-foreground">
              <span className="sr-only">Row</span>
            </th>
            {groups.map((g, c) => (
              <th key={c} scope="col" className="w-32 border border-border bg-muted px-1.5 py-1 text-left font-medium" style={{ boxShadow: `inset 0 3px ${colours[c % colours.length]}` }}>
                <div className="w-32 truncate pl-5">{g.name || `Group ${c + 1}`}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, r) => (
            <tr key={r} style={{ height: TABLE_ROW }}>
              <th scope="row" className="border border-border bg-muted px-1.5 text-right font-normal text-muted-foreground">{r + 1}</th>
              {groups.map((g, c) => (
                <td key={c} className="border border-border p-0" data-cell={`${r},${c}`}>
                  <Cell value={show(line.values[c]?.[r])} label={`Line, ${g.name || `group ${c + 1}`}, row ${r + 1}`} onCommit={(text) => line.onValue(c, r, text)} onPaste={(text) => line.onPaste(text, { group: c, row: r })} className="h-7 text-right" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" onClick={line.onAddRow} className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground">
        <Plus className="size-3.5" /> Row
      </button>
    </div>
  )
}

function TableView(props: ChartDataEditorProps) {
  const { line } = props
  if (!line) return <BarTable {...props} />
  // Side by side, so the line's table shows in the short data card without scrolling down to it.
  // The bars' block keeps room on its right for its New column button (8 px gap, 8rem wide), then a gap.
  return (
    <div className="flex items-start gap-6">
      <div className="mr-[8.5rem] flex shrink-0 flex-col items-start gap-2">
        <PartHeading part="Bars" title={line.barsTitle} />
        <BarTable {...props} />
      </div>
      <LineTable groups={props.groups} colours={props.colours} line={line} />
    </div>
  )
}

function BarTable({ groups, colours, onValue, onRename, onPaste, onAddGroup, onRemoveGroup, onMoveGroup, onAddRow, rowNames, onRenameRow }: ChartDataEditorProps) {
  const named = rowNames !== undefined && onRenameRow !== undefined
  const drag = useGroupDrag(groups.length, onMoveGroup)
  const rows = Math.max(1, ...groups.map((g) => g.values.length))
  const body = useRef<HTMLTableSectionElement>(null)
  const { start, end } = useRowWindow(rows, TABLE_ROW, body)
  const headCell = 'border border-border bg-muted p-0 text-left font-medium'
  return (
    <div className="flex flex-col items-start gap-2">
      {/* The Add column button is one dashed box the height of the whole table, 8 px to its right. */}
      <div className="relative w-max">
      <table data-grid className="border-collapse text-xs tabular-nums">
        <thead>
          <tr>
            <th scope="col" className={cn('border border-border bg-muted px-1.5 font-normal text-muted-foreground', named ? 'w-32 text-left' : 'w-8 text-right')}>
              {named ? 'Row name' : <span className="sr-only">Row</span>}
            </th>
            {groups.map((g, c) => (
              <th key={c} scope="col" className={cn(headCell, drag.over === c && 'shadow-[inset_2px_0_0_var(--primary)]')} style={{ boxShadow: drag.over === c ? undefined : `inset 0 3px ${colours[c % colours.length]}` }} {...drag.target(c)}>
                <div className={cn('group flex w-32 items-center', drag.from === c && 'opacity-40')} data-cell={`-1,${c}`}>
                  <Grip {...drag.grip(c)} />
                  <Cell value={g.name} label={`Group ${c + 1} name`} onCommit={(text) => onRename(c, text)} onPaste={(text) => onPaste(text, { group: c, row: -1 })} onMove={(step) => onMoveGroup(c, c + step + (step > 0 ? 1 : 0))} className="font-medium" />
                  <IconButton icon={Trash2} label={`Remove ${g.name || `group ${c + 1}`}`} size="sm" className="opacity-0 group-focus-within:opacity-100 group-hover:opacity-100" onClick={() => onRemoveGroup(c)} />
                </div>
              </th>
            ))}
            <th aria-hidden="true" className={cn('w-2 p-0', drag.over === groups.length && 'shadow-[inset_2px_0_0_var(--primary)]')} {...drag.target(groups.length)} />
          </tr>
        </thead>
        <tbody ref={body}>
          {start > 0 && (
            <tr aria-hidden="true" style={{ height: start * TABLE_ROW }}>
              <td colSpan={groups.length + 1} />
            </tr>
          )}
          {Array.from({ length: end - start }, (_, i) => {
            const r = start + i
            return (
              <tr key={r} style={{ height: TABLE_ROW }}>
                {named ? (
                  <th scope="row" className="w-32 border border-border bg-muted p-0 text-left font-medium" data-cell={`${r},-1`}>
                    <Cell value={rowNames[r] ?? ''} label={`Row ${r + 1} name`} onCommit={(text) => onRenameRow(r, text)} onPaste={(text) => onPaste(text, { group: -1, row: r })} className="h-7" />
                  </th>
                ) : (
                  <th scope="row" className="border border-border bg-muted px-1.5 text-right font-normal text-muted-foreground">{r + 1}</th>
                )}
                {groups.map((g, c) => (
                  <td key={c} className="border border-border p-0" data-cell={`${r},${c}`}>
                    <Cell value={show(g.values[r])} label={`${g.name || `Group ${c + 1}`}, row ${r + 1}`} onCommit={(text) => onValue(c, r, text)} onPaste={(text) => onPaste(text, { group: c, row: r })} className="h-7 text-right" />
                  </td>
                ))}
              </tr>
            )
          })}
          {end < rows && (
            <tr aria-hidden="true" style={{ height: (rows - end) * TABLE_ROW }}>
              <td colSpan={groups.length + 1} />
            </tr>
          )}
        </tbody>
      </table>
      <button
        type="button"
        aria-label="Add column"
        onClick={onAddGroup}
        className="absolute top-0 bottom-0 left-full ml-2 flex w-32 flex-col items-stretch justify-center rounded-lg border border-dashed border-border-strong text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        {/* Centred in the button; on a tall table, held in the middle of the visible part while scrolling (a sticky offset of half the scroll area, less half the label's 3rem, from the top and the bottom). */}
        <span className="sticky top-[calc(50%-1.5rem)] bottom-[calc(50%-1.5rem)] flex h-12 flex-col items-center justify-center gap-1 text-sm">
          <Plus aria-hidden="true" className="size-6" />
          New column
        </span>
      </button>
      </div>
      <button type="button" onClick={onAddRow} className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground">
        <Plus className="size-3.5" /> Row
      </button>
    </div>
  )
}

function GroupsView(props: ChartDataEditorProps) {
  const { groups, colours, onMoveGroup } = props
  const drag = useGroupDrag(groups.length, onMoveGroup)
  const expanded = useExpandedControls()
  const [part, setPart] = useState<'bars' | 'line'>('bars')
  if (expanded) {
    const { line } = props
    if (!line) return <GroupColumns {...props} />
    // Phones, bar + line charts: one set of columns at a time, switched above them. The line's columns keep the groups'
    // names (renamed from either) but take their rows from the line; its rows can't be taken out one by one.
    const shown: ChartDataEditorProps =
      part === 'line'
        ? { ...props, groups: groups.map((g, c) => ({ name: g.name, values: line.values[c] ?? [] })), onValue: line.onValue, onPaste: line.onPaste, onAddRow: line.onAddRow, onRemoveRow: undefined }
        : props
    return (
      <div className="flex flex-col gap-2">
        <Tabs
          variant="segmented"
          label="Values shown"
          value={part}
          onValueChange={(value) => setPart(value === 'line' ? 'line' : 'bars')}
          // An icon before each name (owner's call, 2026-11-25).
          tabs={[
            {
              value: 'bars',
              label: (
                <span className="flex items-center gap-1.5">
                  <ChartColumn aria-hidden="true" className="size-4" /> Bars
                </span>
              ),
            },
            {
              value: 'line',
              label: (
                <span className="flex items-center gap-1.5">
                  <ChartLine aria-hidden="true" className="size-4" /> Line
                </span>
              ),
            },
          ]}
          className="[&_[role=tablist]]:h-11 [&_[role=tablist]]:w-full"
        />
        <GroupColumns key={part} {...shown} />
      </div>
    )
  }
  return (
    <div className="flex flex-wrap items-start gap-3">
      {groups.map((g, c) => (
        <GroupCard key={c} {...props} group={g} c={c} colour={colours[c % colours.length] ?? '#000000'} drag={drag} />
      ))}
    </div>
  )
}

function GroupCard({ group: g, c, colour, drag, onValue, onRename, onPaste, onRemoveGroup, onMoveGroup, line }:ChartDataEditorProps & { group: DataGroup; c: number; colour: string; drag: ReturnType<typeof useGroupDrag> }) {
  const count = g.values.filter((v) => v !== null).length
  // Four values to a row, and one empty cell at the end to type the next value in.
  const total = g.values.length + 1
  const rows = Math.ceil(total / 4)
  const grid = useRef<HTMLDivElement>(null)
  const { start, end } = useRowWindow(rows, CARD_ROW, grid, 12)
  return (
    <div data-grid className={cn('w-56 rounded-lg border p-2', drag.from === c && 'opacity-40', drag.over === c && 'shadow-[-3px_0_0_var(--primary)]')} {...drag.target(c)}>
      <div className="mb-1.5 flex items-center gap-1.5" data-cell="-1,0">
        <Grip {...drag.grip(c)} />
        <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: colour }} />
        <Cell value={g.name} label={`Group ${c + 1} name`} onCommit={(text) => onRename(c, text)} onMove={(step) => onMoveGroup(c, c + step + (step > 0 ? 1 : 0))} className="rounded font-medium" />
        <span className="shrink-0 text-xs text-muted-foreground">n = {count}</span>
        <IconButton icon={Trash2} label={`Remove ${g.name || `group ${c + 1}`}`} size="sm" onClick={() => onRemoveGroup(c)} />
      </div>
      <div ref={grid} className="grid grid-cols-4 gap-1" style={{ paddingTop: start * CARD_ROW, paddingBottom: (rows - end) * CARD_ROW }}>
        {Array.from({ length: Math.min(end * 4, total) - start * 4 }, (_, i) => {
          const r = start * 4 + i
          return (
            <span key={r} data-cell={`${r},0`} className="h-7 rounded border border-input-border bg-input">
              <Cell value={show(g.values[r])} label={`${g.name || `Group ${c + 1}`}, value ${r + 1}`} onCommit={(text) => onValue(c, r, text)} onPaste={(text) => onPaste(text, { group: c, row: r })} className="h-full text-center text-xs" />
            </span>
          )
        })}
      </div>
      {line && <GroupLineValues line={line} name={g.name || `Group ${c + 1}`} c={c} />}
    </div>
  )
}

/** Bar + line charts: a group's line values under its bar values in its card, four to a row with an empty cell to type the next in. */
function GroupLineValues({ line, name, c }: { line: DataLine; name: string; c: number }) {
  const values = line.values[c] ?? []
  return (
    <div data-grid className="mt-2 border-t pt-1.5">
      <p className="mb-1 truncate text-xs text-muted-foreground">Line{line.title.trim() ? ` · ${line.title}` : ''}</p>
      <div className="grid grid-cols-4 gap-1">
        {Array.from({ length: values.length + 1 }, (_, r) => (
          <span key={r} data-cell={`${r},0`} className="h-7 rounded border border-input-border bg-input">
            <Cell value={show(values[r])} label={`Line, ${name}, value ${r + 1}`} onCommit={(text) => line.onValue(c, r, text)} onPaste={(text) => line.onPaste(text, { group: c, row: r })} className="h-full text-center text-xs" />
          </span>
        ))}
      </div>
    </div>
  )
}

/** A group column's width and the gap after it, in px (7.5rem and gap-x-2). */
const COLUMN_STEP = 128
/** How long a finger rests on a group's name before the column comes loose, in ms. */
const HOLD_MS = 350
/** A finger moving further than this before then is scrolling, not holding, in px. */
const HOLD_SLOP = 8
/** Near the box's left or right edge (px), a dragged column scrolls the groups along. */
const EDGE = 48

type HoldDrag = { from: number; dx: number; to: number }

/**
 * Phones: moving a group by holding its name briefly until the column comes
 * loose (a short buzz where the phone can), then sliding it sideways. The other
 * columns make room as it passes; near the edge of the box the groups scroll
 * along, so a group can travel past ones out of view. Letting go puts it there.
 */
function useHoldDrag(box: RefObject<HTMLDivElement | null>, count: number, onMove: (from: number, to: number) => void) {
  const [drag, setDrag] = useState<HoldDrag | null>(null)
  const live = useRef<{ from: number; startX: number; startScroll: number; centres: number[]; x: number; frame: number } | null>(null)
  const hold = useRef<{ timer: number; x: number; y: number } | null>(null)
  const justDropped = useRef(false)

  // While a column is loose, the finger moves it instead of scrolling the box.
  useEffect(() => {
    const element = box.current
    if (!element) return
    const stop = (event: TouchEvent) => {
      if (live.current) event.preventDefault()
    }
    element.addEventListener('touchmove', stop, { passive: false })
    return () => element.removeEventListener('touchmove', stop)
  }, [box])

  const place = () => {
    const state = live.current
    const element = box.current
    if (!state || !element) return
    const dx = state.x - state.startX + (element.scrollLeft - state.startScroll)
    const centre = (state.centres[state.from] ?? 0) + dx
    const before = state.centres.filter((c, i) => i !== state.from && c < centre).length
    setDrag({ from: state.from, dx, to: before <= state.from ? before : before + 1 })
  }

  // Scrolls along while the finger is near an edge, a step about every frame.
  const edgeScroll = () => {
    const state = live.current
    const element = box.current
    if (!state || !element) return
    const view = element.getBoundingClientRect()
    const step = state.x < view.left + EDGE ? -10 : state.x > view.right - EDGE ? 10 : 0
    if (step) {
      element.scrollLeft += step
      place()
    }
  }

  const end = (drop: boolean) => {
    const state = live.current
    if (hold.current) window.clearTimeout(hold.current.timer)
    hold.current = null
    if (!state) return
    window.clearInterval(state.frame)
    live.current = null
    if (drop && drag && drag.to !== drag.from && drag.to !== drag.from + 1) onMove(drag.from, drag.to)
    setDrag(null)
    justDropped.current = true
    ;(document.activeElement as HTMLElement | null)?.blur()
  }

  const handle = (c: number) => ({
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
      const target = event.currentTarget
      const { pointerId, clientX, clientY } = event
      hold.current = {
        x: clientX,
        y: clientY,
        timer: window.setTimeout(() => {
          const element = box.current
          if (!element) return
          hold.current = null
          const headers = [...element.querySelectorAll<HTMLElement>('[data-cell^="-1,"]')].slice(0, count)
          const centres = headers.map((h) => {
            const r = h.getBoundingClientRect()
            return r.left + r.width / 2
          })
          live.current = { from: c, startX: clientX, startScroll: element.scrollLeft, centres, x: clientX, frame: 0 }
          ;(document.activeElement as HTMLElement | null)?.blur()
          try {
            target.setPointerCapture(pointerId)
          } catch {
            // The pointer is already gone; its pointerup ends the drag anyway.
          }
          navigator.vibrate?.(10)
          setDrag({ from: c, dx: 0, to: c })
          live.current.frame = window.setInterval(edgeScroll, 16)
        }, HOLD_MS),
      }
    },
    onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
      if (hold.current && Math.hypot(event.clientX - hold.current.x, event.clientY - hold.current.y) > HOLD_SLOP) {
        window.clearTimeout(hold.current.timer)
        hold.current = null
      }
      if (!live.current) return
      live.current.x = event.clientX
      place()
    },
    onPointerUp: () => end(true),
    onPointerCancel: () => end(false),
    // A long press would otherwise open the phone's own menu or select the name.
    onContextMenu: (event: ReactMouseEvent) => event.preventDefault(),
    onClickCapture: (event: ReactMouseEvent) => {
      if (!justDropped.current) return
      justDropped.current = false
      event.preventDefault()
    },
  })

  /** Where column `c` is drawn while a column is being moved. */
  const shift = (c: number): CSSProperties | undefined => {
    if (!drag) return undefined
    if (c === drag.from) return { transform: `translateX(${drag.dx}px)`, zIndex: 30, position: 'relative', boxShadow: 'var(--elevation-lg)', transition: 'none' }
    const moved = drag.to > drag.from ? c > drag.from && c < drag.to ? -COLUMN_STEP : 0 : c >= drag.to && c < drag.from ? COLUMN_STEP : 0
    return { transform: `translateX(${moved}px)`, transition: 'transform 150ms ease-out' }
  }

  return { drag, handle, shift }
}

/**
 * Phones: the groups side by side, each a column of values going down in one
 * outlined box (rows split by thin lines), with the row numbers on the left so
 * a row reads straight across. Over each column its colour and name (tap to
 * rename; the pencil says so and steps aside while typing), under it a Remove
 * button; beside the last column, a column-high button adds a group and
 * scrolls it into view. Each row number has an × that takes that row out.
 * "+ Row" adds an empty row; so does leaving (or Enter in) the last row once
 * it holds a value. The values scroll inside a box of their own, names and row
 * numbers staying in view, so the sheet never grows over the chart. Holding a
 * group's name briefly picks the column up to move it (see `useHoldDrag`)
 * (owner's calls, 2026-11-17).
 */
function GroupColumns({ groups, colours, onValue, onRename, onPaste, onAddGroup, onRemoveGroup, onAddRow, onRemoveRow, onMoveGroup }: ChartDataEditorProps) {
  const rows = Math.max(1, ...groups.map((g) => g.values.length))
  const box = useRef<HTMLDivElement>(null)
  // The cell to move to once the row added by Enter is there.
  const next = useRef<{ row: number; group: number } | null>(null)
  const filled = (r: number) => groups.some((g) => g.values[r] !== null && g.values[r] !== undefined)
  const { drag, handle, shift } = useHoldDrag(box, groups.length, onMoveGroup)

  useEffect(() => {
    const want = next.current
    if (!want || want.row >= rows) return
    next.current = null
    box.current?.querySelector<HTMLInputElement>(`[data-cell="${want.row},${want.group}"] input`)?.focus()
  }, [rows])

  // A new group shows straight away: scroll to the end, where it was added.
  const count = useRef(groups.length)
  useEffect(() => {
    if (groups.length > count.current) box.current?.scrollTo({ left: box.current.scrollWidth, behavior: 'smooth' })
    count.current = groups.length
  }, [groups.length])

  const leaveLastRow = (event: FocusEvent<HTMLElement>, r: number) => {
    const to = event.relatedTarget?.closest<HTMLElement>('[data-cell]')?.dataset.cell
    // Moving along the last row isn't leaving it.
    if (to !== undefined && Number(to.split(',')[0]) === r) return
    if (r === rows - 1 && filled(r)) onAddRow()
    else next.current = null
  }

  const sticky = 'sticky z-10 bg-panel'
  return (
    <div ref={box} className="max-h-[min(24rem,48dvh)] overflow-auto overscroll-contain">
      <div data-grid className="grid w-max gap-x-2" style={{ gridTemplateColumns: `2.75rem repeat(${groups.length + 1}, 7.5rem)` }}>
        <span aria-hidden="true" className={cn(sticky, 'top-0 left-0 z-20')} />
        {groups.map((g, c) => (
          <label
            key={c}
            data-cell={`-1,${c}`}
            {...handle(c)}
            style={shift(c)}
            className={cn(sticky, 'group/name top-0 flex h-11 min-w-0 cursor-text items-center select-none [-webkit-touch-callout:none]', drag?.from === c && 'rounded-md')}
          >
            <span className={cn('flex h-9 w-full min-w-0 items-center gap-1.5 rounded-md px-1.5 focus-within:bg-primary-subtle', drag?.from === c && 'bg-primary-subtle')}>
              <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ background: colours[c % colours.length] }} />
              <Cell value={g.name} label={`Group ${c + 1} name`} onCommit={(text) => onRename(c, text)} className="h-full px-0 text-sm font-medium focus:bg-transparent" />
              <Pencil aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground group-focus-within/name:hidden" />
            </span>
          </label>
        ))}
        <span aria-hidden="true" className={cn(sticky, 'top-0 flex h-11 items-center px-1.5 text-sm text-muted-foreground')}>
          New column
        </span>
        {Array.from({ length: rows }, (_, r) => (
          <Fragment key={r}>
            <span className={cn(sticky, 'left-0 flex h-10 items-center justify-between pr-0.5 text-xs text-muted-foreground tabular-nums')}>
              <span aria-hidden="true" className="w-4 text-right">
                {r + 1}
              </span>
              {onRemoveRow && (
                <button type="button" aria-label={`Remove row ${r + 1}`} onClick={() => onRemoveRow(r)} className="grid size-6 place-items-center rounded-md hover:bg-accent hover:text-foreground">
                  <X aria-hidden="true" className="size-3.5" />
                </button>
              )}
            </span>
            {groups.map((g, c) => (
              <span
                key={c}
                data-cell={`${r},${c}`}
                style={shift(c)}
                onBlur={(event) => leaveLastRow(event, r)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' || r !== rows - 1 || !filled(r)) return
                  event.preventDefault()
                  next.current = { row: r + 1, group: c }
                  ;(event.target as HTMLElement).blur()
                }}
                className={cn('h-10 border-x border-b border-border-strong bg-input', r === 0 && 'rounded-t-lg border-t', r === rows - 1 && 'rounded-b-lg')}
              >
                <Cell
                  value={show(g.values[r])}
                  label={`${g.name || `Group ${c + 1}`}, value ${r + 1}`}
                  onCommit={(text) => onValue(c, r, text)}
                  onPaste={(text) => onPaste(text, { group: c, row: r })}
                  className={cn('h-full text-center text-sm', r === 0 && 'rounded-t-lg', r === rows - 1 && 'rounded-b-lg')}
                />
              </span>
            ))}
            {r === 0 && (
              <button
                type="button"
                aria-label="Add group"
                onClick={onAddGroup}
                style={{ gridRow: `2 / span ${rows}`, gridColumn: groups.length + 2 }}
                className="flex items-center justify-center rounded-lg border border-dashed border-border-strong text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Plus aria-hidden="true" className="size-5" />
              </button>
            )}
          </Fragment>
        ))}
        <span aria-hidden="true" className={cn(sticky, 'left-0')} />
        <button
          type="button"
          onClick={onAddRow}
          style={{ gridColumn: `2 / span ${groups.length}` }}
          className="mt-2 flex h-10 items-center justify-center gap-1.5 rounded-lg border border-dashed border-border-strong text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Plus aria-hidden="true" className="size-4" />
          Row
        </button>
        <span aria-hidden="true" />
        <span aria-hidden="true" className={cn(sticky, 'left-0')} />
        {groups.map((g, c) => (
          <button
            key={c}
            type="button"
            style={shift(c)}
            onClick={() => onRemoveGroup(c)}
            aria-label={`Remove ${g.name || `group ${c + 1}`}`}
            className="mt-1 flex h-9 items-center justify-center gap-1.5 rounded-md text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Trash2 aria-hidden="true" className="size-3.5" />
            Remove
          </button>
        ))}
      </div>
    </div>
  )
}

/** The handle a group is dragged by. */
function Grip(props: { draggable: true; onDragStart: (event: DragEvent) => void; onDragEnd: () => void }) {
  return (
    <span {...props} title="Drag to move this group" className="flex h-6 w-3.5 shrink-0 cursor-grab items-center justify-center text-muted-foreground hover:text-foreground active:cursor-grabbing">
      <GripVertical aria-hidden className="size-3.5" />
    </span>
  )
}

/**
 * Dragging a group to another place: the grip starts it, every group (and
 * the end) is a place to drop, and a blue line shows where it would land.
 */
function useGroupDrag(count: number, onMove: (from: number, to: number) => void) {
  const [from, setFrom] = useState<number>()
  const [over, setOver] = useState<number>()
  const end = () => {
    setFrom(undefined)
    setOver(undefined)
  }
  return {
    from,
    // No line where the group already is.
    over: from !== undefined && over !== from && over !== from + 1 ? over : undefined,
    grip: (index: number) => ({
      draggable: true as const,
      onDragStart: (event: DragEvent) => {
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/plain', String(index))
        setFrom(index)
      },
      onDragEnd: end,
    }),
    target: (index: number) => ({
      onDragOver: (event: DragEvent) => {
        if (from === undefined) return
        event.preventDefault()
        // Over the right half of a group, it lands after it.
        const box = event.currentTarget.getBoundingClientRect()
        setOver(Math.min(event.clientX > box.left + box.width / 2 && index < count ? index + 1 : index, count))
      },
      onDrop: (event: DragEvent) => {
        event.preventDefault()
        if (from !== undefined && over !== undefined && over !== from && over !== from + 1) onMove(from, over)
        end()
      },
    }),
  }
}
