/*
 * Export: pick a file type (and for PNG a resolution), then Export. The panel
 * opens from the right so the figure stays in view, and closes as soon as you
 * press Export; the export itself carries on in a progress toast. You can
 * export the current slide or all slides.
 */
import type { ExportFormat, ExportSettings } from '@biofigure-lab/export/export-figure'
import { PNG_DPIS, pngSize, type PngDpi } from '@biofigure-lab/export/sizing'
import { Button } from '@biofigure-lab/ui/components/button/Button'
import { Dialog, DialogClose } from '@biofigure-lab/ui/components/dialog/Dialog'
import { Select } from '@biofigure-lab/ui/components/select/Select'
import { Toggle } from '@biofigure-lab/ui/components/toggle/Toggle'

import type { PageMm } from '../editor/page-size'

const FORMAT_OPTIONS: { value: ExportFormat; label: string; detail: string }[] = [
  { value: 'png', label: 'PNG', detail: 'An image, for Word, slides and most journals' },
  { value: 'svg', label: 'SVG', detail: 'Vector, for further editing in a vector graphics app' },
  { value: 'pdf', label: 'PDF', detail: 'Vector, for print and journals that ask for it' },
]

type ExportDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  pageMm: PageMm
  settings: ExportSettings
  onSettingsChange: (settings: ExportSettings) => void
  onExport: () => void
  slideCount: number
  /** Export every slide instead of the one showing. */
  allSlides: boolean
  onAllSlidesChange: (all: boolean) => void
}

export function ExportDialog({ open, onOpenChange, pageMm, settings, onSettingsChange, onExport, slideCount, allSlides, onAllSlidesChange }: ExportDialogProps) {
  const change = (patch: Partial<ExportSettings>) => onSettingsChange({ ...settings, ...patch })
  const dpiOptions = PNG_DPIS.map((dpi) => {
    const size = pngSize(pageMm, dpi)
    return { value: String(dpi), label: `${dpi} dpi`, detail: `${size.width} × ${size.height} px` }
  })

  return (
    <Dialog
      title="Export"
      description={`${pageMm.width} × ${pageMm.height} mm. Text is turned into outlines, so it looks the same everywhere.`}
      placement="side"
      open={open}
      onOpenChange={onOpenChange}
      actions={
        <>
          <DialogClose render={<Button>Cancel</Button>} />
          <Button variant="primary" onClick={onExport}>
            Export
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {slideCount > 1 && (
          <Select
            label="Slides"
            labelPosition="above"
            options={[
              { value: 'current', label: 'Current slide' },
              {
                value: 'all',
                label: `All ${slideCount} slides`,
                detail: settings.format === 'pdf' ? 'One PDF with a page per slide' : 'One file per slide',
              },
            ]}
            value={allSlides ? 'all' : 'current'}
            onValueChange={(value) => onAllSlidesChange(value === 'all')}
          />
        )}
        <Select label="File type" labelPosition="above" options={FORMAT_OPTIONS} value={settings.format} onValueChange={(format) => change({ format })} />
        {/* The resolution row keeps its space for SVG and PDF, so nothing below jumps when the type changes. */}
        <div className={settings.format === 'png' ? undefined : 'invisible'} aria-hidden={settings.format !== 'png'}>
          <Select
            label="Resolution"
            labelPosition="above"
            options={dpiOptions}
            value={String(settings.dpi)}
            onValueChange={(dpi) => change({ dpi: Number(dpi) as PngDpi })}
            disabled={settings.format !== 'png'}
          />
        </div>
        <Toggle
          label="Transparent background"
          description="Leave out the white page behind the figure."
          checked={settings.transparent}
          onCheckedChange={(transparent) => change({ transparent })}
        />
      </div>
    </Dialog>
  )
}
