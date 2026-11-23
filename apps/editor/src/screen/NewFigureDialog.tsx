/*
 * New figure: pick a journal column width from cards that show it on a page,
 * or type your own size, then Create. The same dialog changes the size of an
 * open figure ("Custom size…" above the canvas), with its own title and button.
 */
import { Button } from '@biofigure-lab/ui/components/button/Button'
import { Dialog, DialogClose } from '@biofigure-lab/ui/components/dialog/Dialog'
import { OptionCards } from '@biofigure-lab/ui/components/option-cards/OptionCards'
import { PageSizeIcon } from '@biofigure-lab/ui/components/page-size-icon/PageSizeIcon'
import { TextField } from '@biofigure-lab/ui/components/text-field/TextField'
import { useState, type ReactElement } from 'react'

import { DEFAULT_PAGE, defaultHeight, mmError, PAGE_PRESETS, parseMm, presetFor, type PageMm, type PagePresetId } from '../editor/page-size'

type Choice = PagePresetId | 'custom'

const PRESET_OPTIONS = PAGE_PRESETS.map((preset) => ({
  value: preset.id,
  label: preset.label,
  detail: `${preset.page.width} × ${preset.page.height} mm`,
  picture: <PageSizeIcon width={preset.page.width} height={preset.page.height} />,
}))

type NewFigureDialogProps = {
  trigger?: ReactElement
  /** Open it from outside instead of with a trigger. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onCreate: (page: PageMm) => void
  /** The size it opens with. */
  initial?: PageMm
  title?: string
  description?: string
  submitLabel?: string
}

export function NewFigureDialog({
  trigger,
  open: openProp,
  onOpenChange,
  onCreate,
  initial = DEFAULT_PAGE,
  title = 'New figure',
  description = 'Pick a journal column width, or type your own size.',
  submitLabel = 'Create',
}: NewFigureDialogProps) {
  const [openState, setOpenState] = useState(false)
  const open = openProp ?? openState
  const setOpen = (next: boolean) => {
    setOpenState(next)
    onOpenChange?.(next)
  }
  const [width, setWidth] = useState(String(initial.width))
  const [height, setHeight] = useState(String(initial.height))
  // Until you type a height yourself, it follows the width.
  const [heightTyped, setHeightTyped] = useState(false)
  const [customPicked, setCustomPicked] = useState(false)
  // Errors show once you've tried to create, not while you're still typing.
  const [tried, setTried] = useState(false)
  // Each time it opens it starts again from `initial`.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setWidth(String(initial.width))
      setHeight(String(initial.height))
      setHeightTyped(false)
      setCustomPicked(false)
      setTried(false)
    }
  }

  const typed = { width: parseMm(width), height: parseMm(height) }
  const preset = typed.width !== undefined && typed.height !== undefined ? presetFor({ width: typed.width, height: typed.height }) : undefined
  const choice: Choice = customPicked ? 'custom' : (preset ?? 'custom')

  const pick = (next: Choice) => {
    const picked = PAGE_PRESETS.find((item) => item.id === next)
    // Custom keeps the numbers already there, ready to change.
    setCustomPicked(!picked)
    if (!picked) return
    setWidth(String(picked.page.width))
    setHeight(String(picked.page.height))
    setHeightTyped(false)
  }

  const changeWidth = (text: string) => {
    setWidth(text)
    setCustomPicked(false)
    const mm = parseMm(text)
    if (!heightTyped && mm !== undefined && !mmError(text)) setHeight(String(defaultHeight(mm)))
  }

  const create = () => {
    setTried(true)
    if (mmError(width) || mmError(height) || typed.width === undefined || typed.height === undefined) return
    setOpen(false)
    onCreate({ width: typed.width, height: typed.height })
  }

  return (
    <Dialog
      title={title}
      description={description}
      trigger={trigger}
      open={open}
      onOpenChange={setOpen}
      actions={
        <>
          <DialogClose render={<Button>Cancel</Button>} />
          <Button variant="primary" type="submit" form="new-figure">
            {submitLabel}
          </Button>
        </>
      }
    >
      <form
        id="new-figure"
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          create()
        }}
      >
        <OptionCards
          label="Page size"
          value={choice}
          onValueChange={pick}
          options={[
            ...PRESET_OPTIONS,
            {
              value: 'custom',
              label: 'Custom',
              // The Custom card shows the typed size once there is one.
              detail: choice === 'custom' && typed.width !== undefined && typed.height !== undefined ? `${typed.width} × ${typed.height} mm` : 'Your own size',
              picture: <PageSizeIcon width={typed.width ?? 0} height={typed.height ?? 0} dashed={choice !== 'custom'} />,
            },
          ]}
        />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Width" suffix="mm" inputMode="decimal" value={width} onChange={(event) => changeWidth(event.target.value)} error={tried ? mmError(width) : undefined} />
          <TextField label="Height" suffix="mm" inputMode="decimal" value={height} onChange={(event) => {
              setHeight(event.target.value)
              setHeightTyped(true)
              setCustomPicked(false)
            }} error={tried ? mmError(height) : undefined} />
        </div>
      </form>
    </Dialog>
  )
}
