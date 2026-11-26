/*
 * Runs an export in the background. The figure is copied the moment you press
 * Export, so you can keep editing; a toast shows the progress with a Cancel
 * button, then "Exported" once the file is downloaded. The export code loads
 * the first time it's needed.
 */
import type { ExportSettings } from '@biofigure-lab/export/export-figure'
import { useToast } from '@biofigure-lab/ui/components/toast/Toast'
import { useCallback } from 'react'

import { emitAppEvent } from '../app-events'
import { debugTargets, fakeProgress } from '../debug/debug-targets'
import { loadExportFonts } from '../editor/export-fonts'
import type { PageMm } from '../editor/page-size'

/** A file name without characters Windows or macOS refuse. */
export const safeFileName = (name: string) => name.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'figure'

function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  // Some browsers start the download a moment after the click.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export function useExport() {
  const toasts = useToast()

  return useCallback(
    (job: { svg: string | string[]; pageMm: PageMm; settings: ExportSettings; name: string }) => {
      const format = job.settings.format
      // Several slides as PNG or SVG make one file each; a PDF holds them all.
      const pages = format === 'pdf' ? [job.svg] : [job.svg].flat()
      const fileName = (index: number) => `${safeFileName(job.name)}${pages.length > 1 ? ` - slide ${index + 1}` : ''}.${format}`
      const title = pages.length > 1 ? `${pages.length} ${format.toUpperCase()} files` : fileName(0)
      const controller = new AbortController()
      const id = toasts.add({
        title: `Exporting ${title}`,
        description: '0%',
        timeout: 0,
        data: { progress: 0 },
        actionProps: { children: 'Cancel', onClick: () => controller.abort() },
        // Closing the toast with × cancels too.
        onClose: () => controller.abort(),
      })
      const showProgress = (progress: number) => toasts.update(id, { description: `${Math.round(progress * 100)}%`, data: { progress } })
      const run = async () => {
        // The debug panel can slow exports down, to watch the progress bar.
        const delay = import.meta.env.DEV ? debugTargets.exportDelayMs : 0
        const share = delay > 0 ? 0.5 : 0
        if (delay > 0) await fakeProgress(delay, share, controller.signal, showProgress)
        const { exportFigure } = await import('@biofigure-lab/export')
        for (const [index, svg] of pages.entries()) {
          const blob = await exportFigure({
            ...job,
            svg,
            loadFonts: loadExportFonts,
            signal: controller.signal,
            onProgress: (fraction) => showProgress(share + ((index + fraction) / pages.length) * (1 - share)),
          })
          download(blob, fileName(index))
        }
      }
      run().then(
        () => {
          emitAppEvent({ name: 'export', value: format })
          toasts.update(id, { title: `Exported ${title}`, description: 'Saved to your downloads', timeout: 5000, data: {}, actionProps: undefined, onClose: undefined })
        },
        (error: unknown) => {
          if (controller.signal.aborted) return toasts.close(id)
          toasts.update(id, {
            title: 'Export failed',
            description: error instanceof Error ? error.message : 'Something went wrong',
            timeout: 10_000,
            data: {},
            actionProps: undefined,
            onClose: undefined,
          })
        },
      )
    },
    [toasts],
  )
}
