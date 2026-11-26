/*
 * The chart text field (BIO-69, design B picked 2026-11-24) in the Graph
 * panel's Title & caption and Y/X-Axis sections. Type in it: Ctrl/⌘+= is
 * subscript, Ctrl/⌘+Shift+= superscript, Ω opens the symbols; the box under
 * the panel shows the text as the chart draws it and what is saved.
 */
import type { Meta, StoryObj } from '@storybook/react-vite'
import { AlignCenter, AlignLeft, AlignRight, ArrowDownToLine, ArrowUpToLine, ChevronLeft, Ruler, Type } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { SCRIPT_SCALE, SCRIPT_SHIFT, scriptsOf } from '../../lib/script-runs'
import { IconButton } from '../icon-button/IconButton'
import { ChartTextField, type ScriptText } from './ChartTextField'

const meta = {
  title: 'Components/Chart text field',
  parameters: { controls: { disable: true } },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const sub = (start: number, end: number) => ({ start, end, style: { script: 'sub' as const } })
const sup = (start: number, end: number) => ({ start, end, style: { script: 'super' as const } })

type Texts = { title: ScriptText; yTitle: ScriptText; yUnit: ScriptText; xTitle: ScriptText; caption: ScriptText }
const START: Texts = {
  title: { text: 'λGC = 2.53', runs: [sub(1, 3)] },
  yTitle: { text: '−log10(p)', runs: [sub(4, 6)] },
  yUnit: { text: 'mg·L-1', runs: [sup(4, 6)] },
  xTitle: { text: '[Ca2+] (µM)', runs: [sup(3, 5)] },
  caption: { text: ['Cells in 5% CO2', 'n = 3 per group'].join(String.fromCharCode(10)), runs: [sub(14, 15)] },
}

/* ---------- The panel around the field, as in the editor ---------- */

function SectionHeader({ icon: Icon, name }: { icon: typeof Type; name: string }) {
  return (
    <div className="flex h-12 shrink-0 items-center gap-2 px-2">
      <IconButton icon={ChevronLeft} label="Back to all chart settings" />
      <span className="grid size-6 shrink-0 place-items-center text-muted-foreground">
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 truncate text-sm font-semibold">{name}</span>
    </div>
  )
}

function Rows({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-[5.25rem_minmax(0,1fr)] items-center gap-x-13 gap-y-1.5 px-3 py-3">{children}</div>
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex min-w-0 items-center gap-1.5">{children}</div>
    </>
  )
}

/** The text as the chart draws it, to compare with the field. */
function Drawn({ value }: { value: ScriptText }) {
  const scripts = scriptsOf(value.text, value.runs)
  return (
    <span>
      {[...value.text].map((char, i) => {
        const script = scripts[i] ?? 'none'
        return script === 'none' ? (
          char
        ) : (
          <span key={i} style={{ fontSize: `${SCRIPT_SCALE}em`, verticalAlign: `${(-SCRIPT_SHIFT[script] / SCRIPT_SCALE).toFixed(3)}em` }}>
            {char}
          </span>
        )
      })}
    </span>
  )
}

function Panel() {
  const [texts, setTexts] = useState(START)
  const field = (key: keyof Texts, label: string, placeholder = 'None', multiline = false) => (
    <ChartTextField label={label} placeholder={placeholder} multiline={multiline} value={texts[key]} onChange={(value) => setTexts((t) => ({ ...t, [key]: value }))} className="min-w-0 flex-1" />
  )
  return (
    <section className="flex w-(--panel-left-width) shrink-0 flex-col gap-3">
      <div className="rounded-md border bg-panel">
        <SectionHeader icon={Type} name="Title & caption" />
        <Rows>
          <Row label="Name">{field('title', 'Chart name')}</Row>
          <Row label="">
            <IconButton icon={ArrowUpToLine} label="Name above the chart" pressed />
            <IconButton icon={ArrowDownToLine} label="Name below the chart" />
            <span className="w-2" />
            <IconButton icon={AlignLeft} label="Align left" pressed />
            <IconButton icon={AlignCenter} label="Align centre" />
            <IconButton icon={AlignRight} label="Align right" />
          </Row>
          <Row label="Caption">{field('caption', 'Text under the chart', 'e.g. Primers: GAPDH fw/rv', true)}</Row>
        </Rows>
      </div>
      <div className="rounded-md border bg-panel">
        <SectionHeader icon={Ruler} name="Y/X-Axis" />
        <Rows>
          <h4 className="col-span-2 text-sm font-semibold">Y axis</h4>
          <Row label="Label">{field('yTitle', 'Y axis title', 'e.g. Concentration')}</Row>
          <Row label="Unit">{field('yUnit', 'Custom y axis unit', 'e.g. copies/µL')}</Row>
          <h4 className="col-span-2 mt-3 border-t pt-4 text-sm font-semibold">X axis</h4>
          <Row label="Label">{field('xTitle', 'X axis title')}</Row>
        </Rows>
      </div>
      {/* The figure page stays white in dark mode, so its text keeps fixed colours. */}
      <div className="rounded-md border bg-white p-3 text-[#111827]">
        <div className="mb-1 text-2xs font-semibold tracking-wide text-[#4b5563] uppercase">On the chart</div>
        <div className="flex flex-col gap-1 text-sm">
          <b><Drawn value={texts.title} /></b>
          <span>
            Y: <Drawn value={texts.yTitle} /> (<Drawn value={texts.yUnit} />)
          </span>
          <span>X: <Drawn value={texts.xTitle} /></span>
          <span className="whitespace-pre-wrap"><Drawn value={texts.caption} /></span>
        </div>
        <pre className="mt-2 text-2xs whitespace-pre-wrap text-[#4b5563]">saved: {JSON.stringify(texts.title)}</pre>
      </div>
    </section>
  )
}

/** In the Graph panel's sections, as in the editor. */
export const InThePanel: Story = {
  render: () => (
    <div className="bg-canvas p-6 text-sm text-foreground">
      <Panel />
    </div>
  ),
}

/** With the Ω popup open. */
export const PopupOpen: Story = {
  render: () => (
    <div className="h-[34rem] bg-canvas p-6 text-sm text-foreground">
      <div className="w-56">
        <ChartTextField label="Y axis title" value={START.yTitle} onChange={() => {}} />
      </div>
    </div>
  ),
  play: ({ canvasElement }) => {
    canvasElement.querySelector<HTMLButtonElement>('button[aria-label^="Subscript, superscript"]')?.click()
  },
}
