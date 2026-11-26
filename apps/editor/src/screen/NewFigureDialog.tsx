/*
 * New figure: pick a journal column width from cards that show it on a page,
 * or type your own size, then Create. On the start screen a second tab,
 * "From a template", starts a copy of a finished figure instead. The same dialog changes the size of an
 * open figure ("Custom size…" above the canvas), with its own title and button.
 */
import { Button } from '@biofigure-lab/ui/components/button/Button'
import { Dialog, DialogClose } from '@biofigure-lab/ui/components/dialog/Dialog'
import { OptionCards } from '@biofigure-lab/ui/components/option-cards/OptionCards'
import { PageSizeIcon } from '@biofigure-lab/ui/components/page-size-icon/PageSizeIcon'
import { Skeleton } from '@biofigure-lab/ui/components/skeleton/Skeleton'
import { Tabs, TabsPanel } from '@biofigure-lab/ui/components/tabs/Tabs'
import { TemplateCards } from '@biofigure-lab/ui/components/template-cards/TemplateCards'
import { TextField } from '@biofigure-lab/ui/components/text-field/TextField'
import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react'

import type { FigureFile, Template } from '../templates/templates'
import { DEFAULT_PAGE, defaultHeight, mmError, PAGE_PRESETS, parseMm, presetFor, type PageMm, type PagePresetId } from '../editor/page-size'

type Choice = PagePresetId | 'custom'

const PRESET_OPTIONS = PAGE_PRESETS.map((preset) => ({
  value: preset.id,
  label: preset.label,
  detail: `${preset.page.width} × ${preset.page.height} mm`,
  picture: <PageSizeIcon width={preset.page.width} height={preset.page.height} />,
}))

/** Room around the content for focus rings, in px. */
const FOCUS_ROOM = 4

/**
 * Lets its height follow its content over the same 200 ms as the dialog's
 * width, so a tab switch grows or shrinks both together. The padding and
 * matching negative margin keep focus rings from being clipped (FOCUS_ROOM
 * matches the wrapper's `p-1`).
 */
function AnimatedHeight({ children }: { children: ReactNode }) {
  const inner = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number>()
  useEffect(() => {
    const element = inner.current
    if (!element) return
    const watch = new ResizeObserver(() => setHeight(element.offsetHeight + 2 * FOCUS_ROOM))
    watch.observe(element)
    return () => watch.disconnect()
  }, [])
  return (
    <div style={{ height }} className="-m-1 overflow-hidden p-1 transition-[height] duration-200 ease-enter">
      <div ref={inner}>{children}</div>
    </div>
  )
}

/** Template pictures: each file is read once, then kept. */
const previews = new Map<string, Promise<FigureFile>>()
const preview = (template: Template) => {
  let found = previews.get(template.id)
  if (!found) previews.set(template.id, (found = template.load()))
  return found
}

type NewFigureDialogProps = {
  /** Templates to offer in a second tab; none: just the page sizes. */
  templates?: readonly Template[]
  onCreateTemplate?: (template: Template) => void
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
  templates,
  onCreateTemplate,
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
  const [tab, setTab] = useState('blank')
  const [templateId, setTemplateId] = useState<string>()
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
      setTab('blank')
      setTemplateId(undefined)
    }
  }

  const [pictures, setPictures] = useState<Record<string, string | undefined>>({})
  // The pictures are read when the template tab first opens, not before.
  useEffect(() => {
    if (!open || tab !== 'template' || !templates) return
    for (const template of templates) {
      void preview(template).then(
        (file) => setPictures((all) => ({ ...all, [template.id]: file.thumbnail ?? file.slides[0]?.thumbnail })),
        () => undefined,
      )
    }
  }, [open, tab, templates])

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
    const template = templates?.find((item) => item.id === templateId)
    if (tab === 'template' && template && onCreateTemplate) {
      setOpen(false)
      onCreateTemplate(template)
      return
    }
    // The template tab with nothing picked yet: nothing to create.
    if (tab === 'template' && templates) return
    setTried(true)
    if (mmError(width) || mmError(height) || typed.width === undefined || typed.height === undefined) return
    setOpen(false)
    onCreate({ width: typed.width, height: typed.height })
  }

  const pageSizeFields = (
    <>
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
    </>
  )

  return (
    <Dialog
      title={title}
      description={description}
      trigger={trigger}
      size={tab === 'template' && templates ? 'wide' : 'default'}
      open={open}
      onOpenChange={setOpen}
      actions={
        <>
          <DialogClose render={<Button>Cancel</Button>} />
          <Button variant="primary" type="submit" form="new-figure" disabled={!!templates && tab === 'template' && !templateId}>
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
        {templates && onCreateTemplate ? (
          <Tabs
            label="Start from"
            value={tab}
            onValueChange={setTab}
            tabs={[
              { value: 'blank', label: 'Blank' },
              { value: 'template', label: 'From a template' },
            ]}
            // pb-1: the wrapper's negative bottom margin would otherwise let it poke out and add a scrollbar.
            className="gap-4 pb-1"
          >
            <AnimatedHeight>
              <TabsPanel value="blank" className="flex flex-col gap-4 animate-panel-in">
                {pageSizeFields}
              </TabsPanel>
              <TabsPanel value="template" className="animate-panel-in">
                <TemplateCards
                  label="Template"
                  value={templateId ?? ''}
                  onValueChange={setTemplateId}
                  options={templates.map((template) => ({
                    value: template.id,
                    label: template.name,
                    detail: template.detail,
                    picture: pictures[template.id] ? <img src={pictures[template.id]} alt="" /> : <Skeleton className="size-full" />,
                  }))}
                />
              </TabsPanel>
            </AnimatedHeight>
          </Tabs>
        ) : (
          pageSizeFields
        )}
      </form>
    </Dialog>
  )
}
