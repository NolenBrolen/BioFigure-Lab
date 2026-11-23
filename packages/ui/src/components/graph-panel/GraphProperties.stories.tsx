/*
 * Draft layouts for a selected chart's properties on desktop (the phone splits
 * them into Kind, Data, Colours, Axes, Labels, Font, Statistics and
 * Properties; the desktop panel is one long list under three tabs). Visual
 * drafts only, to pick from: no tests, no keyboard or accessibility work yet.
 * Every version uses the same eight sections and the same controls, so only
 * the way of getting around differs.
 *   A  Drill-in list     a list of sections with their current values; tap one to open it, Back returns
 *   B  Accordion         sections fold open and shut, one at a time; the closed ones show their value
 *   C  Icon grid         the phone's property bar as a grid of tiles on top; the section opens below it
 *   D  Side rail         a slim icon rail inside the panel, like the tool rail, with the section beside it
 *   E  Jump chips        the whole list stays, but a sticky row of chips jumps to a section and follows the scroll
 */
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Asterisk, Captions, ChartColumn, ChevronDown, ChevronLeft, ChevronRight, Palette, Ruler, SlidersHorizontal, Table, Type, type LucideIcon } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'

import { cn } from '../../lib/cn'
import { IconButton } from '../icon-button/IconButton'
import { Select } from '../select/Select'
import { SegmentedToggle } from '../segmented-toggle/SegmentedToggle'
import { Slider } from '../slider/Slider'
import { TextField } from '../text-field/TextField'
import { Toggle } from '../toggle/Toggle'
import { ErrorBarPicker } from './ErrorBarPicker'
import { ChartPicture, type ChartKind, type ErrorBars } from './GraphPanel'

const CHART_KINDS: { id: ChartKind; name: string }[] = [
  { id: 'bar', name: 'Bar' },
  { id: 'line', name: 'Line' },
  { id: 'scatter', name: 'Scatter' },
]

const meta = { title: 'Components/Graph properties layouts', parameters: { layout: 'fullscreen' } } satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

/* ------------------------------------------------------------------ the shared mock chart */

const COLOURS = ['#0072B2', '#E69F00', '#009E73', '#CC79A7']
const GROUP_NAMES = ['Control', 'Drug A', 'Drug B']
const FONTS = ['Inter', 'Source Serif 4', 'Arial', 'Helvetica', 'Times New Roman']
const TESTS = ['None', 'Student’s t-test', 'One-way ANOVA', 'Mann–Whitney U', 'Kruskal–Wallis']

type Mock = ReturnType<typeof useMock>

function useMock() {
  const [kind, setKind] = useState<ChartKind>('bar')
  const [bars, setBars] = useState<ErrorBars>('sd')
  const [colours, setColours] = useState(COLOURS.slice(0, 3))
  const [yTitle, setYTitle] = useState('Concentration')
  const [unit, setUnit] = useState('µM')
  const [range, setRange] = useState('auto')
  const [xTitle, setXTitle] = useState('')
  const [ticks, setTicks] = useState(true)
  const [name, setName] = useState('Dose response')
  const [caption, setCaption] = useState('')
  const [legend, setLegend] = useState(true)
  const [font, setFont] = useState('Inter')
  const [fontSize, setFontSize] = useState(8)
  const [test, setTest] = useState('One-way ANOVA')
  const [showNs, setShowNs] = useState(false)
  const [coloured, setColoured] = useState(true)
  const [width, setWidth] = useState('85')
  const [height, setHeight] = useState('64')
  const [opacity, setOpacity] = useState(100)
  return { kind, setKind, bars, setBars, colours, setColours, yTitle, setYTitle, unit, setUnit, range, setRange, xTitle, setXTitle, ticks, setTicks, name, setName, caption, setCaption, legend, setLegend, font, setFont, fontSize, setFontSize, test, setTest, showNs, setShowNs, coloured, setColoured, width, setWidth, height, setHeight, opacity, setOpacity }
}

/* ------------------------------------------------------------------ the sections */

type SectionId = 'kind' | 'data' | 'colours' | 'axes' | 'labels' | 'font' | 'stats' | 'props'

type Section = { id: SectionId; name: string; icon: LucideIcon; summary: (m: Mock) => string; body: (m: Mock) => ReactNode }

const KIND_OPTIONS = CHART_KINDS.map((k) => ({ value: k.id, label: k.name, icon: ({ className }: { className?: string }) => <ChartPicture kind={k.id} className={className} /> }))

const SECTIONS: Section[] = [
  {
    id: 'kind',
    name: 'Kind',
    icon: ChartColumn,
    summary: (m) => `${m.kind[0]?.toUpperCase()}${m.kind.slice(1)}, ${m.bars === 'none' ? 'no error bars' : m.bars.toUpperCase()}`,
    body: (m) => (
      <>
        <Row label="Kind">
          <SegmentedToggle label="Chart kind" stacked options={KIND_OPTIONS} value={m.kind} onValueChange={m.setKind} className="w-full" />
        </Row>
        <Row label="Error bars">
          <ErrorBarPicker value={m.bars} onChange={m.setBars} />
        </Row>
      </>
    ),
  },
  {
    id: 'data',
    name: 'Data',
    icon: Table,
    summary: (m) => `${m.colours.length} groups · 4 rows`,
    body: () => (
      <Row label="Data">
        <button type="button" className="h-(--control-height) rounded-md border border-border-strong px-2.5 text-xs hover:bg-muted">
          Edit data
        </button>
      </Row>
    ),
  },
  {
    id: 'colours',
    name: 'Colours',
    icon: Palette,
    summary: () => '',
    body: (m) => (
      <Row label="Colours">
        <div className="flex flex-wrap items-center gap-1.5">
          {m.colours.map((c, i) => (
            <button key={i} type="button" aria-label={`Colour of ${GROUP_NAMES[i]}`} title={GROUP_NAMES[i]} style={{ background: c }} className="size-6 rounded-sm ring-1 ring-border-strong ring-inset" onClick={() => m.setColours((cs) => cs.map((x, j) => (j === i ? COLOURS[(COLOURS.indexOf(x) + 1) % COLOURS.length] ?? x : x)))} />
          ))}
          <button type="button" onClick={() => m.setColours(COLOURS.slice(0, 3))} className="h-6 rounded-md px-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground">
            Reset
          </button>
        </div>
      </Row>
    ),
  },
  {
    id: 'axes',
    name: 'Axes',
    icon: Ruler,
    summary: (m) => [m.yTitle || 'No y title', m.unit].filter(Boolean).join(' · '),
    body: (m) => (
      <>
        <Row label="Y axis">
          <TextField label="Y axis title" hideLabel value={m.yTitle} placeholder="e.g. Concentration" onChange={(e) => m.setYTitle(e.target.value)} />
        </Row>
        <Row label="Unit">
          <Select label="Y axis unit" hideLabel className="min-w-0 flex-1" options={['none', '%', 'mM', 'µM', 'nM', 'mg/mL'].map((u) => ({ value: u, label: u === 'none' ? 'No unit' : u }))} value={m.unit} onValueChange={m.setUnit} />
        </Row>
        <Row label="Range">
          <div role="radiogroup" aria-label="Y axis range" className="grid w-full grid-cols-2 gap-1 rounded-lg bg-muted p-1">
            {['auto', 'custom'].map((choice) => (
              <button key={choice} type="button" role="radio" aria-checked={m.range === choice} onClick={() => m.setRange(choice)} className={cn('h-7 rounded-md text-xs capitalize', m.range === choice ? 'bg-panel text-foreground shadow-(--elevation-sm)' : 'text-muted-foreground hover:text-foreground')}>
                {choice}
              </button>
            ))}
          </div>
        </Row>
        <Row label="X axis">
          <TextField label="X axis title" hideLabel value={m.xTitle} placeholder="None" onChange={(e) => m.setXTitle(e.target.value)} />
        </Row>
        <Row label="Tick labels">
          <Toggle label="Tick labels" hideLabel checked={m.ticks} onCheckedChange={m.setTicks} />
        </Row>
      </>
    ),
  },
  {
    id: 'labels',
    name: 'Labels',
    icon: Captions,
    summary: (m) => [m.name || 'No name', m.legend ? 'legend' : ''].filter(Boolean).join(' · '),
    body: (m) => (
      <>
        <Row label="Name">
          <TextField label="Chart name" hideLabel value={m.name} placeholder="None" onChange={(e) => m.setName(e.target.value)} />
        </Row>
        <Row label="Under chart">
          <TextField label="Text under the chart" hideLabel value={m.caption} placeholder="e.g. Primers: GAPDH fw/rv" onChange={(e) => m.setCaption(e.target.value)} />
        </Row>
        <Row label="Legend">
          <Toggle label="Legend" hideLabel checked={m.legend} onCheckedChange={m.setLegend} />
        </Row>
      </>
    ),
  },
  {
    id: 'font',
    name: 'Font',
    icon: Type,
    summary: (m) => `${m.font}, ${m.fontSize} pt`,
    body: (m) => (
      <>
        <Row label="Font">
          <Select label="Font" hideLabel className="min-w-0 flex-1" options={FONTS.map((f) => ({ value: f, label: f }))} value={m.font} onValueChange={m.setFont} />
        </Row>
        <Row label="Text size">
          <Slider label="Chart text size" hideLabel value={m.fontSize} min={5} max={24} step={0.5} unit="pt" onValueChange={m.setFontSize} className="min-w-0 flex-1" />
        </Row>
      </>
    ),
  },
  {
    id: 'stats',
    name: 'Statistics',
    icon: Asterisk,
    summary: (m) => m.test,
    body: (m) => (
      <>
        <Row label="Test">
          <Select label="Significance test" hideLabel className="min-w-0 flex-1" options={TESTS.map((t) => ({ value: t, label: t }))} value={m.test} onValueChange={m.setTest} />
        </Row>
        {m.test !== 'None' && (
          <>
            <Row label="Coloured">
              <Toggle label="Coloured brackets" hideLabel checked={m.coloured} onCheckedChange={m.setColoured} />
            </Row>
            <Row label="Show ns">
              <Toggle label="Show ns" hideLabel checked={m.showNs} onCheckedChange={m.setShowNs} />
            </Row>
          </>
        )}
      </>
    ),
  },
  {
    id: 'props',
    name: 'Properties',
    icon: SlidersHorizontal,
    summary: (m) => `${m.width} × ${m.height} mm · ${m.opacity}%`,
    body: (m) => (
      <>
        <Row label="Size (mm)">
          <TextField label="Width" hideLabel value={m.width} onChange={(e) => m.setWidth(e.target.value)} />
          <span className="text-xs text-muted-foreground">×</span>
          <TextField label="Height" hideLabel value={m.height} onChange={(e) => m.setHeight(e.target.value)} />
        </Row>
        <Row label="Opacity">
          <Slider label="Opacity" hideLabel value={m.opacity} min={0} max={100} step={1} unit="%" onValueChange={m.setOpacity} className="min-w-0 flex-1" />
        </Row>
      </>
    ),
  },
]

const section = (id: SectionId) => SECTIONS.find((s) => s.id === id) as Section

/** Label on the left (the panel's usual rows) or above, in the narrow side-rail version. */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex min-w-0 items-center gap-1.5">{children}</div>
    </>
  )
}

function Rows({ children, stacked = false }: { children: ReactNode; stacked?: boolean }) {
  return <div className={cn('grid items-center gap-y-1.5 px-3 py-3', stacked ? 'grid-cols-1 gap-y-1 [&>span:not(:first-child)]:mt-2' : 'grid-cols-[5.25rem_minmax(0,1fr)] gap-x-13')}>{children}</div>
}

function Swatches({ colours }: { colours: string[] }) {
  return (
    <span className="flex gap-1">
      {colours.map((c) => (
        <span key={c} className="size-3.5 rounded-sm ring-1 ring-border-strong ring-inset" style={{ background: c }} />
      ))}
    </span>
  )
}

function Summary({ s, m }: { s: Section; m: Mock }) {
  return s.id === 'colours' ? <Swatches colours={m.colours} /> : <span className="truncate">{s.summary(m)}</span>
}

/* ------------------------------------------------------------------ the frame around each draft */

/** The object header every properties view has: back (deselects), a small picture and the name. */
function Header({ back, title, onBack }: { back: string; title: string; onBack: () => void }) {
  return (
    <div className="flex h-12 shrink-0 items-center gap-2 border-b px-2">
      <IconButton icon={ChevronLeft} label={back} onClick={onBack} />
      <ChartPicture kind="bar" className="size-6 shrink-0 text-muted-foreground" />
      <span className="min-w-0 truncate text-sm font-semibold">{title}</span>
    </div>
  )
}

/** The panel at its real width (360 px) beside a page, so the draft is judged in place. */
function Stage({ children, note }: { children: ReactNode; note: string }) {
  return (
    <div className="flex min-h-screen items-start gap-6 bg-canvas p-6">
      <div className="flex h-[44rem] w-[22.5rem] shrink-0 flex-col overflow-hidden rounded-lg border bg-panel shadow-(--elevation-sm)">{children}</div>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <p className="max-w-xl text-sm text-muted-foreground">{note}</p>
        <div className="grid aspect-[4/3] w-full max-w-xl place-items-center rounded-md bg-white text-neutral-400 shadow-(--elevation-sm)">
          <ChartPicture kind="bar" className="size-40" />
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ A: drill-in list */

export const A_DrillInList: Story = {
  name: 'A · Drill-in list',
  render: function Render() {
    const m = useMock()
    const [open, setOpen] = useState<SectionId | null>(null)
    const s = open ? section(open) : null
    return (
      <Stage note="Like the phone's property bar, as a list: each row names a section and shows what it is set to right now. Click a row to open just those settings; the arrow in the header comes back. Good for glancing at the whole chart; costs one click to change anything.">
        {s ? (
          <>
            <Header back="Back to all chart settings" title={s.name} onBack={() => setOpen(null)} />
            <div className="min-h-0 flex-1 overflow-y-auto">
              <Rows>{s.body(m)}</Rows>
            </div>
          </>
        ) : (
          <>
            <Header back="Back to the graph tiles" title="Bar chart" onBack={() => {}} />
            <ul className="min-h-0 flex-1 divide-y overflow-y-auto">
              {SECTIONS.map((each) => (
                <li key={each.id}>
                  <button type="button" onClick={() => setOpen(each.id)} className="flex h-14 w-full items-center gap-3 px-4 text-left hover:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring">
                    <each.icon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="w-20 shrink-0 text-sm font-medium">{each.name}</span>
                    <span className="flex min-w-0 flex-1 justify-end text-xs text-muted-foreground">
                      <Summary s={each} m={m} />
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Stage>
    )
  },
}

/* ------------------------------------------------------------------ B: accordion */

export const B_Accordion: Story = {
  name: 'B · Accordion',
  render: function Render() {
    const m = useMock()
    const [open, setOpen] = useState<SectionId>('kind')
    return (
      <Stage note="One long panel, but folded: every section is a header with its current value, and opening one closes the last. Nothing changes page, so the list stays in view; with an open section of five rows the panel scrolls a little.">
        <Header back="Back to the graph tiles" title="Bar chart" onBack={() => {}} />
        <div className="min-h-0 flex-1 overflow-y-auto">
          {SECTIONS.map((each) => {
            const on = open === each.id
            return (
              <div key={each.id} className="border-b">
                <button type="button" aria-expanded={on} onClick={() => setOpen(on ? ('' as SectionId) : each.id)} className="flex h-11 w-full items-center gap-2.5 px-3 text-left hover:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring">
                  <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform duration-(--duration-instant)', !on && '-rotate-90')} aria-hidden="true" />
                  <span className="text-sm font-medium">{each.name}</span>
                  {!on && (
                    <span className="flex min-w-0 flex-1 justify-end text-xs text-muted-foreground">
                      <Summary s={each} m={m} />
                    </span>
                  )}
                </button>
                {on && <Rows>{each.body(m)}</Rows>}
              </div>
            )
          })}
        </div>
      </Stage>
    )
  },
}

/* ------------------------------------------------------------------ C: icon grid */

export const C_IconGrid: Story = {
  name: 'C · Icon grid',
  render: function Render() {
    const m = useMock()
    const [open, setOpen] = useState<SectionId>('kind')
    const s = section(open)
    return (
      <Stage note="The phone's property bar, kept on screen: a grid of icon tiles stays at the top and the picked section's settings sit under it. Always one click away from any section, and what you already know from the phone carries over. The settings take the rest of the height.">
        <Header back="Back to the graph tiles" title="Bar chart" onBack={() => {}} />
        <div role="tablist" aria-label="Chart settings" className="grid shrink-0 grid-cols-4 gap-1 border-b p-2">
          {SECTIONS.map((each) => (
            <button
              key={each.id}
              type="button"
              role="tab"
              aria-selected={open === each.id}
              onClick={() => setOpen(each.id)}
              className={cn('flex h-14 flex-col items-center justify-center gap-1 rounded-md text-xs focus-visible:outline-2 focus-visible:outline-ring', open === each.id ? 'bg-primary-subtle text-primary-subtle-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}
            >
              <each.icon className="size-5" aria-hidden="true" />
              {each.name}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Rows>{s.body(m)}</Rows>
        </div>
      </Stage>
    )
  },
}

/* ------------------------------------------------------------------ D: side rail */

export const D_SideRail: Story = {
  name: 'D · Side rail',
  render: function Render() {
    const m = useMock()
    const [open, setOpen] = useState<SectionId>('kind')
    const s = section(open)
    return (
      <Stage note="A slim icon rail inside the panel, the same idea as the tool rail on the far left (names in a tooltip). The rows get narrower, so labels sit above their controls. Takes the least height and keeps a section's title in view, but icons alone need learning, and two rails side by side may feel busy.">
        <Header back="Back to the graph tiles" title="Bar chart" onBack={() => {}} />
        <div className="flex min-h-0 flex-1">
          <div role="tablist" aria-label="Chart settings" aria-orientation="vertical" className="flex w-12 shrink-0 flex-col items-center gap-1 border-r py-2">
            {SECTIONS.map((each) => (
              <IconButton key={each.id} icon={each.icon} label={each.name} pressed={open === each.id} onClick={() => setOpen(each.id)} />
            ))}
          </div>
          <div className="min-w-0 flex-1 overflow-y-auto">
            <h3 className="px-3 pt-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{s.name}</h3>
            <Rows stacked>{s.body(m)}</Rows>
          </div>
        </div>
      </Stage>
    )
  },
}

/* ------------------------------------------------------------------ E: jump chips */

export const E_JumpChips: Story = {
  name: 'E · Jump chips',
  render: function Render() {
    const m = useMock()
    const scroller = useRef<HTMLDivElement>(null)
    const refs = useRef<Partial<Record<SectionId, HTMLElement | null>>>({})
    const [at, setAt] = useState<SectionId>('kind')
    const follow = () => {
      const box = scroller.current
      if (!box) return
      let current = SECTIONS[0]?.id ?? 'kind'
      for (const each of SECTIONS) {
        const el = refs.current[each.id]
        if (el && el.offsetTop - box.scrollTop <= 24) current = each.id
      }
      setAt(current)
    }
    return (
      <Stage note="Keeps the long list (nothing hidden, scroll as before) but adds a sticky row of chips at the top: click one to jump to that section, and the chip follows as you scroll. The smallest change from today; it only adds navigation.">
        <Header back="Back to the graph tiles" title="Bar chart" onBack={() => {}} />
        <div className="flex shrink-0 gap-1.5 overflow-x-auto border-b px-3 py-2 [scrollbar-width:none]">
          {SECTIONS.map((each) => (
            <button
              key={each.id}
              type="button"
              aria-current={at === each.id}
              onClick={() => scroller.current?.scrollTo({ top: (refs.current[each.id]?.offsetTop ?? 0) - 8, behavior: 'smooth' })}
              className={cn('h-7 shrink-0 rounded-full px-3 text-xs ring-1 ring-border ring-inset focus-visible:outline-2 focus-visible:outline-ring', at === each.id ? 'bg-primary-subtle text-primary-subtle-foreground ring-primary' : 'text-muted-foreground hover:bg-muted')}
            >
              {each.name}
            </button>
          ))}
        </div>
        <div ref={scroller} onScroll={follow} className="relative min-h-0 flex-1 overflow-y-auto">
          {SECTIONS.map((each) => (
            <section key={each.id} ref={(el) => void (refs.current[each.id] = el)} className="border-b last:min-h-[28rem]">
              <h3 className="px-3 pt-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{each.name}</h3>
              <Rows>{each.body(m)}</Rows>
            </section>
          ))}
        </div>
      </Stage>
    )
  },
}
