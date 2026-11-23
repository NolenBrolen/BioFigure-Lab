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
import { ChevronUp, GripVertical, Pencil, Plus, Trash2, X } from 'lucide-react'
import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type CSSProperties,
  type DragEvent,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react'

import { cn } from '../../lib/cn'
import { useExpandedControls } from '../../lib/expanded-controls'
import { IconButton } from '../icon-button/IconButton'
import { Tabs } from '../tabs/Tabs'

export type DataView = 'table' | 'groups'
export type DataGroup = { name: string; values: (number | null)[] }

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
  /** Phones: takes a row out of every group. */
  onRemoveRow?: (row: number) => void
  /** Minimised: only the header bar shows. One button minimises (×) and opens it again (↑). Without `onCollapsedChange` there is no such button. */
  collapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
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
  const { view, onViewChange, onAddGroup, collapsed = false, onCollapsedChange, className, style } = props
  const expanded = useExpandedControls()
  return (
    <section aria-label="Chart data" className={cn('flex min-h-0 flex-col bg-panel text-sm text-foreground', className)} style={style}>
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
        <span className="hidden text-xs text-muted-foreground xl:inline">Type, or paste from Excel or Google Sheets</span>
        <div className="ml-auto flex items-center gap-1">
          {expanded ? (
            <button type="button" onClick={onAddGroup} className="flex h-11 items-center gap-1.5 rounded-md px-3 text-sm ring-1 ring-border ring-inset hover:bg-accent">
              <Plus className="size-4" aria-hidden="true" /> Group
            </button>
          ) : (
            <IconButton icon={Plus} label="Add group" size="sm" onClick={onAddGroup} />
          )}
          {onCollapsedChange && <IconButton icon={collapsed ? ChevronUp : X} label={collapsed ? 'Show the data' : 'Minimise the data'} size="sm" aria-expanded={!collapsed} onClick={() => onCollapsedChange(!collapsed)} />}
        </div>
      </div>
      {!collapsed && <div className={cn('min-h-0 flex-1', expanded ? 'pt-3' : 'overflow-auto p-3', expanded && view === 'table' && 'overflow-auto')}>{view === 'table' ? <TableView {...props} /> : <GroupsView {...props} />}</div>}
    </section>
  )
}

function TableView({ groups, colours, onValue, onRename, onPaste, onRemoveGroup, onMoveGroup, onAddRow }: ChartDataEditorProps) {
  const drag = useGroupDrag(groups.length, onMoveGroup)
  const rows = Math.max(1, ...groups.map((g) => g.values.length))
  const headCell = 'border border-border bg-muted p-0 text-left font-medium'
  return (
    <div className="flex flex-col items-start gap-2">
      <table data-grid className="border-collapse text-xs tabular-nums">
        <thead>
          <tr>
            <th scope="col" className="w-8 border border-border bg-muted px-1.5 text-right font-normal text-muted-foreground">
              <span className="sr-only">Row</span>
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
            <th aria-hidden className={cn('w-2 p-0', drag.over === groups.length && 'shadow-[inset_2px_0_0_var(--primary)]')} {...drag.target(groups.length)} />
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, r) => (
            <tr key={r}>
              <th scope="row" className="border border-border bg-muted px-1.5 text-right font-normal text-muted-foreground">{r + 1}</th>
              {groups.map((g, c) => (
                <td key={c} className="border border-border p-0" data-cell={`${r},${c}`}>
                  <Cell value={show(g.values[r])} label={`${g.name || `Group ${c + 1}`}, row ${r + 1}`} onCommit={(text) => onValue(c, r, text)} onPaste={(text) => onPaste(text, { group: c, row: r })} className="text-right" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" onClick={onAddRow} className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground">
        <Plus className="size-3.5" /> Row
      </button>
    </div>
  )
}

function GroupsView(props: ChartDataEditorProps) {
  const { groups, colours, onValue, onRename, onPaste, onRemoveGroup, onMoveGroup } = props
  const drag = useGroupDrag(groups.length, onMoveGroup)
  const expanded = useExpandedControls()
  if (expanded) return <GroupColumns {...props} />
  return (
    <div className="flex flex-wrap items-start gap-3">
      {groups.map((g, c) => {
        const count = g.values.filter((v) => v !== null).length
        return (
          <div key={c} data-grid className={cn('w-56 rounded-lg border p-2', drag.from === c && 'opacity-40', drag.over === c && 'shadow-[-3px_0_0_var(--primary)]')} {...drag.target(c)}>
            <div className="mb-1.5 flex items-center gap-1.5" data-cell={`-1,0`}>
              <Grip {...drag.grip(c)} />
              <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: colours[c % colours.length] }} />
              <Cell value={g.name} label={`Group ${c + 1} name`} onCommit={(text) => onRename(c, text)} onMove={(step) => onMoveGroup(c, c + step + (step > 0 ? 1 : 0))} className="rounded font-medium" />
              <span className="shrink-0 text-xs text-muted-foreground">n = {count}</span>
              <IconButton icon={Trash2} label={`Remove ${g.name || `group ${c + 1}`}`} size="sm" onClick={() => onRemoveGroup(c)} />
            </div>
            <div className="grid grid-cols-4 gap-1">
              {[...g.values, null].map((v, r) => (
                <span key={r} data-cell={`${r},0`} className="rounded border border-input-border bg-input">
                  <Cell value={show(v)} label={`${g.name || `Group ${c + 1}`}, value ${r + 1}`} onCommit={(text) => onValue(c, r, text)} onPaste={(text) => onPaste(text, { group: c, row: r })} className="text-center text-xs" />
                </span>
              ))}
            </div>
          </div>
        )
      })}
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
