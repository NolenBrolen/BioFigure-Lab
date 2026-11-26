/*
 * BIO-86 design drafts: figure grid blocks (multi-panel figures) with chart
 * spaces, panel letters and a shared legend. Visual drafts only: no tests,
 * no accessibility pass, nothing wired up. After the owner picks, the chosen
 * version gets built properly in the editor.
 *
 * Every version shows the same things: the Layouts section of the Blocks
 * tool (five layouts), a 2 x 2 grid on the page with two charts filled in,
 * one empty chart space selected and one empty, the shared legend under it,
 * and the grid's properties.
 *
 *   A  Open grid      No frames. Bold letters outside each cell's corner,
 *                     like a journal figure. A selected space opens the
 *                     chart types in the left panel (as icon spaces do).
 *   B  Framed cells   Each cell is a card with a thin outline; the letter is
 *                     a small dark square inside its corner. A selected
 *                     space shows the chart types in a bar floating above it.
 *   C  Corner badges  No frames; the letter sits in a round badge on the
 *                     space's corner. A selected space shows the three chart
 *                     pictures inside itself: click one to fill it.
 */
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ArrowLeft, Eye, EyeOff, LayoutGrid, MoreHorizontal, Ungroup } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { Button } from '../../components/button/Button'
import { GraphTypePicture, type ChartKind } from '../../components/graph-panel/GraphTypePicker'
import { SegmentedToggle } from '../../components/segmented-toggle/SegmentedToggle'
import { Slider } from '../../components/slider/Slider'
import { Toggle } from '../../components/toggle/Toggle'

const meta = {
  title: 'Drafts/BIO-86 Figure grids',
  parameters: { controls: { disable: true }, layout: 'fullscreen' },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

/* ---------- Layouts: cells on a grid of columns and rows ---------- */

type Cell = { col: number; row: number; cols?: number; rows?: number }
type Layout = { id: string; name: string; cols: number; rows: number; cells: Cell[] }

const LAYOUTS: Layout[] = [
  { id: 'two', name: '2 side by side', cols: 2, rows: 1, cells: [{ col: 0, row: 0 }, { col: 1, row: 0 }] },
  { id: 'grid', name: '2 × 2', cols: 2, rows: 2, cells: [{ col: 0, row: 0 }, { col: 1, row: 0 }, { col: 0, row: 1 }, { col: 1, row: 1 }] },
  { id: 'big', name: '1 big + 2 small', cols: 2, rows: 2, cells: [{ col: 0, row: 0, rows: 2 }, { col: 1, row: 0 }, { col: 1, row: 1 }] },
  { id: 'three', name: '3 in a row', cols: 3, rows: 1, cells: [{ col: 0, row: 0 }, { col: 1, row: 0 }, { col: 2, row: 0 }] },
  { id: 'six', name: '2 × 3', cols: 3, rows: 2, cells: [0, 1, 2, 3, 4, 5].map((i) => ({ col: i % 3, row: Math.floor(i / 3) })) },
]

type Box = { x: number; y: number; w: number; h: number }

function cellBoxes(layout: Layout, area: Box, gap: number): Box[] {
  const cw = (area.w - gap * (layout.cols - 1)) / layout.cols
  const ch = (area.h - gap * (layout.rows - 1)) / layout.rows
  return layout.cells.map((c) => ({
    x: area.x + c.col * (cw + gap),
    y: area.y + c.row * (ch + gap),
    w: cw * (c.cols ?? 1) + gap * ((c.cols ?? 1) - 1),
    h: ch * (c.rows ?? 1) + gap * ((c.rows ?? 1) - 1),
  }))
}

/* ---------- Colours and data ---------- */

const SERIES = [
  { name: 'Control', colour: '#0072b2' },
  { name: 'Drug A', colour: '#e69f00' },
  { name: 'Drug B', colour: '#009e73' },
]
const GREY = '#71717a'
const SELECTION = 'var(--color-selection)'

type Look = 'open' | 'framed' | 'badges'
type LetterStyle = { on: boolean; bold: boolean; upper: boolean }
const letter = (i: number, style: LetterStyle) => {
  const l = String.fromCharCode(65 + i)
  return style.upper ? l : l.toLowerCase()
}

/* ---------- Charts that fill a space (simple, real looking) ---------- */

function Axes({ b }: { b: Box }) {
  return <path d={`M ${b.x} ${b.y} V ${b.y + b.h} H ${b.x + b.w}`} stroke="#27272a" strokeWidth={1} fill="none" />
}

function BarChart({ box }: { box: Box }) {
  const plot = { x: box.x + 22, y: box.y + 8, w: box.w - 30, h: box.h - 30 }
  const values = [0.45, 0.78, 0.62]
  const errors = [0.06, 0.09, 0.07]
  const slot = plot.w / values.length
  return (
    <g>
      {[0, 0.5, 1].map((t) => (
        <g key={t}>
          <line x1={plot.x - 3} x2={plot.x} y1={plot.y + plot.h * (1 - t)} y2={plot.y + plot.h * (1 - t)} stroke="#27272a" strokeWidth={1} />
          <text x={plot.x - 5} y={plot.y + plot.h * (1 - t) + 3} fontSize={7} textAnchor="end" fill="#3f3f46">
            {t * 100}
          </text>
        </g>
      ))}
      <text x={box.x + 5} y={plot.y + plot.h / 2} fontSize={7} fill="#3f3f46" transform={`rotate(-90 ${box.x + 5} ${plot.y + plot.h / 2})`} textAnchor="middle">
        Viability (%)
      </text>
      {values.map((v, i) => {
        const x = plot.x + slot * i + slot * 0.2
        const w = slot * 0.6
        const top = plot.y + plot.h * (1 - v)
        const e = plot.h * errors[i]
        return (
          <g key={i}>
            <rect x={x} y={top} width={w} height={plot.h * v} fill={SERIES[i].colour} />
            <path d={`M ${x + w / 2} ${top} V ${top - e} M ${x + w / 2 - 4} ${top - e} H ${x + w / 2 + 4}`} stroke="#27272a" strokeWidth={1} />
            <text x={x + w / 2} y={plot.y + plot.h + 10} fontSize={7} textAnchor="middle" fill="#3f3f46">
              {SERIES[i].name}
            </text>
          </g>
        )
      })}
      <Axes b={plot} />
    </g>
  )
}

function LineChart({ box }: { box: Box }) {
  const plot = { x: box.x + 22, y: box.y + 8, w: box.w - 30, h: box.h - 30 }
  const lines = [
    [0.1, 0.35, 0.55, 0.7, 0.78],
    [0.1, 0.25, 0.32, 0.4, 0.44],
    [0.1, 0.18, 0.2, 0.22, 0.24],
  ]
  const px = (i: number) => plot.x + (plot.w * i) / 4
  const py = (v: number) => plot.y + plot.h * (1 - v)
  return (
    <g>
      {[0, 6, 12, 18, 24].map((h, i) => (
        <text key={h} x={px(i)} y={plot.y + plot.h + 10} fontSize={7} textAnchor="middle" fill="#3f3f46">
          {h}
        </text>
      ))}
      <text x={plot.x + plot.w / 2} y={box.y + box.h - 1} fontSize={7} textAnchor="middle" fill="#3f3f46">
        Time (h)
      </text>
      {lines.map((line, s) => (
        <g key={s}>
          <polyline points={line.map((v, i) => `${px(i)},${py(v)}`).join(' ')} fill="none" stroke={SERIES[s].colour} strokeWidth={1.4} />
          {line.map((v, i) => (
            <circle key={i} cx={px(i)} cy={py(v)} r={2.2} fill={SERIES[s].colour} />
          ))}
        </g>
      ))}
      <Axes b={plot} />
    </g>
  )
}

/* ---------- Empty chart spaces, one look per version ---------- */

/** A faded chart picture in the middle of an empty space, like the icon space's faded cell. */
function EmptyGlyph({ box, kind, colour }: { box: Box; kind: 'bars' | 'line' | 'dots'; colour: string }) {
  const s = Math.min(34, Math.min(box.w, box.h) * 0.36)
  const x = box.x + box.w / 2 - s / 2
  const y = box.y + box.h / 2 - s / 2
  const faint = { stroke: colour, strokeOpacity: 0.4, strokeWidth: 1.2, fill: 'none', strokeLinecap: 'round' as const }
  return (
    <g>
      <path d={`M ${x} ${y} V ${y + s} H ${x + s}`} {...faint} />
      {kind === 'bars' &&
        [0.45, 0.8, 0.6].map((v, i) => <rect key={i} x={x + s * (0.14 + i * 0.29)} y={y + s * (1 - v)} width={s * 0.18} height={s * v - 1} fill={colour} fillOpacity={0.22} rx={1} />)}
      {kind === 'line' && <polyline points={[0.2, 0.5, 0.42, 0.75, 0.85].map((v, i) => `${x + s * (0.1 + i * 0.21)},${y + s * (1 - v)}`).join(' ')} {...faint} strokeOpacity={0.45} />}
      {kind === 'dots' &&
        [
          [0.2, 0.3],
          [0.35, 0.5],
          [0.5, 0.45],
          [0.62, 0.7],
          [0.8, 0.78],
        ].map(([a, b], i) => <circle key={i} cx={x + s * a} cy={y + s * (1 - b)} r={2} fill={colour} fillOpacity={0.3} />)}
      {/* The small plus badge, cut out of the picture like the icon space's. */}
      <circle cx={x + s + 2} cy={y + s - 2} r={6.5} fill="#fcfcfd" />
      <circle cx={x + s + 2} cy={y + s - 2} r={5} fill={colour} fillOpacity={0.45} />
      <path d={`M ${x + s - 0.5} ${y + s - 2} h 5 M ${x + s + 2} ${y + s - 4.5} v 5`} stroke="#fff" strokeWidth={1.25} strokeLinecap="round" />
    </g>
  )
}

function DashedSpace({ box, selected, mini }: { box: Box; selected?: boolean; mini?: boolean }) {
  return (
    <>
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={mini ? 2.5 : 6} fill={GREY} fillOpacity={mini ? 0.14 : 0.05} stroke={GREY} strokeOpacity={mini ? 0.6 : 0.35} strokeDasharray={mini ? '2 1.5' : '3 3'} strokeWidth={mini ? 0.8 : 1} />
      {selected && <rect x={box.x - 1.5} y={box.y - 1.5} width={box.w + 3} height={box.h + 3} rx={7} fill="none" stroke={SELECTION} strokeWidth={1.5} />}
    </>
  )
}

/* ---------- The grid on the page ---------- */

type Fill = 'bar' | 'line' | undefined

type GridProps = {
  look: Look
  layout: Layout
  area: Box
  gap: number
  fills?: Fill[]
  selected?: number
  letters: LetterStyle
  legend: boolean
  /** Small (card pictures): no chart text, smaller letters. */
  mini?: boolean
}

const LEGEND_H = 18

function GridDrawing({ look, layout, area, gap, fills = [], selected, letters, legend, mini }: GridProps) {
  const letterRoom = look === 'open' && letters.on ? (mini ? 7 : 14) : 0
  const legendRoom = legend ? (mini ? 8 : LEGEND_H + 8) : 0
  const inner = { x: area.x + letterRoom, y: area.y + letterRoom, w: area.w - letterRoom, h: area.h - letterRoom - legendRoom }
  // The open look needs room above and left of every cell for its letter.
  const cells = cellBoxes(layout, inner, gap + (look === 'open' ? letterRoom : 0))
  const glyph: 'bars' | 'line' | 'dots' = look === 'open' ? 'bars' : look === 'framed' ? 'line' : 'dots'
  const size = mini ? 7 : 13
  return (
    <g fontFamily="Inter Variable, Inter, sans-serif">
      {cells.map((cell, i) => {
        const fill = fills[i]
        const space = look === 'framed' ? { x: cell.x + (mini ? 4 : 10), y: cell.y + (mini ? 6 : 22), w: cell.w - (mini ? 8 : 20), h: cell.h - (mini ? 10 : 32) } : cell
        return (
          <g key={i}>
            {look === 'framed' && <rect x={cell.x} y={cell.y} width={cell.w} height={cell.h} rx={mini ? 3 : 6} fill="#ffffff" stroke="#d4d4d8" strokeWidth={1} />}
            {fill === 'bar' && !mini ? <BarChart box={space} /> : fill === 'line' && !mini ? <LineChart box={space} /> : null}
            {(!fill || mini) && (
              <>
                <DashedSpace box={space} selected={selected === i} mini={mini} />
                {mini ? null : <EmptyGlyph box={space} kind={glyph} colour={GREY} />}
              </>
            )}
            {/* Letters */}
            {letters.on && look === 'open' && (
              <text x={cell.x - letterRoom + 1} y={cell.y - (mini ? 1 : 3)} fontSize={size} fontWeight={letters.bold ? 700 : 400} fill="#18181b">
                {letter(i, letters)}
              </text>
            )}
            {letters.on && look === 'framed' && (
              <g>
                <rect x={cell.x + (mini ? 2 : 8)} y={cell.y + (mini ? 2 : 6)} width={mini ? 6 : 14} height={mini ? 6 : 14} rx={mini ? 1 : 3} fill="#27272a" />
                <text x={cell.x + (mini ? 5 : 15)} y={cell.y + (mini ? 7 : 17)} fontSize={mini ? 5 : 9.5} fontWeight={letters.bold ? 700 : 500} fill="#ffffff" textAnchor="middle">
                  {letter(i, letters)}
                </text>
              </g>
            )}
            {letters.on && look === 'badges' && (
              <g>
                <circle cx={space.x} cy={space.y} r={mini ? 4.5 : 9} fill="#ffffff" stroke="#18181b" strokeWidth={mini ? 0.8 : 1.2} />
                <text x={space.x} y={space.y + (mini ? 2 : 3.5)} fontSize={mini ? 5.5 : 10} fontWeight={letters.bold ? 700 : 400} textAnchor="middle" fill="#18181b">
                  {letter(i, letters)}
                </text>
              </g>
            )}
            {/* C: the selected space offers the three chart pictures inside itself. */}
            {look === 'badges' && selected === i && !mini && <InSpaceChoices box={space} />}
          </g>
        )
      })}
      {legend && <Legend look={look} area={{ x: inner.x, y: inner.y + inner.h + (mini ? 3 : 8), w: inner.w, h: mini ? 5 : LEGEND_H }} mini={mini} />}
    </g>
  )
}

function Legend({ look, area, mini }: { look: Look; area: Box; mini?: boolean }) {
  if (mini) {
    return (
      <g>
        {SERIES.map((s, i) => (
          <rect key={s.name} x={area.x + area.w / 2 - 22 + i * 16} y={area.y} width={10} height={area.h} rx={1} fill={s.colour} fillOpacity={0.8} />
        ))}
      </g>
    )
  }
  const itemW = 62
  const start = area.x + area.w / 2 - (itemW * SERIES.length) / 2
  return (
    <g>
      {look === 'framed' && <rect x={area.x} y={area.y - 2} width={area.w} height={area.h + 4} rx={6} fill="#ffffff" stroke="#d4d4d8" />}
      {look === 'badges' && <line x1={area.x} x2={area.x + area.w} y1={area.y - 3} y2={area.y - 3} stroke="#e4e4e7" />}
      {SERIES.map((s, i) => (
        <g key={s.name}>
          {look === 'badges' ? (
            <circle cx={start + i * itemW + 5} cy={area.y + area.h / 2} r={4} fill={s.colour} />
          ) : (
            <rect x={start + i * itemW} y={area.y + area.h / 2 - 4} width={10} height={8} rx={look === 'framed' ? 2 : 0} fill={s.colour} />
          )}
          <text x={start + i * itemW + 14} y={area.y + area.h / 2 + 3.5} fontSize={9} fill="#27272a">
            {s.name}
          </text>
        </g>
      ))}
    </g>
  )
}

/** Version C: the selected empty space shows three chart pictures in itself, plus a More dot. */
function InSpaceChoices({ box }: { box: Box }) {
  const kinds: ChartKind[] = ['bar', 'line', 'scatter']
  const tile = Math.min(44, (box.w - 40) / 4)
  const total = tile * 4 + 8 * 3
  const x0 = box.x + box.w / 2 - total / 2
  const y = box.y + box.h / 2 - tile / 2
  return (
    <g>
      <rect x={box.x + 1} y={box.y + 1} width={box.w - 2} height={box.h - 2} rx={6} fill="#ffffff" fillOpacity={0.85} />
      {kinds.map((kind, i) => (
        <g key={kind}>
          <rect x={x0 + i * (tile + 8)} y={y} width={tile} height={tile} rx={6} fill="#ffffff" stroke={i === 0 ? SELECTION : '#d4d4d8'} strokeWidth={i === 0 ? 1.5 : 1} />
          <foreignObject x={x0 + i * (tile + 8) + 6} y={y + 6} width={tile - 12} height={tile - 12}>
            <div style={{ width: '100%', height: '100%', color: '#3f3f46' }}>
              <GraphTypePicture kind={kind} className="size-full" />
            </div>
          </foreignObject>
        </g>
      ))}
      <rect x={x0 + 3 * (tile + 8)} y={y} width={tile} height={tile} rx={6} fill="#ffffff" stroke="#d4d4d8" />
      {[0, 1, 2].map((d) => (
        <circle key={d} cx={x0 + 3 * (tile + 8) + tile / 2 - 6 + d * 6} cy={y + tile / 2} r={1.6} fill="#52525b" />
      ))}
    </g>
  )
}

/* ---------- The editor around it ---------- */

function Panel({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section aria-label={title} className="flex w-[280px] shrink-0 flex-col overflow-y-auto border-r border-border bg-panel">
      {children}
    </section>
  )
}

function SectionHead({ children }: { children: ReactNode }) {
  return <h3 className="px-3 pt-3 pb-1.5 text-xs font-medium text-muted-foreground">{children}</h3>
}

function BlocksTool({ look }: { look: Look }) {
  const letters = { on: true, bold: true, upper: true }
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
      <SectionHead>Layouts</SectionHead>
      <div className="grid grid-cols-2 gap-2 px-3 pb-3">
        {LAYOUTS.map((layout) => (
          <button key={layout.id} type="button" className="flex flex-col gap-1.5 rounded-md border border-border-strong bg-panel p-1.5 text-left text-muted-foreground hover:bg-muted hover:text-foreground">
            <span className="flex aspect-[3/2] w-full items-center justify-center rounded-sm bg-white p-2">
              <svg viewBox="0 0 120 80" className="size-full">
                <GridDrawing look={look} layout={layout} area={{ x: 4, y: 4, w: 112, h: 72 }} gap={4} letters={letters} legend={false} mini />
              </svg>
            </span>
            <span className="text-xs leading-tight">{layout.name}</span>
          </button>
        ))}
      </div>
    </Panel>
  )
}

const ON_OFF = [
  { value: 'shown', label: 'Shown', icon: Eye },
  { value: 'hidden', label: 'Hidden', icon: EyeOff },
] as const

function Row({ label, children, off }: { label: string; children: ReactNode; off?: boolean }) {
  return (
    <div className={`flex min-h-10 items-center gap-2 px-3 ${off ? 'opacity-50' : ''}`}>
      <span className="w-16 shrink-0 text-xs text-muted-foreground">{label}</span>
      <div className="flex min-w-0 flex-1 items-center">{children}</div>
    </div>
  )
}

function LayoutPicture({ layout, look, on }: { layout: Layout; look: Look; on: boolean }) {
  return (
    <span
      title={layout.name}
      className={`flex aspect-[3/2] items-center justify-center rounded-md border bg-white p-1 ${on ? 'border-primary ring-1 ring-primary' : 'border-border-strong'}`}
    >
      <svg viewBox="0 0 60 40" className="size-full">
        <GridDrawing look={look} layout={layout} area={{ x: 2, y: 2, w: 56, h: 36 }} gap={3} letters={{ on: false, bold: true, upper: true }} legend={false} mini />
      </svg>
    </span>
  )
}

function GridProperties({ look, letters, setLetters, legend, setLegend, gap, setGap }: {
  look: Look
  letters: LetterStyle
  setLetters: (l: LetterStyle) => void
  legend: boolean
  setLegend: (on: boolean) => void
  gap: number
  setGap: (g: number) => void
}) {
  return (
    <Panel title="Grid properties">
      <div className="flex h-12 items-center gap-2 border-b border-border px-2">
        <button type="button" aria-label="Back to blocks" className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted">
          <ArrowLeft className="size-4" />
        </button>
        <LayoutGrid className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">Figure grid</span>
      </div>
      <div className="flex flex-col py-1">
        <Row label="Layout">
          <div className="grid w-full grid-cols-5 gap-1">
            {LAYOUTS.map((layout) => (
              <LayoutPicture key={layout.id} layout={layout} look={look} on={layout.id === 'grid'} />
            ))}
          </div>
        </Row>
        <Row label="Letters">
          <Toggle label="Panel letters" hideLabel checked={letters.on} onCheckedChange={(on) => setLetters({ ...letters, on })} />
        </Row>
        <Row label="Weight" off={!letters.on}>
          <SegmentedToggle
            label="Letter weight"
            showLabels
            className="h-8 flex-1"
            value={letters.bold ? 'bold' : 'plain'}
            onValueChange={(v) => setLetters({ ...letters, bold: v === 'bold' })}
            options={[
              { value: 'bold', label: 'Bold', picture: <span className="text-sm font-bold">A</span> },
              { value: 'plain', label: 'Plain', picture: <span className="text-sm">A</span> },
            ]}
          />
        </Row>
        <Row label="Case" off={!letters.on}>
          <SegmentedToggle
            label="Letter case"
            showLabels
            className="h-8 flex-1"
            value={letters.upper ? 'upper' : 'lower'}
            onValueChange={(v) => setLetters({ ...letters, upper: v === 'upper' })}
            options={[
              { value: 'upper', label: 'A B C', picture: <span className="text-xs font-semibold">Aa</span> },
              { value: 'lower', label: 'a b c', picture: <span className="text-xs font-semibold">aa</span> },
            ]}
          />
        </Row>
        <Row label="Legend">
          <SegmentedToggle label="Shared legend" options={ON_OFF} showLabels className="h-8 flex-1" value={legend ? 'shown' : 'hidden'} onValueChange={(v) => setLegend(v === 'shown')} />
        </Row>
        <Row label="Gap">
          <Slider label="Gap" hideLabel min={4} max={40} value={gap} unit="px" onValueChange={setGap} className="min-w-0 flex-1" />
        </Row>
      </div>
      <div className="mt-auto border-t border-border p-3">
        <Button variant="secondary" size="sm" className="w-full gap-1.5">
          <Ungroup aria-hidden="true" />
          Detach grid
        </Button>
      </div>
    </Panel>
  )
}

/** A: the left panel while an empty chart space waits for a chart, like a selected icon space. */
function ChartChoicePanel() {
  const kinds: { kind: ChartKind; name: string }[] = [
    { kind: 'bar', name: 'Bar' },
    { kind: 'line', name: 'Line' },
    { kind: 'scatter', name: 'Scatter' },
  ]
  return (
    <Panel title="Graph">
      <div className="m-3 flex items-center justify-between rounded-md bg-primary-subtle px-2.5 py-2 text-xs text-primary-subtle-foreground">
        <span>Pick a chart for space C</span>
        <button type="button" className="font-medium underline-offset-2 hover:underline">
          Cancel
        </button>
      </div>
      <SectionHead>Chart</SectionHead>
      <div className="grid grid-cols-4 gap-1.5 px-3">
        {kinds.map(({ kind, name }, i) => (
          <span key={kind} className={`flex flex-col items-center gap-1 rounded-md border p-1.5 text-xs ${i === 0 ? 'border-primary bg-primary-subtle text-foreground' : 'border-border-strong text-muted-foreground'}`}>
            <GraphTypePicture kind={kind} className="size-9" />
            {name}
          </span>
        ))}
        <span className="flex flex-col items-center gap-1 rounded-md border border-border-strong p-1.5 text-xs text-muted-foreground">
          <MoreHorizontal className="size-9 p-2" />
          More
        </span>
      </div>
    </Panel>
  )
}

/** B: a bar floating above the selected space with the chart types. */
function FloatingChoices({ left, top }: { left: number; top: number }) {
  const kinds: ChartKind[] = ['bar', 'line', 'scatter']
  return (
    <div style={{ left, top }} className="absolute flex items-center gap-0.5 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg">
      {kinds.map((kind, i) => (
        <span key={kind} title={kind} className={`flex size-8 items-center justify-center rounded-md ${i === 0 ? 'bg-primary-subtle' : 'hover:bg-muted'}`}>
          <GraphTypePicture kind={kind} className="size-6" />
        </span>
      ))}
      <span className="mx-0.5 h-5 w-px bg-border" />
      <span className="flex size-8 items-center justify-center rounded-md text-muted-foreground">
        <MoreHorizontal className="size-4" />
      </span>
    </div>
  )
}

/* ---------- One version: the whole screen ---------- */

const PAGE = { w: 600, h: 470 }
const GRID_AREA = { x: 40, y: 40, w: 520, h: 380 }
/** The page is shown at 140%, as when zoomed in on it. */
const ZOOM = 1.4

function Version({ look, title, note }: { look: Look; title: string; note: string }) {
  const [letters, setLetters] = useState<LetterStyle>({ on: true, bold: true, upper: true })
  const [legend, setLegend] = useState(true)
  const [gap, setGap] = useState(16)
  const [showChoice, setShowChoice] = useState(look === 'open')
  const layout = LAYOUTS[1]
  // Where space C (bottom-left) is, for the floating bar in B.
  const letterRoom = look === 'open' && letters.on ? 14 : 0
  const inner = { x: GRID_AREA.x + letterRoom, y: GRID_AREA.y + letterRoom, w: GRID_AREA.w - letterRoom, h: GRID_AREA.h - letterRoom - (legend ? LEGEND_H + 8 : 0) }
  const c = cellBoxes(layout, inner, gap + letterRoom)[2]
  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <div className="flex items-center gap-3 border-b border-border px-4 py-2">
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-xs text-muted-foreground">{note}</span>
        {look === 'open' && (
          <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={showChoice} onChange={(e) => setShowChoice(e.target.checked)} />
            Left panel while space C is selected
          </label>
        )}
      </div>
      <div className="flex min-h-0 flex-1">
        {look === 'open' && showChoice ? <ChartChoicePanel /> : <BlocksTool look={look} />}
        <div className="relative flex min-w-0 flex-1 items-center justify-center overflow-auto bg-canvas p-8">
          <div className="relative shadow-md" style={{ width: PAGE.w * ZOOM, height: PAGE.h * ZOOM }}>
            <svg viewBox={`0 0 ${PAGE.w} ${PAGE.h}`} width={PAGE.w * ZOOM} height={PAGE.h * ZOOM} className="block bg-white">
              <GridDrawing look={look} layout={layout} area={GRID_AREA} gap={gap} fills={['bar', 'line', undefined, undefined]} selected={2} letters={letters} legend={legend} />
            </svg>
            {look === 'framed' && <FloatingChoices left={(c.x + c.w / 2) * ZOOM - 70} top={c.y * ZOOM - 46} />}
          </div>
        </div>
        <GridProperties look={look} letters={letters} setLetters={setLetters} legend={legend} setLegend={setLegend} gap={gap} setGap={setGap} />
      </div>
    </div>
  )
}

export const A_OpenGrid: Story = {
  name: 'A · Open grid',
  render: () => <Version look="open" title="A · Open grid" note="No frames, journal-style letters outside the corner, chart types in the left panel" />,
}

export const B_FramedCells: Story = {
  name: 'B · Framed cells',
  render: () => <Version look="framed" title="B · Framed cells" note="A card per cell, letter in a dark square, chart types in a bar above the space" />,
}

export const C_CornerBadges: Story = {
  name: 'C · Corner badges',
  render: () => <Version look="badges" title="C · Corner badges" note="No frames, round letter badges on the corner, chart pictures inside the selected space" />,
}

/** All five layouts in each look, bigger, to compare them side by side. */
export const AllLayouts: Story = {
  name: 'All layouts, each look',
  render: () => (
    <div className="flex flex-col gap-6 bg-canvas p-6">
      {(['open', 'framed', 'badges'] as const).map((look) => (
        <div key={look} className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-foreground">{look === 'open' ? 'A · Open grid' : look === 'framed' ? 'B · Framed cells' : 'C · Corner badges'}</span>
          <div className="flex flex-wrap gap-4">
            {LAYOUTS.map((layout) => (
              <div key={layout.id} className="flex flex-col gap-1">
                <svg viewBox="0 0 300 210" width={300} height={210} className="bg-white shadow-sm">
                  <GridDrawing look={look} layout={layout} area={{ x: 16, y: 14, w: 268, h: 184 }} gap={10} letters={{ on: true, bold: true, upper: true }} legend={false} />
                </svg>
                <span className="text-xs text-muted-foreground">{layout.name}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  ),
}
