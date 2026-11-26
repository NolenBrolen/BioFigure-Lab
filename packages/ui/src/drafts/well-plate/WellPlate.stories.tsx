/*
 * BIO-98 design drafts: the well plate map block. A plate (6 to 384 wells)
 * with row letters and column numbers, wells coloured by condition and a
 * legend that follows the conditions. Visual drafts only: no tests, no
 * accessibility pass, nothing wired up. The painting works, so each way of
 * colouring wells can be tried.
 *
 * Every version shows the same plate: a dose series on a 96-well plate
 * (blanks round the edge, untreated, vehicle, four doses, a positive
 * control), its properties, and the Blocks tool's new "Well plates" section.
 *
 *   A  Real plate     Looks like a plate seen from above: a rim with a cut
 *                     corner, round wells, letters and numbers on the rim,
 *                     legend on the right. Pick a condition in the
 *                     properties, then drag a box over wells to fill them
 *                     (click a letter or number for a whole row or column).
 *   B  Grid map       No plate drawn: square cells like a heat map, letters
 *                     and numbers outside, legend in a row underneath. The
 *                     conditions float in a bar over the plate; drag like a
 *                     brush, every well the pointer passes takes the colour.
 *   C  Labelled wells Round wells with a short label inside (0.1, V, +),
 *                     the dose series drawn as one shaded strip in the
 *                     legend. Select wells first (click, drag a box,
 *                     Shift adds), then click a condition in the bar that
 *                     appears over them.
 */
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ArrowLeft, Eraser, Grid3x3, Minus, Paintbrush, Plus, RotateCcw, Ungroup } from 'lucide-react'
import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'

import { Button } from '../../components/button/Button'
import { ColourMenu } from '../../components/colour-input/ColourInput'
import { SegmentedToggle } from '../../components/segmented-toggle/SegmentedToggle'
import { Toggle } from '../../components/toggle/Toggle'
import { cn } from '../../lib/cn'

const meta = {
  title: 'Drafts/BIO-98 Well plate',
  parameters: { controls: { disable: true }, layout: 'fullscreen' },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const FONT = 'Inter, system-ui, sans-serif'
const INK = '#27272a'
const MUTED = '#71717a'
const SELECTION = '#2563eb'

/* ---------- Plates and conditions ---------- */

type Plate = { wells: number; rows: number; cols: number }
const PLATES: Plate[] = [
  { wells: 6, rows: 2, cols: 3 },
  { wells: 12, rows: 3, cols: 4 },
  { wells: 24, rows: 4, cols: 6 },
  { wells: 48, rows: 6, cols: 8 },
  { wells: 96, rows: 8, cols: 12 },
  { wells: 384, rows: 16, cols: 24 },
]
const LETTERS = 'ABCDEFGHIJKLMNOP'

type Condition = { id: string; name: string; colour: string; short: string; series?: string }

const START: Condition[] = [
  { id: 'blank', name: 'Blank (medium only)', colour: '#d4d4d8', short: 'B' },
  { id: 'untreated', name: 'Untreated', colour: '#009e73', short: 'U' },
  { id: 'vehicle', name: 'Vehicle (0.1% DMSO)', colour: '#80ceb9', short: 'V' },
  { id: 'd1', name: 'Drug X 0.1 µM', colour: '#d1e6f1', short: '0.1', series: 'Drug X (µM)' },
  { id: 'd2', name: 'Drug X 1 µM', colour: '#80b8d8', short: '1', series: 'Drug X (µM)' },
  { id: 'd3', name: 'Drug X 10 µM', colour: '#0072b2', short: '10', series: 'Drug X (µM)' },
  { id: 'd4', name: 'Drug X 100 µM', colour: '#003959', short: '100', series: 'Drug X (µM)' },
  { id: 'pos', name: 'Staurosporine 1 µM', colour: '#d55e00', short: '+' },
]

/** Colours a new condition takes, in order, skipping ones already used. */
const NEW_COLOURS = ['#e69f00', '#cc79a7', '#56b4e9', '#f0e442', '#332288', '#71717a', '#eaae80', '#e6bcd3']

type WellMap = Record<string, string>
const key = (r: number, c: number) => `${r}-${c}`

/** The dose series layout on a 96-well plate; other sizes get the conditions in column bands. */
function startMap(plate: Plate, conditions: Condition[]): WellMap {
  const map: WellMap = {}
  if (plate.wells === 96) {
    const byCol = ['blank', 'untreated', 'vehicle', 'd1', 'd2', 'd3', 'd4', 'pos', 'pos', undefined, undefined, 'blank']
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 12; c++) {
        const edge = r === 0 || r === 7
        const id = edge ? (c < 9 || c === 11 ? 'blank' : undefined) : byCol[c]
        if (id) map[key(r, c)] = id
      }
    }
    return map
  }
  const ids = conditions.filter((c) => c.id !== 'blank').map((c) => c.id)
  const used = Math.max(1, plate.cols - (plate.cols > 4 ? 1 : 0))
  for (let r = 0; r < plate.rows; r++) {
    for (let c = 0; c < used; c++) {
      const id = ids[Math.floor((c * ids.length) / used)]
      if (id) map[key(r, c)] = id
    }
  }
  return map
}

function isDark(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
  return lum < 0.55
}

/** A darker edge for a filled well, so pale colours still read on white. */
function edgeOf(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  const dim = (v: number) => Math.round(v * 0.72)
  const rgb = [dim((n >> 16) & 255), dim((n >> 8) & 255), dim(n & 255)]
  return `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

/* ---------- Where everything goes ---------- */

type Look = 'plate' | 'grid' | 'labelled'
type Box = { x: number; y: number; w: number; h: number }

type Geometry = {
  pitch: number
  /** Top-left of well A1's square. */
  x0: number
  y0: number
  /** The plate's rim (A and C) or the cells' outer box (B). */
  body: Box
  legend: { x: number; y: number }
}

function geometry(look: Look, plate: Plate, area: Box, labels: boolean, legend: boolean): Geometry {
  const room = labels ? (plate.wells >= 384 ? 14 : 18) : 0
  const rim = look === 'grid' ? 0 : plate.wells >= 384 ? 8 : 12
  const legendW = legend && look !== 'grid' ? 150 : 0
  const legendH = legend && look === 'grid' ? 64 : 0
  const fitW = area.w - legendW - 2 * rim - room - (legendW ? 20 : 0)
  const fitH = area.h - legendH - 2 * rim - room
  const pitch = Math.min(fitW / plate.cols, fitH / plate.rows, 64)
  const w = pitch * plate.cols + 2 * rim + room
  const h = pitch * plate.rows + 2 * rim + room
  const left = area.x + (area.w - legendW - (legendW ? 20 : 0) - w) / 2
  const top = area.y + (area.h - legendH - h) / 2
  const body = look === 'grid' ? { x: left + room, y: top + room, w: pitch * plate.cols, h: pitch * plate.rows } : { x: left, y: top, w, h }
  return {
    pitch,
    x0: left + rim + room,
    y0: top + rim + room,
    body,
    legend: look === 'grid' ? { x: body.x, y: top + h + 18 } : { x: left + w + 24, y: top + 6 },
  }
}

function wellAt(g: Geometry, plate: Plate, x: number, y: number) {
  const c = Math.floor((x - g.x0) / g.pitch)
  const r = Math.floor((y - g.y0) / g.pitch)
  return { r, c, inside: r >= 0 && r < plate.rows && c >= 0 && c < plate.cols }
}

/* ---------- The drawing ---------- */

type DrawProps = {
  look: Look
  plate: Plate
  map: WellMap
  conditions: Condition[]
  g: Geometry
  labels: boolean
  legend: boolean
  /** Wells shown in another condition while dragging (A), or ringed as selected (C). */
  preview?: { wells: Set<string>; colour: string | null }
  selected?: Set<string>
  box?: Box
  mini?: boolean
}

function PlateDrawing({ look, plate, map, conditions, g, labels, legend, preview, selected, box, mini }: DrawProps) {
  const byId = new Map(conditions.map((c) => [c.id, c]))
  const font = Math.max(6, Math.min(11, g.pitch * 0.42))
  const wells: ReactNode[] = []
  for (let r = 0; r < plate.rows; r++) {
    for (let c = 0; c < plate.cols; c++) {
      const k = key(r, c)
      const inPreview = preview?.wells.has(k)
      const cond = inPreview ? (preview?.colour ? { colour: preview.colour, short: '' } : undefined) : byId.get(map[k] ?? '')
      const cx = g.x0 + c * g.pitch + g.pitch / 2
      const cy = g.y0 + r * g.pitch + g.pitch / 2
      const fill = cond ? cond.colour : look === 'grid' ? '#f4f4f5' : '#ffffff'
      const stroke = cond ? edgeOf(cond.colour) : '#c4c4ca'
      const sw = mini ? 0.6 : look === 'labelled' ? 1 : 0.9
      if (look === 'grid') {
        const s = g.pitch - Math.max(1, g.pitch * 0.08)
        wells.push(<rect key={k} x={cx - s / 2} y={cy - s / 2} width={s} height={s} rx={Math.min(2, s * 0.12)} fill={fill} stroke={cond ? 'none' : '#e4e4e7'} strokeWidth={sw} />)
      } else {
        const rr = g.pitch * (look === 'labelled' ? 0.44 : 0.4)
        wells.push(<circle key={k} cx={cx} cy={cy} r={rr} fill={fill} stroke={stroke} strokeWidth={sw} />)
        const label = cond && 'short' in cond ? cond.short : ''
        if (look === 'labelled' && cond && label && !mini && g.pitch >= 16) {
          wells.push(
            <text key={`${k}t`} x={cx} y={cy + 0.5} textAnchor="middle" dominantBaseline="middle" fontFamily={FONT} fontSize={label.length > 2 ? font * 0.78 : font * 0.9} fontWeight={600} fill={isDark(cond.colour) ? '#ffffff' : INK}>
              {label}
            </text>,
          )
        }
      }
      if (selected?.has(k)) {
        const rr = look === 'grid' ? g.pitch / 2 : g.pitch * 0.48
        wells.push(<circle key={`${k}s`} cx={cx} cy={cy} r={rr} fill="none" stroke={SELECTION} strokeWidth={1.6} />)
      }
    }
  }

  const labelFont = mini ? 0 : Math.max(6.5, Math.min(10, g.pitch * 0.36))
  const heads: ReactNode[] = []
  if (labels && !mini) {
    const step = plate.wells >= 384 ? 1 : 1
    for (let r = 0; r < plate.rows; r += step) {
      heads.push(
        <text key={`r${r}`} x={g.x0 - (look === 'grid' ? 7 : 9)} y={g.y0 + r * g.pitch + g.pitch / 2 + 0.5} textAnchor="middle" dominantBaseline="middle" fontFamily={FONT} fontSize={labelFont} fontWeight={600} fill={MUTED}>
          {LETTERS[r]}
        </text>,
      )
    }
    for (let c = 0; c < plate.cols; c += step) {
      heads.push(
        <text key={`c${c}`} x={g.x0 + c * g.pitch + g.pitch / 2} y={g.y0 - (look === 'grid' ? 7 : 9)} textAnchor="middle" dominantBaseline="middle" fontFamily={FONT} fontSize={labelFont} fontWeight={600} fill={MUTED}>
          {c + 1}
        </text>,
      )
    }
  }

  const b = g.body
  const cut = Math.min(14, b.w * 0.05)
  return (
    <g>
      {look === 'plate' && (
        <>
          <path
            d={`M ${b.x + cut} ${b.y} H ${b.x + b.w - 6} a 6 6 0 0 1 6 6 V ${b.y + b.h - 6} a 6 6 0 0 1 -6 6 H ${b.x + 6} a 6 6 0 0 1 -6 -6 V ${b.y + cut} Z`}
            fill="#fafafa"
            stroke="#a1a1aa"
            strokeWidth={mini ? 0.8 : 1.2}
          />
          <rect x={g.x0 - 3} y={g.y0 - 3} width={plate.cols * g.pitch + 6} height={plate.rows * g.pitch + 6} rx={4} fill="none" stroke="#e4e4e7" strokeWidth={mini ? 0.5 : 0.8} />
        </>
      )}
      {look === 'labelled' && <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={8} fill="#ffffff" stroke="#d4d4d8" strokeWidth={mini ? 0.8 : 1} />}
      {heads}
      {wells}
      {box && <rect x={box.x} y={box.y} width={box.w} height={box.h} fill={SELECTION} fillOpacity={0.06} stroke={SELECTION} strokeWidth={1} strokeDasharray="4 3" />}
      {legend && !mini && <Legend look={look} conditions={conditions} map={map} at={g.legend} width={look === 'grid' ? b.w : 150} />}
    </g>
  )
}

/** The legend lists the conditions that have wells, in the conditions' order. */
function Legend({ look, conditions, map, at, width }: { look: Look; conditions: Condition[]; map: WellMap; at: { x: number; y: number }; width: number }) {
  const used = new Set(Object.values(map))
  const shown = conditions.filter((c) => used.has(c.id))
  const swatch = (c: Condition, x: number, y: number) =>
    look === 'grid' ? <rect x={x} y={y - 5} width={10} height={10} rx={1.5} fill={c.colour} /> : <circle cx={x + 5} cy={y} r={5} fill={c.colour} stroke={edgeOf(c.colour)} strokeWidth={0.8} />

  if (look === 'grid') {
    // In rows under the plate, wrapping at the plate's width.
    let x = at.x
    let y = at.y
    const items = shown.map((c) => {
      const w = 16 + c.name.length * 5.6 + 14
      if (x + w > at.x + width && x > at.x) {
        x = at.x
        y += 18
      }
      const item = (
        <g key={c.id}>
          {swatch(c, x, y)}
          <text x={x + 15} y={y + 0.5} dominantBaseline="middle" fontFamily={FONT} fontSize={10.5} fill={INK}>
            {c.name}
          </text>
        </g>
      )
      x += w
      return item
    })
    return <g>{items}</g>
  }

  if (look === 'labelled') {
    // Single conditions one per line; a dose series as one strip of its wells with the doses under it.
    const singles = shown.filter((c) => !c.series)
    const series = [...new Set(shown.flatMap((c) => (c.series ? [c.series] : [])))]
    let y = at.y
    const parts: ReactNode[] = []
    for (const c of singles) {
      parts.push(
        <g key={c.id}>
          <circle cx={at.x + 8} cy={y} r={8} fill={c.colour} stroke={edgeOf(c.colour)} strokeWidth={0.8} />
          <text x={at.x + 8} y={y + 0.5} textAnchor="middle" dominantBaseline="middle" fontFamily={FONT} fontSize={7.5} fontWeight={600} fill={isDark(c.colour) ? '#fff' : INK}>
            {c.short}
          </text>
          <text x={at.x + 22} y={y + 0.5} dominantBaseline="middle" fontFamily={FONT} fontSize={10.5} fill={INK}>
            {c.name}
          </text>
        </g>,
      )
      y += 22
    }
    for (const s of series) {
      const steps = shown.filter((c) => c.series === s)
      y += 6
      parts.push(
        <g key={s}>
          <text x={at.x} y={y} dominantBaseline="middle" fontFamily={FONT} fontSize={10.5} fontWeight={600} fill={INK}>
            {s}
          </text>
          {steps.map((c, i) => (
            <g key={c.id}>
              <rect x={at.x + i * 26} y={y + 10} width={26} height={12} fill={c.colour} />
              <text x={at.x + i * 26 + 13} y={y + 32} textAnchor="middle" dominantBaseline="middle" fontFamily={FONT} fontSize={9.5} fill={MUTED}>
                {c.short}
              </text>
            </g>
          ))}
          <rect x={at.x} y={y + 10} width={steps.length * 26} height={12} fill="none" stroke="#a1a1aa" strokeWidth={0.6} />
        </g>,
      )
      y += 44
    }
    return <g>{parts}</g>
  }

  return (
    <g>
      {shown.map((c, i) => (
        <g key={c.id}>
          {swatch(c, at.x, at.y + i * 19)}
          <text x={at.x + 16} y={at.y + i * 19 + 0.5} dominantBaseline="middle" fontFamily={FONT} fontSize={10.5} fill={INK}>
            {c.name}
          </text>
        </g>
      ))}
    </g>
  )
}

/* ---------- The editor around it ---------- */

function Panel({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section aria-label={title} className="flex w-[280px] shrink-0 flex-col overflow-y-auto border-r border-border bg-panel last:border-r-0 last:border-l">
      {children}
    </section>
  )
}

function SectionHead({ children }: { children: ReactNode }) {
  return <h3 className="px-3 pt-3 pb-1.5 text-xs font-medium text-muted-foreground">{children}</h3>
}

function BlocksTool({ look }: { look: Look }) {
  const cards = [PLATES[4], PLATES[2]]
  return (
    <Panel title="Blocks">
      <SectionHead>Panels</SectionHead>
      <div className="grid grid-cols-2 gap-2 px-3">
        {['Panel', 'Panel with 3 icons'].map((name) => (
          <div key={name} className="flex flex-col gap-1.5 rounded-md border border-border-strong bg-panel p-1.5 text-muted-foreground">
            <span className="flex aspect-[3/2] w-full items-center justify-center rounded-sm bg-white p-2.5">
              <svg viewBox="0 0 120 80" className="size-full">
                <rect x={2} y={2} width={116} height={76} rx={6} fill="#0072b2" fillOpacity={0.06} stroke="#0072b2" strokeOpacity={0.5} />
                <path d="M 2 18 V 8 a 6 6 0 0 1 6 -6 H 112 a 6 6 0 0 1 6 6 V 18 Z" fill="#0072b2" fillOpacity={0.85} />
                {name !== 'Panel' && [0, 1, 2].map((i) => <rect key={i} x={14 + i * 34} y={32} width={26} height={26} rx={4} fill="none" stroke="#0072b2" strokeOpacity={0.4} strokeDasharray="3 3" />)}
              </svg>
            </span>
            <span className="text-xs leading-tight">{name}</span>
          </div>
        ))}
      </div>
      <SectionHead>Sequences · Graph layouts</SectionHead>
      <p className="px-3 text-xs text-muted-foreground/70">(as now)</p>
      <SectionHead>Well plates</SectionHead>
      <div className="grid grid-cols-2 gap-2 px-3 pb-3">
        {cards.map((plate) => {
          const g = geometry(look, plate, { x: 4, y: 4, w: 112, h: 72 }, false, false)
          return (
            <button key={plate.wells} type="button" className="flex flex-col gap-1.5 rounded-md border border-border-strong bg-panel p-1.5 text-left text-muted-foreground hover:bg-muted hover:text-foreground">
              <span className="flex aspect-[3/2] w-full items-center justify-center rounded-sm bg-white p-1.5">
                <svg viewBox="0 0 120 80" className="size-full">
                  <PlateDrawing look={look} plate={plate} map={startMap(plate, START)} conditions={START} g={g} labels={false} legend={false} mini />
                </svg>
              </span>
              <span className="text-xs leading-tight">{plate.wells}-well plate</span>
            </button>
          )
        })}
      </div>
    </Panel>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-10 items-center gap-2 px-3">
      <span className="w-16 shrink-0 text-xs text-muted-foreground">{label}</span>
      <div className="flex min-w-0 flex-1 items-center">{children}</div>
    </div>
  )
}

/** A tiny plate for the size buttons: the real grid of wells, so 6 and 384 look different. */
function SizePicture({ plate, on, onClick }: { plate: Plate; on: boolean; onClick: () => void }) {
  const pitch = Math.min(28 / plate.cols, 18 / plate.rows)
  const x0 = (32 - pitch * plate.cols) / 2
  const y0 = (22 - pitch * plate.rows) / 2
  return (
    <button
      type="button"
      title={`${plate.wells}-well plate`}
      onClick={onClick}
      className={cn('flex flex-col items-center gap-0.5 rounded-md border bg-white px-0.5 pt-1 pb-0.5', on ? 'border-primary ring-1 ring-primary' : 'border-border-strong hover:bg-muted')}
    >
      <svg viewBox="0 0 32 22" className="h-[18px] w-[26px]">
        {Array.from({ length: plate.rows }, (_, r) =>
          Array.from({ length: plate.cols }, (_, c) => <circle key={`${r}-${c}`} cx={x0 + c * pitch + pitch / 2} cy={y0 + r * pitch + pitch / 2} r={pitch * 0.38} fill={on ? '#0072b2' : '#a1a1aa'} />),
        )}
      </svg>
      <span className={cn('text-[10px] leading-none tabular-nums', on ? 'text-foreground' : 'text-muted-foreground')}>{plate.wells}</span>
    </button>
  )
}

type PlateState = ReturnType<typeof usePlate>

function usePlate() {
  const [plate, setPlate] = useState<Plate>(PLATES[4])
  const [conditions, setConditions] = useState<Condition[]>(START)
  const [map, setMap] = useState<WellMap>(() => startMap(PLATES[4], START))
  const [active, setActive] = useState<string | null>('d3')
  const [labels, setLabels] = useState(true)
  const [legend, setLegend] = useState(true)
  const paint = (wells: Iterable<string>, id: string | null) =>
    setMap((m) => {
      const next = { ...m }
      for (const k of wells) {
        if (id) next[k] = id
        else delete next[k]
      }
      return next
    })
  const changeSize = (p: Plate) => {
    setPlate(p)
    setMap(startMap(p, conditions))
  }
  const add = () => {
    const usedColours = new Set(conditions.map((c) => c.colour))
    const colour = NEW_COLOURS.find((c) => !usedColours.has(c)) ?? '#71717a'
    const n = conditions.length + 1
    const c: Condition = { id: `c${Date.now()}`, name: `Condition ${n}`, colour, short: `${n}` }
    setConditions([...conditions, c])
    setActive(c.id)
  }
  const remove = (id: string) => {
    setConditions(conditions.filter((c) => c.id !== id))
    setMap((m) => Object.fromEntries(Object.entries(m).filter(([, v]) => v !== id)))
    if (active === id) setActive(null)
  }
  const update = (id: string, change: Partial<Condition>) => setConditions(conditions.map((c) => (c.id === id ? { ...c, ...change } : c)))
  const reset = () => {
    setPlate(PLATES[4])
    setConditions(START)
    setMap(startMap(PLATES[4], START))
    setActive('d3')
  }
  return { plate, conditions, map, active, setActive, labels, setLabels, legend, setLegend, paint, changeSize, add, remove, update, reset }
}

function PlateProperties({ look, s, assign }: { look: Look; s: PlateState; assign?: (id: string | null) => void }) {
  const counts = new Map<string, number>()
  for (const id of Object.values(s.map)) counts.set(id, (counts.get(id) ?? 0) + 1)
  const brush = look === 'plate'
  return (
    <Panel title="Well plate properties">
      <div className="flex h-12 items-center gap-2 border-b border-border px-2">
        <button type="button" aria-label="Back to blocks" className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted">
          <ArrowLeft className="size-4" />
        </button>
        <Grid3x3 className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">Well plate</span>
      </div>
      <div className="flex flex-col py-1">
        <Row label="Wells">
          <div className="grid w-full grid-cols-6 gap-1">
            {PLATES.map((p) => (
              <SizePicture key={p.wells} plate={p} on={p.wells === s.plate.wells} onClick={() => s.changeSize(p)} />
            ))}
          </div>
        </Row>
        <Row label="Labels">
          <Toggle label="Row letters and column numbers" hideLabel checked={s.labels} onCheckedChange={s.setLabels} />
        </Row>
        <Row label="Legend">
          <SegmentedToggle
            label="Legend"
            showLabels
            className="h-8 flex-1"
            value={s.legend ? 'shown' : 'hidden'}
            onValueChange={(v) => s.setLegend(v === 'shown')}
            options={[
              { value: 'shown', label: 'Shown' },
              { value: 'hidden', label: 'Hidden' },
            ]}
          />
        </Row>
      </div>
      <div className="flex items-center justify-between border-t border-border px-3 pt-3 pb-1.5">
        <span className="text-xs font-medium text-muted-foreground">Conditions</span>
        <span className="text-[11px] text-muted-foreground">Wells</span>
      </div>
      <div className="flex flex-col gap-0.5 px-2 pb-2">
        {brush && (
          <ConditionRow active={s.active === null} onPick={() => s.setActive(null)}>
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-dashed border-border-strong bg-white">
              <Eraser className="size-3.5 text-muted-foreground" />
            </span>
            <span className="flex-1 truncate px-1 text-xs text-muted-foreground">Empty</span>
            <span className="w-7 text-right text-[11px] text-muted-foreground tabular-nums">{s.plate.wells - Object.keys(s.map).length}</span>
            <span className="size-6" />
          </ConditionRow>
        )}
        {s.conditions.map((c) => (
          <ConditionRow key={c.id} active={brush && s.active === c.id} onPick={() => (assign ? assign(c.id) : s.setActive(c.id))}>
            <ColourMenu
              label={`Colour of ${c.name}`}
              value={c.colour}
              onChange={(colour) => colour && s.update(c.id, { colour })}
              trigger={
                <button type="button" aria-label={`Colour of ${c.name}`} className={cn('size-6 shrink-0 border border-black/15', look === 'grid' ? 'rounded-[4px]' : 'rounded-full')} style={{ background: c.colour }} />
              }
            />
            {look === 'labelled' && (
              <input
                aria-label={`Label in the wells for ${c.name}`}
                value={c.short}
                onChange={(e) => s.update(c.id, { short: e.target.value.slice(0, 3) })}
                className="h-7 w-9 shrink-0 rounded-md border border-border bg-transparent px-1 text-center text-xs font-semibold"
              />
            )}
            <input
              aria-label="Condition name"
              value={c.name}
              onChange={(e) => s.update(c.id, { name: e.target.value })}
              className="h-7 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1 text-xs hover:border-border focus:border-primary focus:outline-none"
            />
            <span className="w-7 text-right text-[11px] text-muted-foreground tabular-nums">{counts.get(c.id) ?? 0}</span>
            <button type="button" aria-label={`Remove ${c.name}`} onClick={(e) => (e.stopPropagation(), s.remove(c.id))} className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
              <Minus className="size-3.5" />
            </button>
          </ConditionRow>
        ))}
        <button type="button" onClick={s.add} className="mt-1 flex h-8 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
          <Plus className="size-3.5" />
          Add condition
        </button>
      </div>
      <div className="mt-auto border-t border-border p-3">
        <Button variant="secondary" size="sm" className="w-full gap-1.5">
          <Ungroup aria-hidden="true" />
          Detach plate
        </Button>
      </div>
    </Panel>
  )
}

function ConditionRow({ active, onPick, children }: { active: boolean; onPick: () => void; children: ReactNode }) {
  return (
    <div
      onClick={(e) => {
        if ((e.target as Element).closest('button, input')) return
        onPick()
      }}
      className={cn('flex h-9 cursor-pointer items-center gap-1.5 rounded-md border px-1.5', active ? 'border-primary bg-primary-subtle' : 'border-transparent hover:bg-muted')}
    >
      {active && <Paintbrush className="-ml-0.5 size-3 shrink-0 text-primary" aria-label="Painting with this" />}
      {children}
    </div>
  )
}

/* ---------- B: the condition bar floating over the plate ---------- */

function BrushBar({ s, left, top }: { s: PlateState; left: number; top: number }) {
  return (
    <div style={{ left, top }} className="absolute flex max-w-[640px] flex-wrap items-center gap-1 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg">
      <span className="flex items-center gap-1 px-1.5 text-xs text-muted-foreground">
        <Paintbrush className="size-3.5" />
      </span>
      {s.conditions.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => s.setActive(c.id)}
          className={cn('flex h-7 items-center gap-1.5 rounded-md px-2 text-xs', s.active === c.id ? 'bg-primary-subtle text-foreground ring-1 ring-primary' : 'text-muted-foreground hover:bg-muted')}
        >
          <span className="size-3 rounded-[3px]" style={{ background: c.colour }} />
          {c.name.replace(/ \(.+\)$/, '')}
        </button>
      ))}
      <span className="mx-0.5 h-5 w-px bg-border" />
      <button type="button" onClick={() => s.setActive(null)} className={cn('flex h-7 items-center gap-1.5 rounded-md px-2 text-xs', s.active === null ? 'bg-primary-subtle ring-1 ring-primary' : 'text-muted-foreground hover:bg-muted')}>
        <Eraser className="size-3.5" />
        Erase
      </button>
      <button type="button" onClick={s.add} aria-label="Add condition" className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted">
        <Plus className="size-3.5" />
      </button>
    </div>
  )
}

/* ---------- C: the bar over a selection of wells ---------- */

function AssignBar({ s, count, left, top, onAssign }: { s: PlateState; count: number; left: number; top: number; onAssign: (id: string | null) => void }) {
  return (
    <div style={{ left, top }} className="absolute flex items-center gap-1 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg">
      <span className="px-1.5 text-xs whitespace-nowrap text-muted-foreground tabular-nums">{count} wells</span>
      <span className="h-5 w-px bg-border" />
      {s.conditions.map((c) => (
        <button
          key={c.id}
          type="button"
          title={c.name}
          onClick={() => onAssign(c.id)}
          className="flex size-7 items-center justify-center rounded-full text-[9px] font-semibold hover:ring-2 hover:ring-primary"
          style={{ background: c.colour, color: isDark(c.colour) ? '#fff' : INK, boxShadow: `inset 0 0 0 1px ${edgeOf(c.colour)}` }}
        >
          {c.short}
        </button>
      ))}
      <span className="h-5 w-px bg-border" />
      <button type="button" title="Clear" onClick={() => onAssign(null)} className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted">
        <Eraser className="size-3.5" />
      </button>
    </div>
  )
}

/* ---------- One version: the whole screen ---------- */

const PAGE = { w: 640, h: 400 }
const AREA = { x: 36, y: 40, w: 568, h: 330 }
const ZOOM = 1.3

function rectWells(a: { r: number; c: number }, b: { r: number; c: number }) {
  const set = new Set<string>()
  for (let r = Math.min(a.r, b.r); r <= Math.max(a.r, b.r); r++) for (let c = Math.min(a.c, b.c); c <= Math.max(a.c, b.c); c++) set.add(key(r, c))
  return set
}

function Version({ look, title, note }: { look: Look; title: string; note: string }) {
  const s = usePlate()
  const svg = useRef<SVGSVGElement>(null)
  const g = geometry(look, s.plate, AREA, s.labels, s.legend)
  const clampWell = (p: { x: number; y: number }) => {
    const w = wellAt(g, s.plate, p.x, p.y)
    return { r: Math.max(0, Math.min(s.plate.rows - 1, w.r)), c: Math.max(0, Math.min(s.plate.cols - 1, w.c)), inside: w.inside }
  }
  const [drag, setDrag] = useState<{ from: { r: number; c: number }; to: { r: number; c: number }; add: boolean } | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const point = (e: ReactPointerEvent) => {
    const m = svg.current?.getScreenCTM()
    if (!m) return { x: 0, y: 0 }
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse())
    return { x: p.x, y: p.y }
  }

  const down = (e: ReactPointerEvent<SVGSVGElement>) => {
    const p = point(e)
    const w = wellAt(g, s.plate, p.x, p.y)
    // A: a click on a letter or number fills that whole row or column.
    if (look === 'plate' && s.labels && !w.inside) {
      const onLetters = p.x < g.x0 && p.x > g.x0 - 18 && w.r >= 0 && w.r < s.plate.rows
      const onNumbers = p.y < g.y0 && p.y > g.y0 - 18 && w.c >= 0 && w.c < s.plate.cols
      if (onLetters) s.paint(rectWells({ r: w.r, c: 0 }, { r: w.r, c: s.plate.cols - 1 }), s.active)
      if (onNumbers) s.paint(rectWells({ r: 0, c: w.c }, { r: s.plate.rows - 1, c: w.c }), s.active)
      return
    }
    if (!w.inside) {
      if (look === 'labelled') setSelected(new Set())
      return
    }
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrag({ from: w, to: w, add: e.shiftKey })
    if (look === 'grid') s.paint([key(w.r, w.c)], s.active)
  }
  const move = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!drag) return
    const w = clampWell(point(e))
    if (w.r === drag.to.r && w.c === drag.to.c) return
    if (look === 'grid') {
      if (w.inside) s.paint([key(w.r, w.c)], s.active)
    }
    setDrag({ ...drag, to: w })
  }
  const up = () => {
    if (!drag) return
    const wells = rectWells(drag.from, drag.to)
    if (look === 'plate') s.paint(wells, s.active)
    if (look === 'labelled') setSelected(drag.add ? new Set([...selected, ...wells]) : wells)
    setDrag(null)
  }

  const dragWells = drag && look !== 'grid' ? rectWells(drag.from, drag.to) : undefined
  const dragBox = drag && look !== 'grid'
    ? {
        x: g.x0 + Math.min(drag.from.c, drag.to.c) * g.pitch,
        y: g.y0 + Math.min(drag.from.r, drag.to.r) * g.pitch,
        w: (Math.abs(drag.to.c - drag.from.c) + 1) * g.pitch,
        h: (Math.abs(drag.to.r - drag.from.r) + 1) * g.pitch,
      }
    : undefined
  const activeColour = s.conditions.find((c) => c.id === s.active)?.colour ?? null
  const shownSelection = look === 'labelled' ? (dragWells ? (drag?.add ? new Set([...selected, ...dragWells]) : dragWells) : selected) : undefined

  // Where the selection's top edge is, for the bar in C.
  let selTop = Infinity
  let selMid = 0
  if (look === 'labelled' && !drag && selected.size) {
    let minC = Infinity
    let maxC = -Infinity
    for (const k of selected) {
      const [r, c] = k.split('-').map(Number) as [number, number]
      selTop = Math.min(selTop, g.y0 + r * g.pitch)
      minC = Math.min(minC, c)
      maxC = Math.max(maxC, c)
    }
    selMid = g.x0 + ((minC + maxC + 1) / 2) * g.pitch
  }
  const assign = (id: string | null) => {
    s.paint(selected, id)
    setSelected(new Set())
  }

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <div className="flex items-center gap-3 border-b border-border px-4 py-2">
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-xs text-muted-foreground">{note}</span>
        <button type="button" onClick={() => (s.reset(), setSelected(new Set()))} className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <RotateCcw className="size-3.5" />
          Start again
        </button>
      </div>
      <div className="flex min-h-0 flex-1">
        <BlocksTool look={look} />
        <div className="relative flex min-w-0 flex-1 items-center justify-center overflow-auto bg-canvas p-8">
          <div className="relative shadow-md" style={{ width: PAGE.w * ZOOM, height: PAGE.h * ZOOM }}>
            <svg
              ref={svg}
              viewBox={`0 0 ${PAGE.w} ${PAGE.h}`}
              width={PAGE.w * ZOOM}
              height={PAGE.h * ZOOM}
              className={cn('block touch-none bg-white select-none', look === 'grid' ? 'cursor-crosshair' : 'cursor-default')}
              onPointerDown={down}
              onPointerMove={move}
              onPointerUp={up}
            >
              {/* The plate's selection box on the page. */}
              <rect x={g.body.x - 6} y={g.body.y - (look === 'grid' && s.labels ? 24 : 6)} width={(s.legend && look !== 'grid' ? g.legend.x + 150 : g.body.x + g.body.w) - g.body.x + 12} height={g.body.h + (look === 'grid' && s.labels ? 18 : 0) + (look === 'grid' && s.legend ? 66 : 0) + 12} fill="none" stroke={SELECTION} strokeWidth={1} />
              <PlateDrawing
                look={look}
                plate={s.plate}
                map={s.map}
                conditions={s.conditions}
                g={g}
                labels={s.labels}
                legend={s.legend}
                preview={look === 'plate' && dragWells ? { wells: dragWells, colour: activeColour } : undefined}
                selected={shownSelection}
                box={dragBox}
              />
            </svg>
            {look === 'grid' && <BrushBar s={s} left={(g.body.x - 6) * ZOOM} top={(g.body.y - (s.labels ? 24 : 6)) * ZOOM - 84} />}
            {look === 'labelled' && selected.size > 0 && Number.isFinite(selTop) && (
              <AssignBar s={s} count={selected.size} left={Math.max(4, selMid * ZOOM - 190)} top={selTop * ZOOM - 48} onAssign={assign} />
            )}
          </div>
        </div>
        <PlateProperties look={look} s={s} assign={look === 'labelled' && selected.size ? assign : undefined} />
      </div>
    </div>
  )
}

export const A_RealPlate: Story = {
  name: 'A · Real plate',
  render: () => <Version look="plate" title="A · Real plate" note="Pick a condition on the right, drag a box over wells; click a letter or number for a whole row or column" />,
}

export const B_GridMap: Story = {
  name: 'B · Grid map',
  render: () => <Version look="grid" title="B · Grid map" note="Square cells, legend underneath; pick a condition in the floating bar and brush over wells" />,
}

export const C_LabelledWells: Story = {
  name: 'C · Labelled wells',
  render: () => <Version look="labelled" title="C · Labelled wells" note="Short label in each well; select wells (drag, Shift adds), then click a condition in the bar above them" />,
}

/** Every plate size in each look, to compare them. */
export const AllSizes: Story = {
  name: 'All sizes, each look',
  render: () => (
    <div className="flex flex-col gap-6 bg-canvas p-6">
      {(['plate', 'grid', 'labelled'] as const).map((look) => (
        <div key={look} className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-foreground">{look === 'plate' ? 'A · Real plate' : look === 'grid' ? 'B · Grid map' : 'C · Labelled wells'}</span>
          <div className="flex flex-wrap gap-4">
            {PLATES.map((plate) => {
              const g = geometry(look, plate, { x: 10, y: 10, w: 300, h: 200 }, true, false)
              return (
                <div key={plate.wells} className="flex flex-col gap-1">
                  <svg viewBox="0 0 320 220" width={320} height={220} className="bg-white shadow-sm">
                    <PlateDrawing look={look} plate={plate} map={startMap(plate, START)} conditions={START} g={g} labels legend={false} />
                  </svg>
                  <span className="text-xs text-muted-foreground">{plate.wells} wells</span>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  ),
}
