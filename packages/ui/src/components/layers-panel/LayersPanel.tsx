/*
 * Layers panel: every object on the page, the top one first. It sits under
 * the properties on the right.
 *
 * One line per layer: a kind icon and the name. Objects inside a group show
 * a faded right angle under the group's arrow instead of an indent. Hide and
 * lock show on hover (and on keyboard focus). The up/down buttons beside the
 * title move the selected layer one step.
 *
 * Keyboard: Up/Down move between rows, Right/Left open and close a group,
 * Enter or Space selects (Shift or Ctrl adds), Alt+Up/Down moves the layer,
 * F2 renames. Dragging a row onto another row of the same list reorders.
 *
 * The panel only shows and asks: the editor makes the changes (and the undo
 * steps), then hands back the new list.
 */
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  ChartLine,
  ChevronRight,
  Eye,
  EyeOff,
  Group,
  Image,
  Lock,
  LockOpen,
  Minus,
  Square,
  Table2,
  Type,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'

import { cn } from '../../lib/cn'
import { Tooltip } from '../tooltip/Tooltip'

/** Every kind of object a figure can hold, including ones still to come (graphs, tables). */
export type LayerKind = 'icon' | 'arrow' | 'line' | 'shape' | 'text' | 'graph' | 'table' | 'group'

export type LayerItem = {
  id: string
  name: string
  kind: LayerKind
  hidden: boolean
  locked: boolean
  /** A group's objects, the top one first. */
  children?: LayerItem[]
}

export const layerKindIcon: Record<LayerKind, LucideIcon> = {
  icon: Image,
  arrow: ArrowUpRight,
  line: Minus,
  shape: Square,
  text: Type,
  graph: ChartLine,
  table: Table2,
  group: Group,
}

export type LayersPanelProps = {
  /** The page's objects, the top one first. */
  layers: LayerItem[]
  selectedIds: readonly string[]
  /** `add`: keep the rest of the selection (Shift or Ctrl). */
  onSelect: (id: string, add: boolean) => void
  onRename: (id: string, name: string) => void
  /** Put a layer at this place among its siblings (0 is the top). */
  onMove: (id: string, index: number) => void
  onToggleHidden: (id: string) => void
  onToggleLocked: (id: string) => void
  /** Folded shut: only the header shows. Without `onCollapsedChange` the panel can't be folded. */
  collapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
  className?: string
}

type Row = { layer: LayerItem; siblings: LayerItem[]; index: number; nested: boolean; parentId?: string }

function visibleRows(layers: LayerItem[], open: ReadonlySet<string>, parentId?: string): Row[] {
  return layers.flatMap((layer, index) => [
    { layer, siblings: layers, index, nested: parentId !== undefined, parentId },
    ...(layer.children && open.has(layer.id) ? visibleRows(layer.children, open, layer.id) : []),
  ])
}

function findRow(layers: LayerItem[], id: string, parentId?: string): Row | undefined {
  for (const [index, layer] of layers.entries()) {
    if (layer.id === id) return { layer, siblings: layers, index, nested: parentId !== undefined, parentId }
    const inside = layer.children && findRow(layer.children, id, layer.id)
    if (inside) return inside
  }
  return undefined
}

export function LayersPanel({ layers, selectedIds, onSelect, onRename, onMove, onToggleHidden, onToggleLocked, collapsed = false, onCollapsedChange, className }: LayersPanelProps) {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set())
  const [renaming, setRenaming] = useState<string>()
  const [drag, setDrag] = useState<{ id: string; over?: string; after?: boolean }>()
  const list = useRef<HTMLUListElement>(null)
  // A moved row loses focus when the list re-renders; this brings it back.
  const refocus = useRef<string>(undefined)

  const rows = visibleRows(layers, open)
  const only = selectedIds.length === 1 && selectedIds[0] !== undefined ? findRow(layers, selectedIds[0]) : undefined

  useEffect(() => {
    if (!refocus.current) return
    list.current?.querySelector<HTMLElement>(`[data-layer-id="${CSS.escape(refocus.current)}"]`)?.focus()
    refocus.current = undefined
  }, [layers])

  const setGroupOpen = (id: string, value: boolean) =>
    setOpen((current) => {
      const next = new Set(current)
      if (value) next.add(id)
      else next.delete(id)
      return next
    })

  const move = (row: Row, step: -1 | 1) => {
    const index = row.index + step
    if (index < 0 || index >= row.siblings.length) return
    refocus.current = row.layer.id
    onMove(row.layer.id, index)
  }

  const focusRow = (index: number) =>
    list.current?.querySelectorAll<HTMLElement>('[data-layer-id]')[index]?.focus()

  const onRowKey = (event: KeyboardEvent, row: Row, at: number) => {
    const { key, altKey } = event
    if (altKey && (key === 'ArrowUp' || key === 'ArrowDown')) move(row, key === 'ArrowUp' ? -1 : 1)
    else if (key === 'ArrowUp') focusRow(at - 1)
    else if (key === 'ArrowDown') focusRow(at + 1)
    else if (key === 'ArrowRight' && row.layer.children) setGroupOpen(row.layer.id, true)
    else if (key === 'ArrowLeft' && row.layer.children && open.has(row.layer.id)) setGroupOpen(row.layer.id, false)
    else if (key === 'ArrowLeft' && row.parentId) focusRow(rows.findIndex((r) => r.layer.id === row.parentId))
    else if (key === 'F2') setRenaming(row.layer.id)
    else return
    event.preventDefault()
  }

  const drop = (target: Row, after: boolean) => {
    const from = drag && findRow(layers, drag.id)
    setDrag(undefined)
    if (!from || from.siblings !== target.siblings) return
    let index = target.index + (after ? 1 : 0)
    if (from.index < index) index -= 1
    if (index !== from.index) onMove(from.layer.id, index)
  }

  return (
    <section aria-label="Layers" className={cn('flex min-h-0 flex-col bg-panel text-sm text-foreground', className)}>
      <div className="flex h-9 shrink-0 items-center gap-0.5 px-3">
        {onCollapsedChange ? (
          <h2 className="section-label flex-1">
            <button type="button" aria-expanded={!collapsed} onClick={() => onCollapsedChange(!collapsed)} className="-ml-1 flex items-center gap-1 rounded px-1 py-0.5 hover:bg-muted">
              <ChevronRight aria-hidden className={cn('size-3.5 transition-transform duration-(--duration-instant)', !collapsed && 'rotate-90')} />
              Layers
            </button>
          </h2>
        ) : (
          <h2 className="section-label flex-1">Layers</h2>
        )}
        <RowButton icon={ArrowUp} label="Move layer up" shortcut="Alt+ArrowUp" disabled={!only || only.index === 0} onClick={() => only && move(only, -1)} />
        <RowButton icon={ArrowDown} label="Move layer down" shortcut="Alt+ArrowDown" disabled={!only || only.index === only.siblings.length - 1} onClick={() => only && move(only, 1)} />
      </div>
      {collapsed ? null : layers.length === 0 ? (
        <p className="px-3 py-2 text-muted-foreground">Objects you add show up here.</p>
      ) : (
        <ul ref={list} className="min-h-0 flex-1 overflow-y-auto px-2 pb-2 [scrollbar-gutter:stable]">
          {rows.map((row, at) => {
            const { layer } = row
            const Icon = layerKindIcon[layer.kind]
            const selected = selectedIds.includes(layer.id)
            const dropHere = drag?.over === layer.id
            return (
              <li
                key={layer.id}
                draggable={renaming !== layer.id}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = 'move'
                  event.dataTransfer.setData('text/plain', layer.id)
                  setDrag({ id: layer.id })
                }}
                onDragOver={(event) => {
                  const from = drag && findRow(layers, drag.id)
                  if (!from || from.siblings !== row.siblings) return
                  event.preventDefault()
                  const box = event.currentTarget.getBoundingClientRect()
                  setDrag({ id: from.layer.id, over: layer.id, after: event.clientY > box.top + box.height / 2 })
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  drop(row, drag?.after ?? false)
                }}
                onDragEnd={() => setDrag(undefined)}
                className={cn(
                  'group relative flex h-8 items-center gap-2 rounded-md pr-1 pl-1',
                  selected ? 'bg-primary-subtle text-primary-subtle-foreground' : 'hover:bg-muted',
                  layer.hidden && !selected && 'text-muted-foreground',
                  drag?.id === layer.id && 'opacity-50',
                )}
              >
                {dropHere && (
                  <span aria-hidden className={cn('absolute inset-x-1 h-0.5 rounded bg-primary', drag.after ? '-bottom-px' : '-top-px')} />
                )}
                <span className="grid size-5 shrink-0 place-items-center text-muted-foreground">
                  {layer.children ? (
                    <button
                      type="button"
                      tabIndex={-1}
                      aria-label={open.has(layer.id) ? `Close ${layer.name}` : `Open ${layer.name}`}
                      onClick={() => setGroupOpen(layer.id, !open.has(layer.id))}
                      className="grid size-5 place-items-center rounded"
                    >
                      <ChevronRight className={cn('size-3.5 transition-transform duration-(--duration-instant)', open.has(layer.id) && 'rotate-90')} />
                    </button>
                  ) : row.nested ? (
                    // A faded right angle, its upright under the centre of the group's arrow.
                    <svg viewBox="0 0 20 20" className="size-5 opacity-50" aria-hidden>
                      <path d="M10 3v7h7" fill="none" stroke="currentColor" strokeWidth="1.25" />
                    </svg>
                  ) : null}
                </span>
                <Icon aria-hidden className="size-4 shrink-0" />
                {renaming === layer.id ? (
                  <RenameField
                    name={layer.name}
                    onDone={(name) => {
                      setRenaming(undefined)
                      refocus.current = layer.id
                      if (name !== undefined && name.trim() && name.trim() !== layer.name) onRename(layer.id, name.trim())
                      else list.current?.querySelector<HTMLElement>(`[data-layer-id="${CSS.escape(layer.id)}"]`)?.focus()
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    data-layer-id={layer.id}
                    aria-pressed={selected}
                    aria-expanded={layer.children ? open.has(layer.id) : undefined}
                    tabIndex={(only ? only.layer.id === layer.id : at === 0) ? 0 : -1}
                    onClick={(event) => onSelect(layer.id, event.shiftKey || event.ctrlKey || event.metaKey)}
                    onDoubleClick={() => setRenaming(layer.id)}
                    onKeyDown={(event) => onRowKey(event, row, at)}
                    className="h-full min-w-0 flex-1 truncate rounded text-left"
                  >
                    {layer.name}
                    {(layer.hidden || layer.locked) && (
                      <span className="sr-only">{[layer.hidden && 'hidden', layer.locked && 'locked'].filter(Boolean).join(', ')}</span>
                    )}
                  </button>
                )}
                <span className={cn('hidden group-focus-within:flex group-hover:flex', (layer.hidden || layer.locked) && 'flex')}>
                  <RowButton icon={layer.hidden ? EyeOff : Eye} label={layer.hidden ? `Show ${layer.name}` : `Hide ${layer.name}`} onClick={() => onToggleHidden(layer.id)} faded={!layer.hidden} />
                  <RowButton icon={layer.locked ? Lock : LockOpen} label={layer.locked ? `Unlock ${layer.name}` : `Lock ${layer.name}`} onClick={() => onToggleLocked(layer.id)} faded={!layer.locked} />
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function RowButton({ icon: Icon, label, shortcut, onClick, disabled, faded }: {
  icon: LucideIcon
  label: string
  shortcut?: string
  onClick: () => void
  disabled?: boolean
  faded?: boolean
}) {
  return (
    <Tooltip label={label} shortcut={shortcut}>
      <button
        type="button"
        aria-label={label}
        aria-disabled={disabled}
        onClick={() => !disabled && onClick()}
        className={cn(
          'grid size-6 place-items-center rounded hover:bg-background/60',
          faded && 'text-muted-foreground',
          disabled && 'opacity-40',
        )}
      >
        <Icon aria-hidden className="size-3.5" />
      </button>
    </Tooltip>
  )
}

function RenameField({ name, onDone }: { name: string; onDone: (name?: string) => void }) {
  const [value, setValue] = useState(name)
  // Enter finishes, and the blur that follows must not finish again.
  const done = useRef(false)
  const finish = (result?: string) => {
    if (done.current) return
    done.current = true
    onDone(result)
  }
  return (
    <input
      aria-label="Layer name"
      autoFocus
      value={value}
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => finish(value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') finish(value)
        else if (event.key === 'Escape') finish()
        else return
        event.preventDefault()
        event.stopPropagation()
      }}
      className="h-6 min-w-0 flex-1 rounded border border-input-border bg-input px-1 outline-none focus-visible:outline-2"
    />
  )
}
