/*
 * Chart data section: what the Data row of a chart's properties opens
 * (design B of four drafts, 2026-11-20; the "This chart" tab was dropped
 * 2026-11-21 at the owner's request, it only displayed things).
 * Above two tabs sits an "In this chart" strip: a small picture of the
 * chart's numbers, where they came from, their size, and the Edit data
 * button. The tabs:
 *   Your data   the data sets saved earlier, newest first, with search. A
 *               click uses one in the chart; the one in the chart says "In
 *               chart"; each has a ⋯ menu to rename, duplicate or delete.
 *   Import      drop a file here, pick one, or paste from the clipboard (the
 *               button, or Ctrl+V once the section was last clicked). A
 *               big file shows its progress with Cancel.
 * Only interface: the data comes in as props and every action goes out as a
 * callback; keeping the data sets is the app's job.
 */
import { ClipboardPaste, Copy, FileSpreadsheet, FileUp, MoreHorizontal, Pencil, Table2, Trash2, Upload, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type DragEvent, type RefObject } from 'react'

import { cn } from '../../lib/cn'
import { Button } from '../button/Button'
import { IconButton } from '../icon-button/IconButton'
import { DropdownMenu } from '../menu/Menu'
import { SearchField } from '../search-field/SearchField'
import { Skeleton } from '../skeleton/Skeleton'
import { Tabs, TabsPanel } from '../tabs/Tabs'

/** One group: its name and its values (empty cells are null). */
export type DataGroup = { name: string; values: (number | null)[] }

/** A saved data set, as listed in Your data. */
export type DataSetItem = { id: string; name: string; updatedAt: number; groups: DataGroup[] }

/** A file being read: `fraction` 0 to 1, or null while unknown. */
export type ImportProgress = { name: string; fraction: number | null; size?: string }

export type ChartDataSectionProps = {
  groups: DataGroup[]
  /** The groups' colours, in turn. */
  colours: string[]
  /** Where the chart's data came from; leave out for typed data. */
  source?: { id: string; name: string; importedAt: number }
  /** The saved data sets, newest first; undefined while they load. */
  datasets: DataSetItem[] | undefined
  /** Set while a big file is being read. */
  importing?: ImportProgress
  onEditData: () => void
  /** The data card is open in full screen: the strip's button then closes it instead. */
  dataOpen?: boolean
  onCloseData?: () => void
  onImportFile: (file: File) => void
  onPaste: () => void
  onUseDataset: (id: string) => void
  onRename: (id: string, name: string) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
  onCancelImport: () => void
  className?: string
}

const SWATCHES = ['#0072B2', '#E69F00', '#009E73', '#CC79A7', '#56B4E9', '#D55E00', '#F0E442', '#000000']
const ACCEPT = '.csv,.tsv,.txt,.xlsx'

const shortDate = (time: number) => new Date(time).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const rowsOf = (groups: DataGroup[]) => Math.max(0, ...groups.map((g) => g.values.length))
const valuesOf = (groups: DataGroup[]) => groups.reduce((n, g) => n + g.values.filter((v) => v !== null).length, 0)
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
const sizeText = (groups: DataGroup[]) => `${plural(groups.length, 'group')} × ${plural(rowsOf(groups), 'row')}`
export const dataSummary = (groups: DataGroup[]) => `${plural(groups.length, 'group')} · ${plural(valuesOf(groups), 'value')}`

export function ChartDataSection({ groups, colours, source, datasets, importing, onEditData, dataOpen = false, onCloseData, onImportFile, onPaste, onUseDataset, onRename, onDuplicate, onDelete, onCancelImport, className }: ChartDataSectionProps) {
  // Your data, once there is any; Import first while there is none (the choice made by clicking a tab wins).
  const [picked, setTab] = useState<string | null>(null)
  const tab = picked ?? (datasets && datasets.length === 0 ? 'import' : 'library')
  const root = useRef<HTMLDivElement>(null)
  usePasteShortcut(root, tab === 'import', onPaste)
  return (
    <div ref={root} className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <div className="px-4 pt-3">
        <section aria-label="In this chart" className="flex h-14 items-center gap-2.5 rounded-md border bg-muted/50 py-2 pr-2 pl-2">
          <Preview groups={groups} colours={colours} className="h-9 w-12" />
          <p className="min-w-0 flex-1 text-sm">
            <span className="block truncate font-medium" title={source?.name}>
              {source ? source.name : sizeText(groups)}
            </span>
            {source && <span className="block truncate text-xs text-muted-foreground">{sizeText(groups)}</span>}
          </p>
          {/* The same size and place either way, so the strip doesn't jump. */}
          <Button size="sm" className="min-w-28" onClick={dataOpen ? onCloseData : onEditData}>
            {dataOpen ? <X className="size-4" aria-hidden="true" /> : <Table2 className="size-4" aria-hidden="true" />}
            {dataOpen ? 'Close' : 'Edit data'}
          </Button>
        </section>
      </div>
      <Tabs
        label="Data"
        value={tab}
        onValueChange={setTab}
        className="min-h-0 flex-1"
        tabs={[
          { value: 'library', label: 'Your data' },
          { value: 'import', label: 'Import' },
        ]}
      >
        <TabsPanel value="library" className="flex flex-col overflow-y-auto p-4">
          <Library datasets={datasets} activeId={source?.id} onUse={onUseDataset} onRename={onRename} onDuplicate={onDuplicate} onDelete={onDelete} onImport={() => setTab('import')} />
        </TabsPanel>
        <TabsPanel value="import" className="overflow-y-auto p-4">
          <ImportTab importing={importing} onImportFile={onImportFile} onPaste={onPaste} onCancelImport={onCancelImport} />
        </TabsPanel>
      </Tabs>
    </div>
  )
}

/**
 * Ctrl+V (Cmd+V on a Mac) on the Import tab does what Paste from clipboard
 * does, once the section was the last place clicked or focused, so a paste
 * meant for the figure still reaches it. It listens before the editor's own
 * shortcuts, which would otherwise paste copied objects instead. Typing in a
 * field keeps its own paste.
 */
function usePasteShortcut(root: RefObject<HTMLElement | null>, on: boolean, paste: () => void) {
  const latest = useRef(paste)
  latest.current = paste
  useEffect(() => {
    if (!on) return
    let inside = root.current?.contains(document.activeElement) ?? false
    const track = (event: Event) => {
      inside = event.target instanceof Node && (root.current?.contains(event.target) ?? false)
    }
    const key = (event: KeyboardEvent) => {
      if (!inside || event.key.toLowerCase() !== 'v' || !(event.ctrlKey || event.metaKey) || event.shiftKey || event.altKey) return
      if (event.target instanceof Element && event.target.closest('input, textarea, [contenteditable="true"]')) return
      event.preventDefault()
      event.stopPropagation()
      latest.current()
    }
    document.addEventListener('pointerdown', track, true)
    document.addEventListener('focusin', track, true)
    window.addEventListener('keydown', key, true)
    return () => {
      document.removeEventListener('pointerdown', track, true)
      document.removeEventListener('focusin', track, true)
      window.removeEventListener('keydown', key, true)
    }
  }, [on, root])
}

function ImportTab({ importing, onImportFile, onPaste, onCancelImport }: Pick<ChartDataSectionProps, 'importing' | 'onImportFile' | 'onPaste' | 'onCancelImport'>) {
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const take = (file: File | undefined) => file && onImportFile(file)
  const drop = (event: DragEvent) => {
    event.preventDefault()
    setDragging(false)
    take(event.dataTransfer.files[0])
  }
  return (
    <div className="flex flex-col gap-3">
      {importing && (
        <div className="rounded-lg border p-3" role="status">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <p className="min-w-0 flex-1 text-sm">
              <span className="block truncate font-medium">{importing.name}</span>
              <span className="block text-xs text-muted-foreground">
                {importing.fraction === null ? 'Reading…' : `Reading… ${Math.round(importing.fraction * 100)}%`}
                {importing.size && ` · ${importing.size}`}
              </span>
            </p>
            <Button size="sm" variant="ghost" onClick={onCancelImport}>
              Cancel
            </Button>
          </div>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
            <div className={cn('h-full rounded-full bg-primary', importing.fraction === null && 'w-1/3 animate-pulse')} style={importing.fraction === null ? undefined : { width: `${importing.fraction * 100}%` }} />
          </div>
        </div>
      )}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={drop}
        // A click anywhere in the zone opens the file picker, as Import file… does. The button below is the keyboard way in, so the zone has no tab stop of its own.
        onClick={() => input.current?.click()}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-7 text-center transition-colors duration-(--duration-instant)',
          dragging ? 'border-primary bg-primary-subtle text-foreground' : 'border-strong text-muted-foreground hover:bg-accent',
        )}
      >
        <Upload className={cn('size-7', dragging && 'text-primary')} aria-hidden="true" />
        <p className="text-xs">{dragging ? 'Drop to import' : 'Drop a file here'}</p>
        <p className="text-[0.6875rem]">CSV, TSV, TXT or XLSX</p>
      </div>
      <p className="text-center text-xs text-muted-foreground">or</p>
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        hidden
        aria-label="Data file"
        onChange={(e) => {
          take(e.target.files?.[0])
          // So picking the same file again still counts.
          e.target.value = ''
        }}
      />
      <Button className="w-full" onClick={() => input.current?.click()}>
        <FileUp className="size-4" aria-hidden="true" />
        Import file…
      </Button>
      <Button className="w-full" onClick={onPaste}>
        <ClipboardPaste className="size-4" aria-hidden="true" />
        Paste from clipboard
      </Button>
      <p className="pt-1 text-xs text-muted-foreground">A preview opens first, so you can choose which columns to use.</p>
    </div>
  )
}

/** The small picture of a data set: bars in the group colours, or for groups of near-equal size (bars would all look alike) the first numbers. */
export function Preview({ groups, colours, className }: { groups: DataGroup[]; colours?: string[]; className?: string }) {
  const palette = colours && colours.length > 0 ? colours : SWATCHES
  const means = groups.map((g) => {
    const values = g.values.filter((v): v is number => v !== null)
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0
  })
  const top = Math.max(...means.map(Math.abs), 0)
  const bars = means.slice(0, 8).map((m) => (top > 0 ? Math.abs(m) / top : 0))
  const flat = bars.length < 2 || Math.min(...bars) >= 0.8
  if (flat) {
    const cells = [0, 1, 2].flatMap((r) => groups.slice(0, 2).map((g) => g.values[r]))
    return (
      <span className={cn('grid shrink-0 place-items-center overflow-hidden rounded-sm bg-muted px-1', className)} aria-hidden="true">
        <span className="grid grid-cols-2 gap-x-1.5 font-mono text-[7px] leading-tight text-muted-foreground tabular-nums">
          {cells.map((v, i) => (
            <span key={i}>{v === null || v === undefined ? '–' : v.toFixed(1)}</span>
          ))}
        </span>
      </span>
    )
  }
  return (
    <span className={cn('shrink-0 rounded-sm bg-muted p-1', className)} aria-hidden="true">
      <span className="flex h-full items-end gap-0.5">
        {bars.map((b, i) => (
          <span key={i} className="min-w-0.5 flex-1 rounded-[1px]" style={{ height: `${Math.max(b, 0.08) * 100}%`, background: palette[i % palette.length] }} />
        ))}
      </span>
    </span>
  )
}

type LibraryProps = {
  datasets: DataSetItem[] | undefined
  activeId?: string
  onUse: (id: string) => void
  onRename: (id: string, name: string) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
  onImport: () => void
}

function Library({ datasets, activeId, onUse, onRename, onDuplicate, onDelete, onImport }: LibraryProps) {
  const [query, setQuery] = useState('')
  const [renaming, setRenaming] = useState<string | null>(null)
  const shown = useMemo(() => (datasets ?? []).filter((d) => d.name.toLowerCase().includes(query.trim().toLowerCase())), [datasets, query])

  if (datasets === undefined) {
    return (
      <div className="flex flex-col gap-1" aria-busy="true" aria-label="Loading your data">
        <Skeleton className="mb-2 h-9 w-full" />
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-2.5 py-1.5">
            <Skeleton className="h-9 w-12" />
            <span className="flex flex-1 flex-col gap-1.5">
              <Skeleton shape="text" className="w-3/4" />
              <Skeleton shape="text" className="w-1/2" />
            </span>
          </div>
        ))}
      </div>
    )
  }
  if (datasets.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-8 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-muted text-muted-foreground">
          <Table2 className="size-7" aria-hidden="true" />
        </span>
        <p className="text-sm font-medium">Your data will be kept here</p>
        <p className="text-xs text-muted-foreground">Import a file or paste numbers, and you can use them again in any figure.</p>
        <Button variant="primary" size="sm" onClick={onImport}>
          <FileUp className="size-4" aria-hidden="true" />
          Import file…
        </Button>
      </div>
    )
  }
  return (
    <>
      <SearchField label="Search your data" placeholder="Search your data" value={query} onValueChange={setQuery} />
      <ul aria-label="Your data" className="mt-3 flex flex-col gap-1.5">
        {shown.map((d) => (
          <li key={d.id}>
            <div className={cn('flex items-center gap-2.5 rounded-md border py-2 pr-1 pl-2', d.id === activeId ? 'border-primary bg-primary-subtle' : 'hover:bg-muted')}>
              {renaming === d.id ? (
                <>
                  <Preview groups={d.groups} className="h-9 w-12" />
                  <RenameField
                    name={d.name}
                    onDone={(name) => {
                      setRenaming(null)
                      if (name !== undefined && name.trim() && name !== d.name) onRename(d.id, name)
                    }}
                  />
                </>
              ) : (
                <>
                  <button type="button" onClick={() => onUse(d.id)} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-sm text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                    <Preview groups={d.groups} className="h-9 w-12" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium" title={d.name}>
                        {d.name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {shortDate(d.updatedAt)} · {sizeText(d.groups)}
                      </span>
                    </span>
                    {d.id === activeId && <span className="shrink-0 rounded-sm bg-primary px-1.5 py-0.5 text-[0.6875rem] font-medium text-primary-foreground">In chart</span>}
                  </button>
                  <DropdownMenu
                    align="end"
                    trigger={<IconButton icon={MoreHorizontal} label={`More for ${d.name}`} size="sm" />}
                    sections={[
                      {
                        label: 'Data set',
                        actions: [
                          { label: 'Rename', icon: Pencil, onClick: () => setRenaming(d.id) },
                          { label: 'Duplicate', icon: Copy, onClick: () => onDuplicate(d.id) },
                        ],
                      },
                      { label: 'Remove', actions: [{ label: 'Delete', icon: Trash2, danger: true, onClick: () => onDelete(d.id) }] },
                    ]}
                  />
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
      {shown.length === 0 && <p className="px-2 py-6 text-center text-xs text-muted-foreground">Nothing called “{query}”.</p>}
    </>
  )
}

/** The name as a field in place of the row's text: Enter or leaving it keeps the new name, Escape keeps the old one. */
function RenameField({ name, onDone }: { name: string; onDone: (name: string | undefined) => void }) {
  const done = useRef(false)
  const finish = (value: string | undefined) => {
    if (done.current) return
    done.current = true
    onDone(value)
  }
  return (
    <input
      aria-label="Data set name"
      defaultValue={name}
      autoFocus
      onFocus={(e) => e.currentTarget.select()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') finish(e.currentTarget.value)
        if (e.key === 'Escape') finish(undefined)
      }}
      onBlur={(e) => finish(e.currentTarget.value)}
      className="h-(--control-height) min-w-0 flex-1 rounded-md border border-input-border bg-input px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
    />
  )
}
