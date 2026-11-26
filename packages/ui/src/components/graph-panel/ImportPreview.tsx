/*
 * Import preview: the window that opens after a data file is picked or
 * numbers are pasted, so you can check how they read before they go into the
 * chart (design E of two drafts, 2026-11-20: the options on the left, the
 * table on the right). It shows the first rows; the options change the table
 * at once.
 *   - Sheet: only when the file has several.
 *   - First row is group names: on when the first row looks like names.
 *   - Groups are in Columns or Rows (Rows turns the table on its side).
 *   - A tick box on each column header: untick to leave that column out.
 * "Import" hands back the choices; turning them into groups is the
 * app's job (`tools` does the table work, so this stays plain interface).
 */
import { FileSpreadsheet } from 'lucide-react'
import { useState } from 'react'

import { cn } from '../../lib/cn'
import { Button } from '../button/Button'
import { Dialog, DialogClose } from '../dialog/Dialog'
import { SegmentedToggle } from '../segmented-toggle/SegmentedToggle'
import { Select } from '../select/Select'
import { Toggle } from '../toggle/Toggle'

export type ImportOrientation = 'columns' | 'rows'

/** One sheet of a file as a table of text cells (a text file has one). */
export type ImportSheet = { name: string; rows: string[][] }

/** What was chosen in the preview. `leftOut` counts columns of the table as shown (turned on its side for `rows`). */
export type ImportChoice = { sheet: string; header: boolean; orientation: ImportOrientation; leftOut: number[] }

/** The table work the preview needs, supplied by the app (it knows how numbers are read). */
export type ImportTools = {
  /** The table with groups running down its columns. */
  orient: (rows: string[][], orientation: ImportOrientation) => string[][]
  looksLikeHeader: (rows: string[][], orientation: ImportOrientation) => boolean
  /** Columns without a single number: they start out left out. */
  textColumns: (rows: string[][], orientation: ImportOrientation, header: boolean) => boolean[]
}

export type ImportPreviewProps = {
  open: boolean
  fileName: string
  sheets: ImportSheet[]
  tools: ImportTools
  /** The colours of the groups, in turn. */
  colours?: string[]
  onUse: (choice: ImportChoice) => void
  /** Cancel, Escape or the close button. */
  onCancel: () => void
}

const COLOURS = ['#0072B2', '#E69F00', '#009E73', '#CC79A7', '#56B4E9', '#D55E00', '#F0E442', '#000000']
const SHOWN_ROWS = 8

/** Mount it while an import waits for its preview, with a new `key` for each file: its choices start afresh each time. */
export function ImportPreview({ open, fileName, sheets, tools, colours = COLOURS, onUse, onCancel }: ImportPreviewProps) {
  const [sheetName, setSheetName] = useState(sheets[0]?.name ?? '')
  const sheet = sheets.find((s) => s.name === sheetName) ?? sheets[0]
  const rows = sheet?.rows ?? []
  const [orientation, setOrientation] = useState<ImportOrientation>('columns')
  const [header, setHeader] = useState(() => tools.looksLikeHeader(rows, 'columns'))
  // null: the columns left out are the default ones (no numbers); the first tick changes that into the user's own list.
  const [picked, setPicked] = useState<number[] | null>(null)

  const table = tools.orient(rows, orientation)
  const defaultLeftOut = tools.textColumns(rows, orientation, header).flatMap((text, i) => (text ? [i] : []))
  const leftOut = picked ?? defaultLeftOut
  const width = table[0]?.length ?? 0
  const names = header ? (table[0] ?? []) : []
  const body = header ? table.slice(1) : table
  const kept = Array.from({ length: width }, (_, c) => c).filter((c) => !leftOut.includes(c))
  const more = body.length - SHOWN_ROWS

  const changeSheet = (name: string) => {
    const next = sheets.find((s) => s.name === name)
    setSheetName(name)
    setPicked(null)
    setOrientation('columns')
    setHeader(tools.looksLikeHeader(next?.rows ?? [], 'columns'))
  }
  const changeOrientation = (next: ImportOrientation) => {
    setOrientation(next)
    setPicked(null)
    setHeader(tools.looksLikeHeader(rows, next))
  }
  const toggle = (c: number) => setPicked(leftOut.includes(c) ? leftOut.filter((i) => i !== c) : [...leftOut, c])

  const use = () => onUse({ sheet: sheet?.name ?? '', header, orientation, leftOut })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && onCancel()}
      size="wide"
      title="Import data"
      actions={
        <>
          <DialogClose render={<Button variant="ghost" />}>Cancel</DialogClose>
          <Button variant="primary" disabled={kept.length === 0} onClick={use}>
            Import
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-[17rem_minmax(0,1fr)] gap-6 max-md:grid-cols-1">
        <div className="flex flex-col gap-4 border-r pr-6 max-md:border-r-0 max-md:pr-0">
          {sheets.length > 1 && (
            <Select
              label="Sheet"
              labelPosition="above"
              options={sheets.map((s) => ({ value: s.name, label: s.name, detail: `${s.rows.length} rows × ${Math.max(0, ...s.rows.map((r) => r.length))} columns` }))}
              value={sheet?.name}
              onValueChange={changeSheet}
            />
          )}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Groups are in</span>
            <SegmentedToggle
              label="Groups are in"
              showLabels
              value={orientation}
              onValueChange={changeOrientation}
              options={[
                { value: 'columns', label: 'Columns' },
                { value: 'rows', label: 'Rows' },
              ]}
            />
          </div>
          <div className="rounded-md border p-3">
            <Toggle label="First row is group names" checked={header} onCheckedChange={setHeader} />
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-2">
        <div className="text-sm">
          <p className="flex items-center gap-2">
            <FileSpreadsheet className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
            <span className="truncate font-medium">{fileName}</span>
          </p>
          {/* Starts under the name's text, not under the icon. */}
          <p className="pl-[1.375rem] text-xs text-muted-foreground">
            {rows.length} rows × {Math.max(0, ...rows.map((r) => r.length))} columns
          </p>
        </div>
        <div className="min-w-0 overflow-auto rounded-md border [scrollbar-width:thin]">
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="bg-muted">
                {table[0]?.map((_, c) => {
                  const out = leftOut.includes(c)
                  const label = names[c]?.trim() || `Column ${c + 1}`
                  return (
                    <th key={c} className={cn('border-b px-3 py-2 text-left font-medium', out && 'text-muted-foreground')}>
                      <label className="flex cursor-pointer items-center gap-2">
                        <input type="checkbox" className="size-4 shrink-0 accent-primary" checked={!out} onChange={() => toggle(c)} aria-label={`Use ${label}`} />
                        <span className="size-2 shrink-0 rounded-full" style={{ background: out ? 'transparent' : colours[kept.indexOf(c) % colours.length] }} aria-hidden="true" />
                        <span className={cn('max-w-40 truncate', out && 'line-through')}>{label}</span>
                      </label>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {body.slice(0, SHOWN_ROWS).map((row, r) => (
                <tr key={r} className="border-b last:border-b-0">
                  {row.map((cell, c) => (
                    <td key={c} className={cn('max-w-40 truncate px-3 py-1.5', leftOut.includes(c) && 'text-muted-foreground/50')}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
              {more > 0 && (
                <tr>
                  <td colSpan={Math.max(width, 1)} className="px-3 py-1.5 text-xs text-muted-foreground">
                    <span className="sticky left-3">… {more} more rows</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        </div>
      </div>
    </Dialog>
  )
}
