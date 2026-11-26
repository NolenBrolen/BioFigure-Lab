/*
 * The Data section of a selected chart, connected to the app: reads files and
 * pasted text, keeps the saved data sets (Your data) in the browser, and puts
 * a data set into the chart as one undo step. The look is `ChartDataSection`
 * and `ImportPreview` in packages/ui; this hook supplies their data and what
 * the buttons do.
 *
 * Nothing blocks: a big file reads in the background with Cancel, and
 * deleting a data set happens at once with an Undo toast.
 */
import { ChartDataSection } from '@biofigure-lab/ui/components/graph-panel/ChartDataSection'
import { ImportPreview } from '@biofigure-lab/ui/components/graph-panel/ImportPreview'
import { useToast } from '@biofigure-lab/ui/components/toast/Toast'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

import type { FigureCanvas } from '../editor/FigureCanvas'
import type { ChartData, ChartGroup } from '../editor/chart-model'
import { buildGroups, ImportCancelled, importTools, pastedName, readFile, readText, type ImportChoice, type ImportSheet } from '../editor/data-import'
import type { DataSet, DatasetStore } from '../editor/storage'
import { importedRowNames } from '../editor/chart-heatmap'
import { announceChartGrew } from './chart-grew-toast'

/** Only files bigger than this show a progress line; smaller ones are read before it would show. */
const SHOW_PROGRESS_FROM = 500_000

type Pending = { fileName: string; sheets: ImportSheet[] }
type Importing = { name: string; fraction: number | null; size: string }

const megabytes = (bytes: number) => `${Math.max(bytes / 1_000_000, 0.1).toFixed(1)} MB`

export function useChartData(figure: FigureCanvas | null, chart: ChartData | undefined, store: DatasetStore, data: { onEditData: () => void; dataOpen: boolean; onCloseData: () => void }): { section: ReactNode; dialog: ReactNode } {
  const toasts = useToast()
  const [datasets, setDatasets] = useState<DataSet[] | undefined>(undefined)
  const [pending, setPending] = useState<Pending | undefined>(undefined)
  const [importing, setImporting] = useState<Importing | undefined>(undefined)
  const reading = useRef<AbortController | undefined>(undefined)

  const reload = useCallback(() => store.list().then(setDatasets, () => setDatasets([])), [store])
  useEffect(() => {
    void reload()
  }, [reload])

  /** Put numbers into the chart, keeping its colours and settings: one undo step. */
  const putInChart = (set: Pick<DataSet, 'id' | 'name'>, groups: ChartGroup[], importedAt: number, rowNames?: string[]) => {
    // A heatmap takes the rows' names from the import too; a saved data set has none, so its rows are numbered.
    const names = (current: ChartData) => (current.kind === 'heatmap' ? { rowNames } : {})
    announceChartGrew(toasts, figure, figure?.updateChart((current) => ({ ...current, groups, ...names(current), source: { id: set.id, name: set.name, importedAt } }), true, undefined, true))
  }

  const importFile = async (file: File) => {
    reading.current?.abort()
    const controller = new AbortController()
    reading.current = controller
    if (file.size > SHOW_PROGRESS_FROM) setImporting({ name: file.name, fraction: null, size: megabytes(file.size) })
    try {
      const sheets = await readFile(file, {
        signal: controller.signal,
        onProgress: (fraction) => setImporting((now) => now && { ...now, fraction }),
      })
      setPending({ fileName: file.name, sheets })
    } catch (error) {
      if (!(error instanceof ImportCancelled)) toasts.add({ title: `Couldn't read ${file.name}`, description: 'Is it a CSV, TSV, TXT or XLSX file?' })
    } finally {
      if (reading.current === controller) {
        reading.current = undefined
        setImporting(undefined)
      }
    }
  }

  const paste = async () => {
    try {
      const rows = readText(await navigator.clipboard.readText())
      if (rows.length === 0) {
        toasts.add({ title: 'Nothing to paste', description: 'Copy some cells from a spreadsheet first.' })
        return
      }
      setPending({ fileName: pastedName(new Date()), sheets: [{ name: 'Pasted', rows }] })
    } catch {
      toasts.add({ title: "Couldn't read the clipboard", description: 'The browser needs your permission to paste.' })
    }
  }

  const applyChoice = async (choice: ImportChoice) => {
    if (!pending) return
    const sheet = pending.sheets.find((s) => s.name === choice.sheet) ?? pending.sheets[0]
    const groups = buildGroups(sheet?.rows ?? [], choice)
    if (groups.length === 0) return
    const name = pending.sheets.length > 1 ? `${pending.fileName} (${sheet?.name})` : pending.fileName
    setPending(undefined)
    const saved = await store.add(name, groups)
    putInChart(saved, groups, saved.createdAt, importedRowNames(sheet?.rows ?? [], choice))
    void reload()
  }

  const remove = async (id: string) => {
    const removed = await store.remove(id)
    void reload()
    if (!removed) return
    const toastId = toasts.add({
      title: `Deleted ${removed.name}`,
      actionProps: {
        children: 'Undo',
        onClick: () => {
          toasts.close(toastId)
          void store.restore(removed).then(reload)
        },
      },
    })
  }

  const section = chart && (
    <ChartDataSection
      groups={chart.groups}
      colours={chart.colours}
      source={chart.source}
      datasets={datasets}
      importing={importing}
      onEditData={data.onEditData}
      dataOpen={data.dataOpen}
      onCloseData={data.onCloseData}
      onImportFile={(file) => void importFile(file)}
      onPaste={() => void paste()}
      onUseDataset={(id) => {
        const set = datasets?.find((d) => d.id === id)
        if (set) putInChart(set, set.groups, set.updatedAt)
      }}
      onRename={(id, name) => void store.rename(id, name).then(reload)}
      onDuplicate={(id) => void store.duplicate(id).then(reload)}
      onDelete={(id) => void remove(id)}
      onCancelImport={() => reading.current?.abort()}
    />
  )
  const dialog = pending && chart && (
    <ImportPreview key={pending.fileName} open fileName={pending.fileName} sheets={pending.sheets} tools={importTools} colours={chart.colours} onUse={(choice) => void applyChoice(choice)} onCancel={() => setPending(undefined)} />
  )
  return { section, dialog }
}
