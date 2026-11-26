/*
 * BIO-83 design drafts: panel letters on Panel blocks, sharing one count with
 * the figure grids' letters. Visual drafts only: no tests, no accessibility
 * pass, nothing wired up. After the owner picks, the chosen version gets
 * built properly in the editor.
 *
 * Every version shows slide 2 of a figure: a panel block (selected) and a
 * second one, plus a figure grid with two charts. All of them are lettered
 * in one reading order. The settings that act on every letter of the slide
 * (style, weight, size, numbering) are the same in each version; the grid's
 * properties would get the same section. "Numbering" only shows from slide 2
 * on (use the Slide 1 / Slide 2 switch at the top to see it go).
 *
 *   A  Outside corner  The letter sits just outside the panel's top-left
 *                      corner, exactly where a grid puts its letters. A
 *                      Letter row in the panel's properties, then a
 *                      "Letters on this slide" section.
 *   B  In the title    The letter leads the panel's title in its header
 *                      ("E  Workflow"). Grids keep their letters outside
 *                      the corner. The letter is a button in the Title row.
 *   C  Letter tab      The letter sits in a small tab in the panel's colour
 *                      on its top-left corner (grid cells get a dark tab).
 *                      A Letters tab in the properties lists every letter on
 *                      the slide in order.
 */
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ArrowLeft, Eye, EyeOff, LayoutGrid, LayoutPanelTop, Ungroup } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { Button } from '../../components/button/Button'
import { SegmentedToggle } from '../../components/segmented-toggle/SegmentedToggle'
import { Slider } from '../../components/slider/Slider'

const meta = {
  title: 'Drafts/BIO-83 Panel letters',
  parameters: { controls: { disable: true }, layout: 'fullscreen' },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

/* ---------- Letters ---------- */

type LetterStyle = 'capital' | 'small' | 'brackets' | 'stop'
type Numbering = 'continue' | 'restart'
type Letters = { style: LetterStyle; bold: boolean; size: number; numbering: Numbering }

const STYLES: { id: LetterStyle; name: string }[] = [
  { id: 'capital', name: 'Capital' },
  { id: 'small', name: 'Small' },
  { id: 'brackets', name: 'Brackets' },
  { id: 'stop', name: 'Full stop' },
]

function letterText(index: number, style: LetterStyle) {
  const l = String.fromCharCode(65 + index)
  switch (style) {
    case 'capital':
      return l
    case 'small':
      return l.toLowerCase()
    case 'brackets':
      return `(${l})`
    case 'stop':
      return `${l}.`
  }
}

/** Slide 1 of the made-up figure holds four letters, so slide 2 goes on at E. */
const SLIDE_ONE_COUNT = 4

/* ---------- The page: two panels and a grid of two charts ---------- */

type Look = 'outside' | 'title' | 'tab'
type Box = { x: number; y: number; w: number; h: number }
type Thing = { id: string; kind: 'panel' | 'cell'; name: string; box: Box; colour: string; chart?: 'bar' | 'line' }

const BLUE = '#0072b2'
const TEAL = '#009e73'
const INK = '#18181b'

const THINGS: Thing[] = [
  { id: 'workflow', kind: 'panel', name: 'Workflow', box: { x: 40, y: 60, w: 250, h: 160 }, colour: BLUE },
  { id: 'bars', kind: 'cell', name: 'Bar chart', box: { x: 320, y: 60, w: 115, h: 160 }, colour: INK, chart: 'bar' },
  { id: 'lines', kind: 'cell', name: 'Line chart', box: { x: 455, y: 60, w: 115, h: 160 }, colour: INK, chart: 'line' },
  { id: 'model', kind: 'panel', name: 'Model', box: { x: 40, y: 262, w: 530, h: 118 }, colour: TEAL },
]
const PAGE = { w: 610, h: 410 }
const ZOOM = 1.35

function wash(hex: string, share: number) {
  const n = parseInt(hex.slice(1), 16)
  const parts = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round(255 - (255 - c) * share))
  return `rgb(${parts.join(',')})`
}

function MiniChart({ box, kind }: { box: Box; kind: 'bar' | 'line' }) {
  const plot = { x: box.x + 18, y: box.y + 14, w: box.w - 26, h: box.h - 34 }
  const values = kind === 'bar' ? [0.45, 0.8, 0.62] : [0.2, 0.42, 0.55, 0.78, 0.7]
  const colours = ['#0072b2', '#e69f00', '#009e73']
  return (
    <g>
      <line x1={plot.x} y1={plot.y} x2={plot.x} y2={plot.y + plot.h} stroke="#3f3f46" />
      <line x1={plot.x} y1={plot.y + plot.h} x2={plot.x + plot.w} y2={plot.y + plot.h} stroke="#3f3f46" />
      {kind === 'bar' ? (
        values.map((v, i) => {
          const w = plot.w / 3 - 10
          return <rect key={i} x={plot.x + 6 + i * (plot.w / 3)} y={plot.y + plot.h * (1 - v)} width={w} height={plot.h * v} fill={colours[i]} />
        })
      ) : (
        <polyline
          fill="none"
          stroke="#0072b2"
          strokeWidth={2}
          points={values.map((v, i) => `${plot.x + 6 + (i * (plot.w - 12)) / (values.length - 1)},${plot.y + plot.h * (1 - v)}`).join(' ')}
        />
      )}
      <text x={box.x + box.w / 2} y={box.y + box.h - 4} textAnchor="middle" fontSize={8} fill="#52525b">
        {kind === 'bar' ? 'Treatment' : 'Day'}
      </text>
    </g>
  )
}

/** A panel block in the Header bar look, with three filled icon spaces (round cells). */
function PanelDrawing({ thing, letter }: { thing: Thing; letter?: string }) {
  const { box, colour } = thing
  const header = 22
  const count = thing.id === 'model' ? 5 : 3
  const step = (box.w - 28) / count
  return (
    <g>
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={8} fill={wash(colour, 0.08)} stroke={wash(colour, 0.55)} strokeWidth={1.5} />
      <path d={`M ${box.x} ${box.y + header} V ${box.y + 8} a 8 8 0 0 1 8 -8 H ${box.x + box.w - 8} a 8 8 0 0 1 8 8 V ${box.y + header} Z`} fill={colour} />
      <text x={box.x + 10} y={box.y + 15} fontSize={11} fontWeight={600} fill="#ffffff">
        {letter && <tspan fontWeight={800}>{letter}</tspan>}
        <tspan dx={letter ? 7 : 0}>{thing.name}</tspan>
      </text>
      {Array.from({ length: count }, (_, i) => {
        const cx = box.x + 14 + step * i + step / 2
        const cy = box.y + header + (box.h - header) / 2
        const r = Math.min(step, box.h - header) / 2 - 14
        return (
          <g key={i}>
            <circle cx={cx} cy={cy} r={r} fill={wash(colour, 0.3)} stroke={colour} strokeWidth={1.5} />
            <circle cx={cx + r * 0.2} cy={cy - r * 0.1} r={r * 0.35} fill={colour} fillOpacity={0.7} />
            {i < count - 1 && <path d={`M ${cx + r + 6} ${cy} h ${step - 2 * r - 14} m -5 -4 l 5 4 l -5 4`} fill="none" stroke="#3f3f46" strokeWidth={1.4} />}
          </g>
        )
      })}
    </g>
  )
}

function OutsideLetter({ box, text, letters }: { box: Box; text: string; letters: Letters }) {
  return (
    <text x={box.x} y={box.y - 6} fontSize={letters.size * 1.33} fontWeight={letters.bold ? 700 : 400} fill={INK}>
      {text}
    </text>
  )
}

function TabLetter({ box, text, letters, colour }: { box: Box; text: string; letters: Letters; colour: string }) {
  const size = letters.size * 1.2
  const w = Math.max(size * 1.4, text.length * size * 0.62 + 10)
  const h = size + 8
  return (
    <g>
      <path d={`M ${box.x} ${box.y} V ${box.y - h + 5} a 5 5 0 0 1 5 -5 H ${box.x + w - 5} a 5 5 0 0 1 5 5 V ${box.y} Z`} fill={colour} />
      <text x={box.x + w / 2} y={box.y - 5} textAnchor="middle" fontSize={size} fontWeight={letters.bold ? 700 : 400} fill="#ffffff">
        {text}
      </text>
    </g>
  )
}

function PageDrawing({ look, letters, slide, selected, letterOn }: { look: Look; letters: Letters; slide: 1 | 2; selected: string; letterOn: boolean }) {
  const start = slide === 2 && letters.numbering === 'continue' ? SLIDE_ONE_COUNT : 0
  const lettered = THINGS.filter((t) => t.id !== selected || letterOn)
  const textOf = (t: Thing) => letterText(start + lettered.indexOf(t), letters.style)
  return (
    <svg viewBox={`0 0 ${PAGE.w} ${PAGE.h}`} width={PAGE.w * ZOOM} height={PAGE.h * ZOOM} className="block bg-white">
      {THINGS.map((t) => {
        const has = lettered.includes(t)
        return (
          <g key={t.id}>
            {t.kind === 'panel' ? (
              <PanelDrawing thing={t} letter={look === 'title' && has ? textOf(t) : undefined} />
            ) : (
              <MiniChart box={t.box} kind={t.chart ?? 'bar'} />
            )}
            {has && look === 'outside' && <OutsideLetter box={t.box} text={textOf(t)} letters={letters} />}
            {has && look === 'title' && t.kind === 'cell' && <OutsideLetter box={t.box} text={textOf(t)} letters={letters} />}
            {has && look === 'tab' && <TabLetter box={t.box} text={textOf(t)} letters={letters} colour={t.kind === 'panel' ? t.colour : '#27272a'} />}
          </g>
        )
      })}
      {/* The grid's dotted outline and the selected panel's box. */}
      <rect x={314} y={look === 'outside' || look === 'title' ? 36 : 34} width={262} height={190} fill="none" stroke="#0072b2" strokeOpacity={0.35} strokeDasharray="2 3" />
      {THINGS.filter((t) => t.id === selected).map((t) => (
        <rect key={t.id} x={t.box.x - 3} y={t.box.y - 3} width={t.box.w + 6} height={t.box.h + 6} fill="none" stroke="var(--color-selection)" strokeWidth={1.5} />
      ))}
    </svg>
  )
}

/* ---------- The properties panel ---------- */

function Panel({ children }: { children: ReactNode }) {
  return <section className="flex w-[360px] shrink-0 flex-col overflow-y-auto border-r border-border bg-panel">{children}</section>
}

function Header() {
  return (
    <div className="flex h-12 items-center gap-2 border-b border-border px-2">
      <button type="button" aria-label="Back to blocks" className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted">
        <ArrowLeft className="size-4" />
      </button>
      <LayoutPanelTop className="size-4 text-muted-foreground" />
      <span className="text-sm font-medium">Panel</span>
    </div>
  )
}

function Row({ label, children, off, top }: { label: string; children: ReactNode; off?: boolean; top?: boolean }) {
  return (
    <div className={`flex min-h-10 gap-[52px] px-3 ${top ? 'items-start py-1.5' : 'items-center'} ${off ? 'opacity-50' : ''}`}>
      <span className={`w-[84px] shrink-0 text-xs text-muted-foreground ${top ? 'pt-2' : ''}`}>{label}</span>
      <div className="flex min-w-0 flex-1 items-center">{children}</div>
    </div>
  )
}

/** Rows the panel already has, faded: only there to show where the new ones go. */
function ExistingRows({ names }: { names: string[] }) {
  return (
    <>
      {names.map((name) => (
        <Row key={name} label={name} off>
          <span className="h-7 w-full rounded-md border border-dashed border-border-strong" />
        </Row>
      ))}
    </>
  )
}

const SHOWN = [
  { value: 'shown', label: 'Shown', icon: Eye },
  { value: 'hidden', label: 'Hidden', icon: EyeOff },
] as const

function StyleTiles({ letters, set, big }: { letters: Letters; set: (l: Letters) => void; big?: boolean }) {
  return (
    <div role="group" aria-label="Letter style" className={`grid w-full gap-1.5 ${big ? 'grid-cols-2' : 'grid-cols-4'}`}>
      {STYLES.map((s) => {
        const on = letters.style === s.id
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => set({ ...letters, style: s.id })}
            className={`flex flex-col items-center gap-0.5 rounded-md border px-1 text-xs ${big ? 'py-2.5' : 'py-1.5'} ${on ? 'border-primary bg-primary-subtle text-foreground' : 'border-border-strong text-muted-foreground hover:bg-muted'}`}
          >
            <span className={`${big ? 'text-xl' : 'text-base'} leading-none text-foreground ${letters.bold ? 'font-bold' : ''}`}>{letterText(0, s.id)}</span>
            {s.name}
          </button>
        )
      })}
    </div>
  )
}

function WeightToggle({ letters, set }: { letters: Letters; set: (l: Letters) => void }) {
  return (
    <SegmentedToggle
      label="Letter weight"
      showLabels
      className="h-8 flex-1"
      value={letters.bold ? 'bold' : 'plain'}
      onValueChange={(v) => set({ ...letters, bold: v === 'bold' })}
      options={[
        { value: 'bold', label: 'Bold', picture: <span className="text-sm font-bold">A</span> },
        { value: 'plain', label: 'Plain', picture: <span className="text-sm">A</span> },
      ]}
    />
  )
}

function SizeSlider({ letters, set }: { letters: Letters; set: (l: Letters) => void }) {
  return <Slider label="Letter size" hideLabel min={6} max={24} value={letters.size} unit="pt" onValueChange={(size) => set({ ...letters, size })} className="min-w-0 flex-1" />
}

function NumberingToggle({ letters, set }: { letters: Letters; set: (l: Letters) => void }) {
  const next = letterText(SLIDE_ONE_COUNT, letters.style)
  const first = letterText(0, letters.style)
  return (
    <SegmentedToggle
      label="Numbering"
      showLabels
      className="h-8 flex-1"
      value={letters.numbering}
      onValueChange={(numbering) => set({ ...letters, numbering })}
      options={[
        { value: 'continue', label: `Go on at ${next}`, picture: <span className="text-xs font-semibold">{next}</span> },
        { value: 'restart', label: `Start at ${first}`, picture: <span className="text-xs font-semibold">{first}</span> },
      ]}
    />
  )
}

function SlideSection({ letters, set, slide, title, bigTiles }: { letters: Letters; set: (l: Letters) => void; slide: 1 | 2; title?: string; bigTiles?: boolean }) {
  return (
    <section className="border-t border-border py-1">
      {title && (
        <div className="flex items-baseline justify-between px-3 pt-2 pb-1">
          <h3 className="text-xs font-medium text-foreground">{title}</h3>
          <span className="text-xs text-muted-foreground">every panel and grid</span>
        </div>
      )}
      <Row label="Style" top>
        <StyleTiles letters={letters} set={set} big={bigTiles} />
      </Row>
      <Row label="Weight">
        <WeightToggle letters={letters} set={set} />
      </Row>
      <Row label="Size">
        <SizeSlider letters={letters} set={set} />
      </Row>
      {slide === 2 && (
        <Row label="Numbering">
          <NumberingToggle letters={letters} set={set} />
        </Row>
      )}
    </section>
  )
}

function DetachButton() {
  return (
    <div className="mt-auto border-t border-border p-3">
      <Button variant="secondary" size="sm" className="w-full gap-1.5">
        <Ungroup aria-hidden="true" />
        Detach panel
      </Button>
    </div>
  )
}

type PropsArgs = { letters: Letters; set: (l: Letters) => void; slide: 1 | 2; letterOn: boolean; setLetterOn: (on: boolean) => void }

/** A: a Letter row under the title, then the slide's letter settings as their own section. */
function PropertiesA({ letters, set, slide, letterOn, setLetterOn }: PropsArgs) {
  return (
    <Panel>
      <Header />
      <div className="py-1">
        <ExistingRows names={['Title', 'Text']} />
        <Row label="Letter">
          <SegmentedToggle label="Panel letter" options={SHOWN} value={letterOn ? 'shown' : 'hidden'} onValueChange={(v) => setLetterOn(v === 'shown')} showLabels className="h-8 flex-1" />
        </Row>
        <ExistingRows names={['Style', 'Preset', 'Padding']} />
      </div>
      {letterOn && <SlideSection letters={letters} set={set} slide={slide} title={`Letters on slide ${slide}`} />}
      <DetachButton />
    </Panel>
  )
}

/** B: the letter is a button in front of the title text; its look sits right under it. */
function PropertiesB({ letters, set, slide, letterOn, setLetterOn, letter }: PropsArgs & { letter: string }) {
  return (
    <Panel>
      <Header />
      <div className="py-1">
        <Row label="Title">
          <SegmentedToggle label="Title" options={SHOWN} value="shown" onValueChange={() => undefined} showLabels className="h-8 flex-1" />
        </Row>
        <Row label="Text">
          <div className="flex w-full items-center gap-1.5">
            <button
              type="button"
              aria-pressed={letterOn}
              title={letterOn ? 'Take the letter off' : 'Give the panel a letter'}
              onClick={() => setLetterOn(!letterOn)}
              className={`flex h-8 min-w-10 items-center justify-center rounded-md border px-1.5 text-sm ${letterOn ? 'border-primary bg-primary-subtle font-bold text-foreground' : 'border-dashed border-border-strong text-muted-foreground'}`}
            >
              {letterOn ? letter : '+ A'}
            </button>
            <span className="flex h-8 min-w-0 flex-1 items-center rounded-md border border-border-strong bg-background px-2 text-sm">Workflow</span>
          </div>
        </Row>
        {letterOn && (
          <div className="mx-3 mb-1 rounded-md bg-muted/60 py-1">
            <div className="px-3 pt-1.5 text-xs text-muted-foreground">Letters on slide {slide} (all at once)</div>
            <Row label="Style" top>
              <StyleTiles letters={letters} set={set} />
            </Row>
            <Row label="Size">
              <SizeSlider letters={letters} set={set} />
            </Row>
            {slide === 2 && (
              <Row label="Numbering">
                <NumberingToggle letters={letters} set={set} />
              </Row>
            )}
          </div>
        )}
        <ExistingRows names={['Style', 'Preset', 'Padding']} />
      </div>
      <DetachButton />
    </Panel>
  )
}

/** C: a Letters tab next to the panel's own settings, with every letter on the slide listed in order. */
function PropertiesC({ letters, set, slide, letterOn, setLetterOn }: PropsArgs) {
  const [tab, setTab] = useState<'panel' | 'letters'>('letters')
  const start = slide === 2 && letters.numbering === 'continue' ? SLIDE_ONE_COUNT : 0
  const lettered = THINGS.filter((t) => t.id !== 'workflow' || letterOn)
  return (
    <Panel>
      <Header />
      <div className="flex gap-4 border-b border-border px-3">
        {(['panel', 'letters'] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={`-mb-px border-b-2 py-2 text-sm ${tab === t ? 'border-primary font-medium text-foreground' : 'border-transparent text-muted-foreground'}`}>
            {t === 'panel' ? 'Panel' : 'Letters'}
          </button>
        ))}
      </div>
      {tab === 'panel' ? (
        <div className="py-1">
          <ExistingRows names={['Title', 'Text', 'Style', 'Preset', 'Padding']} />
        </div>
      ) : (
        <>
          <div className="py-1">
            <Row label="This panel">
              <SegmentedToggle label="Panel letter" options={SHOWN} value={letterOn ? 'shown' : 'hidden'} onValueChange={(v) => setLetterOn(v === 'shown')} showLabels className="h-8 flex-1" />
            </Row>
          </div>
          <SlideSection letters={letters} set={set} slide={slide} bigTiles />
          <section className="border-t border-border px-3 pt-2.5 pb-3">
            <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
              <span>On slide {slide}, in reading order</span>
              <span>{lettered.length} letters</span>
            </div>
            <ul className="flex flex-col">
              {lettered.map((t, i) => (
                <li key={t.id}>
                  <button type="button" className={`flex h-8 w-full items-center gap-2 rounded-md px-1.5 text-left text-sm hover:bg-muted ${t.id === 'workflow' ? 'bg-primary-subtle' : ''}`}>
                    <span className={`w-8 shrink-0 ${letters.bold ? 'font-bold' : ''}`}>{letterText(start + i, letters.style)}</span>
                    {t.kind === 'panel' ? <LayoutPanelTop className="size-4 shrink-0 text-muted-foreground" /> : <LayoutGrid className="size-4 shrink-0 text-muted-foreground" />}
                    <span className="min-w-0 truncate">{t.kind === 'panel' ? `${t.name} panel` : `Grid · ${t.name}`}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
      <DetachButton />
    </Panel>
  )
}

/* ---------- One version: the whole screen ---------- */

function Version({ look, title, note }: { look: Look; title: string; note: string }) {
  const [letters, setLetters] = useState<Letters>({ style: 'capital', bold: true, size: 12, numbering: 'continue' })
  const [slide, setSlide] = useState<1 | 2>(2)
  const [letterOn, setLetterOn] = useState(true)
  const start = slide === 2 && letters.numbering === 'continue' ? SLIDE_ONE_COUNT : 0
  const args: PropsArgs = { letters, set: setLetters, slide, letterOn, setLetterOn }
  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <div className="flex items-center gap-3 border-b border-border px-4 py-2">
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-xs text-muted-foreground">{note}</span>
        <div className="ml-auto flex items-center gap-1 text-xs">
          <span className="mr-1 text-muted-foreground">Showing</span>
          {([1, 2] as const).map((s) => (
            <button key={s} type="button" onClick={() => setSlide(s)} className={`rounded-md border px-2 py-1 ${slide === s ? 'border-primary bg-primary-subtle' : 'border-border-strong text-muted-foreground'}`}>
              Slide {s}
            </button>
          ))}
        </div>
      </div>
      <div className="flex min-h-0 flex-1">
        {look === 'outside' && <PropertiesA {...args} />}
        {look === 'title' && <PropertiesB {...args} letter={letterText(start, letters.style)} />}
        {look === 'tab' && <PropertiesC {...args} />}
        <div className="flex min-w-0 flex-1 items-center justify-center overflow-auto bg-canvas p-8">
          <div className="shadow-md">
            <PageDrawing look={look} letters={letters} slide={slide} selected="workflow" letterOn={letterOn} />
          </div>
        </div>
      </div>
    </div>
  )
}

export const A_OutsideCorner: Story = {
  name: 'A · Outside the corner',
  render: () => <Version look="outside" title="A · Outside the corner" note="Same spot as the grids' letters; a Letter row, then the slide's letter settings" />,
}

export const B_InTheTitle: Story = {
  name: 'B · In the title',
  render: () => <Version look="title" title="B · In the title" note="The letter leads the panel's title; grids keep theirs outside the corner" />,
}

export const C_LetterTab: Story = {
  name: 'C · Letter tab',
  render: () => <Version look="tab" title="C · Letter tab" note="A tab in the panel's colour on its corner; a Letters tab lists every letter on the slide" />,
}
