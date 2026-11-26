/*
 * BIO-86 design drafts, round 2: the pictures on the Blocks tool's "Graph
 * layouts" cards. The owner found the first pictures (real mini charts)
 * unclear. Visual drafts only: no tests, no accessibility pass, nothing wired
 * up. Each version shows the whole Blocks panel (Panels cards above, as they
 * are), so the layouts can be judged next to them.
 *
 *   A  Mini charts     What the app has now: small real graphs with letters
 *   B  Big icons       One large blue chart icon per cell on a soft tile
 *   C  Colour tiles    Each cell a pastel tile in a different chart colour, a white chart icon on it
 *   D  Placeholders    Dashed blue boxes with a plus: what you get when you place it
 *   E  Panel letters   A big letter per cell, a small chart under it: says "multi-panel figure"
 *   F  Bold bars       Thick rounded bars filling each cell, one accent colour, no axes
 */
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactNode } from 'react'

const meta = {
  title: 'Drafts/BIO-86 Layout cards',
  parameters: { controls: { disable: true }, layout: 'fullscreen' },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

/* ---------- Layouts ---------- */

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
const VIEW = { w: 120, h: 80 }

function boxes(layout: Layout, area: Box, gap: number): Box[] {
  const cw = (area.w - gap * (layout.cols - 1)) / layout.cols
  const ch = (area.h - gap * (layout.rows - 1)) / layout.rows
  return layout.cells.map((c) => ({
    x: area.x + c.col * (cw + gap),
    y: area.y + c.row * (ch + gap),
    w: cw * (c.cols ?? 1) + gap * ((c.cols ?? 1) - 1),
    h: ch * (c.rows ?? 1) + gap * ((c.rows ?? 1) - 1),
  }))
}

const PALETTE = ['#0072b2', '#e69f00', '#009e73', '#cc79a7', '#56b4e9', '#d55e00']
const wash = (hex: string, share: number) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  return `rgb(${c.map((v) => Math.round(255 - (255 - v) * share)).join(',')})`
}
const KINDS = ['bar', 'line', 'scatter'] as const
type Kind = (typeof KINDS)[number]
const kindOf = (i: number): Kind => KINDS[i % 3] ?? 'bar'

/* ---------- Chart pictures, centred in a box ---------- */

/** A chart icon drawn in lines, Lucide-style, `s` big, centred at (cx, cy). */
function ChartIcon({ kind, cx, cy, s, colour, width = 1.6 }: { kind: Kind; cx: number; cy: number; s: number; colour: string; width?: number }) {
  const x = cx - s / 2
  const y = cy - s / 2
  const line = { stroke: colour, strokeWidth: width, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  return (
    <g>
      <path d={`M ${x} ${y} V ${y + s} H ${x + s}`} {...line} />
      {kind === 'bar' && [0.5, 0.85, 0.65].map((v, i) => <rect key={i} x={x + s * (0.18 + i * 0.27)} y={y + s * (1 - v)} width={s * 0.16} height={s * v - width} rx={s * 0.03} fill={colour} />)}
      {kind === 'line' && <polyline points={[0.25, 0.55, 0.45, 0.8, 0.9].map((v, i) => `${x + s * (0.14 + i * 0.2)},${y + s * (1 - v)}`).join(' ')} {...line} />}
      {kind === 'scatter' &&
        [
          [0.25, 0.3],
          [0.4, 0.55],
          [0.55, 0.45],
          [0.68, 0.75],
          [0.85, 0.82],
        ].map(([a, b], i) => <circle key={i} cx={x + s * a} cy={y + s * (1 - b)} r={s * 0.07} fill={colour} />)}
    </g>
  )
}

/** A small real-looking chart filling a box: axes and data in the chart colours (version A). */
function MiniChart({ kind, b }: { kind: Kind; b: Box }) {
  const p = { x: b.x + b.w * 0.12, y: b.y + b.h * 0.12, w: b.w * 0.8, h: b.h * 0.72 }
  return (
    <g>
      {kind === 'bar' &&
        [0.45, 0.85, 0.65].map((v, i) => (
          <g key={i}>
            <rect x={p.x + p.w * (0.1 + i * 0.3)} y={p.y + p.h * (1 - v)} width={p.w * 0.2} height={p.h * v} fill={PALETTE[i]} />
            <path d={`M ${p.x + p.w * (0.2 + i * 0.3)} ${p.y + p.h * (1 - v)} v ${-p.h * 0.1}`} stroke="#27272a" strokeWidth={0.4} />
          </g>
        ))}
      {kind === 'line' && <polyline points={[0.2, 0.75, 0.45].map((v, i) => `${p.x + p.w * (0.15 + i * 0.35)},${p.y + p.h * (1 - v)}`).join(' ')} fill="none" stroke={PALETTE[0]} strokeWidth={0.8} />}
      {kind === 'line' && [0.2, 0.75, 0.45].map((v, i) => <circle key={i} cx={p.x + p.w * (0.15 + i * 0.35)} cy={p.y + p.h * (1 - v)} r={1} fill={PALETTE[0]} />)}
      {kind === 'scatter' &&
        [0, 1, 2].flatMap((g) => [0.2, 0.5, 0.35].map((v, i) => <circle key={`${g}${i}`} cx={p.x + p.w * (0.2 + g * 0.3) + (i - 1) * 1.6} cy={p.y + p.h * (1 - v - g * 0.15)} r={0.9} fill={PALETTE[g]} />))}
      <path d={`M ${p.x} ${p.y} V ${p.y + p.h} H ${p.x + p.w}`} stroke="#27272a" strokeWidth={0.5} fill="none" />
    </g>
  )
}

/* ---------- The six versions ---------- */

type Version = { id: string; title: string; note: string; picture: (layout: Layout) => ReactNode }

const VERSIONS: Version[] = [
  {
    id: 'A',
    title: 'A · Mini charts',
    note: 'What the app has now: small real graphs with letters',
    picture: (layout) =>
      boxes(layout, { x: 4, y: 7, w: 112, h: 69 }, 6).map((b, i) => (
        <g key={i}>
          <text x={b.x} y={b.y - 1} fontSize={5} fontWeight={700} fill="#18181b">
            {String.fromCharCode(65 + i)}
          </text>
          <MiniChart kind={kindOf(i)} b={b} />
        </g>
      )),
  },
  {
    id: 'B',
    title: 'B · Big icons',
    note: 'One large blue chart icon per cell on a soft tile',
    picture: (layout) =>
      boxes(layout, { x: 4, y: 4, w: 112, h: 72 }, 5).map((b, i) => (
        <g key={i}>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={4} fill="#eef4fa" />
          <ChartIcon kind={kindOf(i)} cx={b.x + b.w / 2} cy={b.y + b.h / 2} s={Math.min(b.w, b.h) * 0.5} colour="#0072b2" />
        </g>
      )),
  },
  {
    id: 'C',
    title: 'C · Colour tiles',
    note: 'Each cell a pastel tile in its own chart colour, a white chart icon on it',
    picture: (layout) =>
      boxes(layout, { x: 4, y: 4, w: 112, h: 72 }, 5).map((b, i) => {
        const colour = PALETTE[i % PALETTE.length] ?? '#0072b2'
        return (
          <g key={i}>
            <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={5} fill={wash(colour, 0.75)} />
            <ChartIcon kind={kindOf(i)} cx={b.x + b.w / 2} cy={b.y + b.h / 2} s={Math.min(b.w, b.h) * 0.45} colour="#ffffff" width={1.8} />
          </g>
        )
      }),
  },
  {
    id: 'D',
    title: 'D · Placeholders',
    note: 'Dashed blue boxes, each with a chart and a plus: what you get when you place it',
    picture: (layout) =>
      boxes(layout, { x: 4, y: 4, w: 112, h: 72 }, 5).map((b, i) => {
        const s = Math.min(b.w, b.h) * 0.38
        const cx = b.x + b.w / 2
        const cy = b.y + b.h / 2
        return (
          <g key={i}>
            <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={4} fill="#f0f6fc" stroke="#0072b2" strokeWidth={0.9} strokeDasharray="2.5 2" />
            <ChartIcon kind="bar" cx={cx} cy={cy} s={s} colour="#7fb3d8" />
            <circle cx={cx + s / 2 + 1} cy={cy + s / 2 - 1} r={s * 0.22} fill="#0072b2" stroke="#f0f6fc" strokeWidth={1} />
            <path d={`M ${cx + s / 2 + 1 - s * 0.11} ${cy + s / 2 - 1} h ${s * 0.22} M ${cx + s / 2 + 1} ${cy + s / 2 - 1 - s * 0.11} v ${s * 0.22}`} stroke="#fff" strokeWidth={0.8} strokeLinecap="round" />
          </g>
        )
      }),
  },
  {
    id: 'E',
    title: 'E · Panel letters',
    note: 'A big letter per cell with a small chart under it: says "multi-panel figure"',
    picture: (layout) =>
      boxes(layout, { x: 4, y: 4, w: 112, h: 72 }, 5).map((b, i) => {
        const s = Math.min(b.w, b.h)
        return (
          <g key={i}>
            <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={4} fill="#f4f4f5" />
            <text x={b.x + b.w / 2} y={b.y + b.h / 2 - s * 0.02} fontSize={s * 0.34} fontWeight={700} textAnchor="middle" fill="#27272a">
              {String.fromCharCode(65 + i)}
            </text>
            <ChartIcon kind={kindOf(i)} cx={b.x + b.w / 2} cy={b.y + b.h / 2 + s * 0.22} s={s * 0.24} colour="#0072b2" width={1.1} />
          </g>
        )
      }),
  },
  {
    id: 'F',
    title: 'F · Bold bars',
    note: 'Thick rounded bars filling each cell in one accent colour, no axes or text',
    picture: (layout) =>
      boxes(layout, { x: 4, y: 4, w: 112, h: 72 }, 6).map((b, i) => {
        const heights = [
          [0.45, 0.8, 0.6],
          [0.7, 0.4, 0.9],
          [0.55, 0.9, 0.35],
        ][i % 3] ?? [0.5, 0.8, 0.6]
        const bw = b.w / 5
        return (
          <g key={i}>
            <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={4} fill="#f4f4f5" />
            {heights.map((v, j) => (
              <rect key={j} x={b.x + bw * (0.7 + j * 1.3)} y={b.y + b.h * (0.9 - 0.75 * v)} width={bw} height={b.h * 0.75 * v} rx={Math.min(2, bw / 3)} fill="#0072b2" fillOpacity={0.45 + j * 0.25} />
            ))}
          </g>
        )
      }),
  },
]

/* ---------- The Blocks panel around them ---------- */

function Card({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-border-strong bg-panel p-1.5 text-muted-foreground">
      <span className="flex aspect-[3/2] w-full items-center justify-center overflow-hidden rounded-sm bg-white p-1.5">{children}</span>
      <span className="text-xs leading-tight">{name}</span>
    </div>
  )
}

/** The two Panels cards as they are in the app, for comparison. */
function PanelPicture({ icons }: { icons: boolean }) {
  return (
    <svg viewBox="0 0 120 80" className="size-full">
      <rect x={8} y={8} width={104} height={64} rx={6} fill="#0072b2" fillOpacity={0.08} stroke="#0072b2" strokeWidth={1.2} />
      <path d="M 8 22 V 14 a 6 6 0 0 1 6 -6 H 106 a 6 6 0 0 1 6 6 V 22 Z" fill="#0072b2" />
      <text x={14} y={18.5} fontSize={7} fontWeight={600} fill="#fff">
        Panel
      </text>
      {icons && [0, 1, 2].map((i) => <rect key={i} x={20 + i * 30} y={32} width={22} height={22} rx={4} fill="#0072b2" fillOpacity={0.05} stroke="#0072b2" strokeOpacity={0.4} strokeDasharray="2 2" />)}
    </svg>
  )
}

function BlocksPanel({ version }: { version: Version }) {
  return (
    <div className="flex w-[280px] shrink-0 flex-col gap-2">
      <div>
        <div className="text-sm font-semibold text-foreground">{version.title}</div>
        <div className="text-xs text-muted-foreground">{version.note}</div>
      </div>
      <section aria-label={version.title} className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-panel p-3">
        <h3 className="col-span-2 text-xs font-medium text-muted-foreground">Panels</h3>
        <Card name="Panel">
          <PanelPicture icons={false} />
        </Card>
        <Card name="Panel with 3 icons">
          <PanelPicture icons />
        </Card>
        <h3 className="col-span-2 pt-1 text-xs font-medium text-muted-foreground">Graph layouts</h3>
        {LAYOUTS.map((layout) => (
          <Card key={layout.id} name={layout.name}>
            <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} className="size-full" fontFamily="Inter Variable, Inter, sans-serif">
              {version.picture(layout)}
            </svg>
          </Card>
        ))}
      </section>
    </div>
  )
}

export const AllVersions: Story = {
  name: 'All versions side by side',
  render: () => (
    <div className="flex flex-wrap gap-6 bg-background p-6">
      {VERSIONS.map((version) => (
        <BlocksPanel key={version.id} version={version} />
      ))}
    </div>
  ),
}

export const A: Story = { name: 'A · Mini charts', render: () => <div className="bg-background p-6"><BlocksPanel version={VERSIONS[0]} /></div> }
export const B: Story = { name: 'B · Big icons', render: () => <div className="bg-background p-6"><BlocksPanel version={VERSIONS[1]} /></div> }
export const C: Story = { name: 'C · Colour tiles', render: () => <div className="bg-background p-6"><BlocksPanel version={VERSIONS[2]} /></div> }
export const D: Story = { name: 'D · Placeholders', render: () => <div className="bg-background p-6"><BlocksPanel version={VERSIONS[3]} /></div> }
export const E: Story = { name: 'E · Panel letters', render: () => <div className="bg-background p-6"><BlocksPanel version={VERSIONS[4]} /></div> }
export const F: Story = { name: 'F · Bold bars', render: () => <div className="bg-background p-6"><BlocksPanel version={VERSIONS[5]} /></div> }
