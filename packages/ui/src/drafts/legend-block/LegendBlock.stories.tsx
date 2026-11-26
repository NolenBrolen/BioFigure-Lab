/*
 * BIO-106 design drafts: the Legend / key block. A set of rows, each an icon
 * or a colour square next to a label. Visual drafts only: no tests, no
 * accessibility pass, nothing wired up. The properties work, so rows can be
 * added, removed (with an Undo toast), renamed, recoloured, given another
 * icon, and the layout turned between down and across.
 *
 *   A  Plain key   No frame at all: marker, label, next row. What journals
 *                  print under a figure. Icons and squares the same width,
 *                  so the labels line up.
 *   B  Boxed key   A card with a "Key" header in the block colour, a thin
 *                  line between rows, icons on a pale round tile. Reads as
 *                  one piece on a busy poster or slide.
 *   C  Chips       Each row a rounded chip tinted in its own colour (icon
 *                  rows in the block colour), the marker at the chip's
 *                  start. Compact and modern; good across the top of a
 *                  figure.
 *
 * Every version shows its card in the Blocks tool, the block down and across
 * on the page, and the block selected. "Try it" has one shared properties
 * panel to play with each version.
 *
 * The pictures are real library icons, read from the repo's icons folder for
 * these drafts only (nothing from it is bundled into packages/ui).
 */
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ArrowLeft, ListOrdered, Minus, Plus, Square, Ungroup } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import bCellSvg from '../../../../../icons/cells/b-cell-simple-flat.svg?raw'
import dendriticSvg from '../../../../../icons/cells/dendritic-cell-simple-flat.svg?raw'
import macrophageSvg from '../../../../../icons/cells/macrophage-simple-flat.svg?raw'
import neutrophilSvg from '../../../../../icons/cells/neutrophil-simple-flat.svg?raw'
import nkSvg from '../../../../../icons/cells/nk-cell-simple-flat.svg?raw'
import tCellSvg from '../../../../../icons/cells/t-cell-simple-flat.svg?raw'
import { Button } from '../../components/button/Button'
import { ColourMenu } from '../../components/colour-input/ColourInput'
import { Popover } from '../../components/popover/Popover'
import { SegmentedToggle } from '../../components/segmented-toggle/SegmentedToggle'
import { ToastProvider, ToastViewport, useToast } from '../../components/toast/Toast'
import { cn } from '../../lib/cn'

const meta = {
  title: 'Drafts/BIO-106 Legend',
  parameters: { controls: { disable: true }, layout: 'fullscreen' },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const BLUE = '#0072b2' // the panels' blue
const SELECT = '#2563eb' // selection blue
const INK = '#27272a'
const MUTED = '#71717a'
const FONT = 'Inter, system-ui, sans-serif'

const dataUrl = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
const ICONS = [
  { id: 't', name: 'T cell', href: dataUrl(tCellSvg) },
  { id: 'b', name: 'B cell', href: dataUrl(bCellSvg) },
  { id: 'mac', name: 'Macrophage', href: dataUrl(macrophageSvg) },
  { id: 'neu', name: 'Neutrophil', href: dataUrl(neutrophilSvg) },
  { id: 'nk', name: 'NK cell', href: dataUrl(nkSvg) },
  { id: 'dc', name: 'Dendritic cell', href: dataUrl(dendriticSvg) },
]
const iconHref = (id: string) => ICONS.find((i) => i.id === id)?.href ?? ''

type Entry = { id: string; label: string } & ({ kind: 'icon'; icon: string } | { kind: 'swatch'; colour: string })
type Layout = 'down' | 'across'
type Look = 'plain' | 'boxed' | 'chips'

/** What the page shows: four cell types and two treatments. */
const PAGE: Entry[] = [
  { id: '1', kind: 'icon', icon: 't', label: 'T cell' },
  { id: '2', kind: 'icon', icon: 'b', label: 'B cell' },
  { id: '3', kind: 'icon', icon: 'mac', label: 'Macrophage' },
  { id: '4', kind: 'swatch', colour: '#a1a1aa', label: 'Untreated' },
  { id: '5', kind: 'swatch', colour: '#d55e00', label: 'LPS 100 ng/ml' },
]
/** What clicking the card places: two icons and a colour, ready to be renamed. */
const START: Entry[] = [
  { id: 'a', kind: 'icon', icon: 't', label: 'Cell type 1' },
  { id: 'b', kind: 'icon', icon: 'b', label: 'Cell type 2' },
  { id: 'c', kind: 'swatch', colour: BLUE, label: 'Condition' },
]
/** Colours new colour rows take, in turn (Okabe-Ito). */
const NEXT_COLOURS = ['#e69f00', '#009e73', '#cc79a7', '#56b4e9', '#d55e00', '#f0e442']

function tint(hex: string, white = 0.82) {
  const n = parseInt(hex.slice(1), 16)
  const mix = (v: number) => Math.round(v + (255 - v) * white)
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => mix(v).toString(16).padStart(2, '0')).join('')}`
}

/** A rough width for 12 px Inter, good enough for drafts. */
const textW = (s: string, px = 12) => s.length * px * 0.56

/* ---------- The three looks ---------- */

type Drawn = { w: number; h: number; body: ReactNode; rows: { x: number; y: number; w: number; h: number }[] }

function Marker({ e, x, y, size, square = 14, round = false }: { e: Entry; x: number; y: number; size: number; square?: number; round?: boolean }) {
  if (e.kind === 'icon') return <image href={iconHref(e.icon)} x={x} y={y} width={size} height={size} />
  const s = square
  return <rect x={x + (size - s) / 2} y={y + (size - s) / 2} width={s} height={s} rx={round ? s / 2 : 2.5} fill={e.colour} stroke="rgb(0 0 0 / 0.15)" strokeWidth={0.75} />
}

function drawPlain(entries: Entry[], layout: Layout): Drawn {
  const M = 22
  const rows: Drawn['rows'] = []
  const parts: ReactNode[] = []
  if (layout === 'down') {
    const step = 28
    entries.forEach((e, i) => {
      const y = i * step
      parts.push(
        <g key={e.id}>
          <Marker e={e} x={0} y={y} size={M} />
          <text x={M + 8} y={y + M / 2 + 4} fontSize={12} fill={INK}>
            {e.label}
          </text>
        </g>,
      )
      rows.push({ x: 0, y, w: M + 8 + textW(e.label), h: M })
    })
    const w = Math.max(...rows.map((r) => r.w))
    return { w, h: entries.length * step - (step - M), body: parts, rows }
  }
  let x = 0
  entries.forEach((e) => {
    const w = M + 6 + textW(e.label)
    parts.push(
      <g key={e.id}>
        <Marker e={e} x={x} y={0} size={M} />
        <text x={x + M + 6} y={M / 2 + 4} fontSize={12} fill={INK}>
          {e.label}
        </text>
      </g>,
    )
    rows.push({ x, y: 0, w, h: M })
    x += w + 18
  })
  return { w: x - 18, h: M, body: parts, rows }
}

function drawBoxed(entries: Entry[], layout: Layout, colour: string): Drawn {
  const HEAD = 22
  const tile = 30
  const rows: Drawn['rows'] = []
  const parts: ReactNode[] = []
  const pale = tint(colour, 0.88)
  const tileFor = (e: Entry, x: number, y: number) =>
    e.kind === 'icon' ? (
      <g>
        <circle cx={x + tile / 2} cy={y + tile / 2} r={tile / 2} fill={pale} />
        <Marker e={e} x={x + 4} y={y + 4} size={tile - 8} />
      </g>
    ) : (
      <Marker e={e} x={x} y={y} size={tile} square={16} />
    )
  let w: number
  let h: number
  if (layout === 'down') {
    const step = 40
    const inner = Math.max(...entries.map((e) => tile + 10 + textW(e.label)))
    w = Math.max(inner + 24, 110)
    h = HEAD + 6 + entries.length * step
    entries.forEach((e, i) => {
      const y = HEAD + 6 + i * step + (step - tile) / 2
      if (i > 0) parts.push(<line key={`l${e.id}`} x1={12} x2={w - 12} y1={HEAD + 6 + i * step} y2={HEAD + 6 + i * step} stroke="#e4e4e7" />)
      parts.push(
        <g key={e.id}>
          {tileFor(e, 12, y)}
          <text x={12 + tile + 10} y={y + tile / 2 + 4} fontSize={12} fill={INK}>
            {e.label}
          </text>
        </g>,
      )
      rows.push({ x: 8, y: y - 4, w: w - 16, h: tile + 8 })
    })
  } else {
    const colW = entries.map((e) => Math.max(tile, textW(e.label, 11)) + 20)
    w = colW.reduce((a, b) => a + b, 0) + 8
    h = HEAD + 70
    let x = 4
    entries.forEach((e, i) => {
      const cw = colW[i] ?? 60
      if (i > 0) parts.push(<line key={`l${e.id}`} x1={x} x2={x} y1={HEAD + 12} y2={h - 10} stroke="#e4e4e7" />)
      parts.push(
        <g key={e.id}>
          {tileFor(e, x + (cw - tile) / 2, HEAD + 10)}
          <text x={x + cw / 2} y={HEAD + 10 + tile + 18} fontSize={11} fill={INK} textAnchor="middle">
            {e.label}
          </text>
        </g>,
      )
      rows.push({ x, y: HEAD + 6, w: cw, h: h - HEAD - 10 })
      x += cw
    })
  }
  return {
    w,
    h,
    rows,
    body: (
      <g>
        <rect x={0.75} y={0.75} width={w - 1.5} height={h - 1.5} rx={6} fill="white" stroke={colour} strokeWidth={1.5} />
        <path d={`M0.75 ${HEAD} V6.75 a6 6 0 0 1 6 -6 H${w - 6.75} a6 6 0 0 1 6 6 V${HEAD} Z`} fill={colour} />
        <text x={12} y={HEAD / 2 + 4} fontSize={10.5} fontWeight={700} letterSpacing={0.8} fill="white">
          KEY
        </text>
        {parts}
      </g>
    ),
  }
}

function drawChips(entries: Entry[], layout: Layout, colour: string): Drawn {
  const H = 28
  const M = 20
  const rows: Drawn['rows'] = []
  const parts: ReactNode[] = []
  const chip = (e: Entry, x: number, y: number) => {
    const w = 6 + M + 7 + textW(e.label) + 12
    const fill = e.kind === 'swatch' ? tint(e.colour, 0.8) : tint(colour, 0.85)
    parts.push(
      <g key={e.id}>
        <rect x={x} y={y} width={w} height={H} rx={H / 2} fill={fill} />
        {e.kind === 'icon' ? <Marker e={e} x={x + 6} y={y + (H - M) / 2} size={M} /> : <circle cx={x + 6 + M / 2} cy={y + H / 2} r={7} fill={e.colour} />}
        <text x={x + 6 + M + 7} y={y + H / 2 + 4} fontSize={12} fontWeight={500} fill={INK}>
          {e.label}
        </text>
      </g>,
    )
    rows.push({ x, y, w, h: H })
    return w
  }
  if (layout === 'down') {
    entries.forEach((e, i) => chip(e, 0, i * (H + 6)))
    return { w: Math.max(...rows.map((r) => r.w)), h: entries.length * (H + 6) - 6, body: parts, rows }
  }
  let x = 0
  entries.forEach((e) => {
    x += chip(e, x, 0) + 8
  })
  return { w: x - 8, h: H, body: parts, rows }
}

function draw(look: Look, entries: Entry[], layout: Layout, colour: string): Drawn {
  if (look === 'boxed') return drawBoxed(entries, layout, colour)
  if (look === 'chips') return drawChips(entries, layout, colour)
  return drawPlain(entries, layout)
}

/* ---------- On the page ---------- */

function RoundButton({ x, y, minus }: { x: number; y: number; minus?: boolean }) {
  return (
    <g>
      <circle cx={x} cy={y} r={9} fill="white" stroke={minus ? '#a1a1aa' : SELECT} strokeWidth={1.25} />
      <path d={minus ? `M${x - 4} ${y}H${x + 4}` : `M${x - 4} ${y}H${x + 4}M${x} ${y - 4}V${y + 4}`} stroke={minus ? MUTED : SELECT} strokeWidth={1.5} strokeLinecap="round" />
    </g>
  )
}

/** The legend on a piece of page, optionally selected with its handles and bar. */
function LegendOnPage({ look, entries, layout, colour = BLUE, selected = false, hoverRow, width, height }: { look: Look; entries: Entry[]; layout: Layout; colour?: string; selected?: boolean; hoverRow?: number; width?: number; height?: number }) {
  const d = draw(look, entries, layout, colour)
  const pad = selected ? 40 : 20
  const W = width ?? d.w + pad * 2 + (selected && layout === 'across' ? 30 : 0)
  const H = height ?? d.h + pad * 2 + (selected ? 26 : 0) + (selected && layout === 'down' ? 24 : 0)
  const ox = Math.round((W - d.w - (selected && layout === 'across' ? 30 : 0)) / 2)
  const oy = Math.round((H - d.h + (selected ? 26 : 0) - (selected && layout === 'down' ? 24 : 0)) / 2)
  const hover = hoverRow !== undefined ? d.rows[hoverRow] : undefined
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ fontFamily: FONT, display: 'block', maxWidth: '100%' }}>
      <rect width={W} height={H} fill="white" />
      <g transform={`translate(${ox} ${oy})`}>
        {d.body}
        {selected && (
          <g>
            <rect x={-5} y={-5} width={d.w + 10} height={d.h + 10} fill="none" stroke={SELECT} strokeWidth={1} />
            {[
              [-5, -5],
              [d.w + 5, -5],
              [-5, d.h + 5],
              [d.w + 5, d.h + 5],
            ].map(([x = 0, y = 0]) => (
              <rect key={`${x}-${y}`} x={x - 3.5} y={y - 3.5} width={7} height={7} fill="white" stroke={SELECT} />
            ))}
            {hover && (
              <g>
                <rect x={hover.x - 3} y={hover.y - 3} width={hover.w + 6} height={hover.h + 6} rx={4} fill="none" stroke={SELECT} strokeDasharray="3 2" strokeWidth={0.75} />
                <g transform={layout === 'down' ? `translate(${d.w + 22} ${hover.y + hover.h / 2})` : `translate(${hover.x + hover.w / 2} ${-22})`}>
                  <RoundButton x={0} y={0} minus />
                </g>
              </g>
            )}
            {layout === 'down' ? <RoundButton x={d.w / 2} y={d.h + 22} /> : <RoundButton x={d.w + 22} y={d.h / 2} />}
          </g>
        )}
      </g>
      {selected && <Bar x={W / 2} y={8} items={['Add row', layout === 'down' ? 'Across' : 'Down', 'Detach']} />}
    </svg>
  )
}

/** The small floating bar over a selected block. */
function Bar({ x, y, items }: { x: number; y: number; items: string[] }) {
  const widths = items.map((t) => textW(t, 11) + 18)
  const total = widths.reduce((a, b) => a + b, 0) + 6
  let at = x - total / 2 + 3
  return (
    <g>
      <rect x={x - total / 2} y={y} width={total} height={24} rx={6} fill="white" stroke="#e4e4e7" />
      {items.map((t, i) => {
        const w = widths[i] ?? 40
        const node = (
          <text key={t} x={at + w / 2} y={y + 16} fontSize={11} fill={INK} textAnchor="middle">
            {t}
          </text>
        )
        at += w
        return node
      })}
    </g>
  )
}

/* ---------- Properties ---------- */

function LayoutPicture({ layout }: { layout: Layout }) {
  const dots = [0, 1, 2]
  return (
    <svg viewBox="0 0 20 20" className="size-5" aria-hidden="true">
      {dots.map((i) =>
        layout === 'down' ? (
          <g key={i}>
            <rect x={2} y={2.5 + i * 5.5} width={4} height={4} rx={1} fill="currentColor" />
            <rect x={8} y={3.75 + i * 5.5} width={10} height={1.5} rx={0.75} fill="currentColor" opacity={0.55} />
          </g>
        ) : (
          <g key={i}>
            <rect x={0.5 + i * 6.75} y={8} width={2.5} height={2.5} rx={0.6} fill="currentColor" />
            <rect x={3.5 + i * 6.75} y={8.75} width={2.5} height={1.2} rx={0.6} fill="currentColor" opacity={0.55} />
          </g>
        ),
      )}
    </svg>
  )
}

type LegendState = ReturnType<typeof useLegend>

function useLegend(start: Entry[]) {
  const toast = useToast()
  const [entries, setEntries] = useState(start)
  const [layout, setLayout] = useState<Layout>('down')
  const [colour, setColour] = useState(BLUE)
  const update = (id: string, change: Partial<Entry>) => setEntries((all) => all.map((e) => (e.id === id ? ({ ...e, ...change } as Entry) : e)))
  const remove = (id: string) => {
    const at = entries.findIndex((e) => e.id === id)
    const gone = entries[at]
    if (!gone || entries.length <= 1) return
    setEntries(entries.filter((e) => e.id !== id))
    toast.add({
      title: 'Row removed',
      description: gone.label,
      actionProps: {
        children: 'Undo',
        onClick: () => {
          setEntries((all) => [...all.slice(0, at), gone, ...all.slice(at)])
          toast.close()
        },
      },
    })
  }
  const add = (kind: 'icon' | 'swatch') => {
    const id = String(Date.now())
    const used = new Set(entries.flatMap((e) => (e.kind === 'swatch' ? [e.colour] : [])))
    const colourNext = NEXT_COLOURS.find((c) => !used.has(c)) ?? NEXT_COLOURS[0] ?? BLUE
    const iconsUsed = new Set(entries.flatMap((e) => (e.kind === 'icon' ? [e.icon] : [])))
    const icon = ICONS.find((i) => !iconsUsed.has(i.id))?.id ?? 't'
    setEntries([...entries, kind === 'icon' ? { id, kind, icon, label: ICONS.find((i) => i.id === icon)?.name ?? 'Icon' } : { id, kind, colour: colourNext, label: 'Condition' }])
  }
  return { entries, layout, setLayout, colour, setColour, update, remove, add }
}

function IconPicker({ entry, s }: { entry: Entry; s: LegendState }) {
  return (
    <Popover
      title="Icon"
      className="w-60"
      trigger={
        <button type="button" aria-label={`Icon for ${entry.label}`} className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-white hover:border-border-strong">
          {entry.kind === 'icon' && <img src={iconHref(entry.icon)} alt="" className="size-5" />}
        </button>
      }
    >
      <div className="grid grid-cols-6 gap-1 p-2">
        {ICONS.map((i) => (
          <button
            key={i.id}
            type="button"
            title={i.name}
            onClick={() => s.update(entry.id, { kind: 'icon', icon: i.id })}
            className={cn('flex aspect-square items-center justify-center rounded-md border bg-white', entry.kind === 'icon' && entry.icon === i.id ? 'border-primary ring-1 ring-primary' : 'border-transparent hover:border-border')}
          >
            <img src={i.href} alt={i.name} className="size-6" />
          </button>
        ))}
      </div>
      <p className="px-3 pb-2 text-[11px] leading-snug text-muted-foreground">Or pick any icon from the Icons tool (Replace icon).</p>
      <div className="border-t border-border p-2">
        <button type="button" onClick={() => s.update(entry.id, { kind: 'swatch', colour: NEXT_COLOURS[0] })} className="flex h-8 w-full items-center gap-1.5 rounded-md px-2 text-xs hover:bg-muted">
          <Square className="size-3.5" />
          Use a colour square instead
        </button>
      </div>
    </Popover>
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

function LegendProperties({ look, s }: { look: Look; s: LegendState }) {
  return (
    <section aria-label="Legend properties" className="flex w-[280px] shrink-0 flex-col border-l border-border bg-panel">
      <div className="flex h-12 items-center gap-2 border-b border-border px-2">
        <button type="button" aria-label="Back to blocks" className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted">
          <ArrowLeft className="size-4" />
        </button>
        <ListOrdered className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">Legend</span>
      </div>
      <div className="flex flex-col py-1">
        <Row label="Layout">
          <SegmentedToggle
            label="Layout"
            stacked
            className="flex-1"
            value={s.layout}
            onValueChange={s.setLayout}
            options={[
              { value: 'down', label: 'Down', picture: <LayoutPicture layout="down" /> },
              { value: 'across', label: 'Across', picture: <LayoutPicture layout="across" /> },
            ]}
          />
        </Row>
      </div>
      <div className="border-t border-border px-3 pt-3 pb-1.5">
        <span className="text-xs font-medium text-muted-foreground">Rows</span>
      </div>
      <div className="flex flex-col gap-0.5 px-2 pb-2">
        {s.entries.map((e) => (
          <div key={e.id} className="group flex h-9 items-center gap-1.5 rounded-md px-1.5 hover:bg-muted">
            {e.kind === 'icon' ? (
              <IconPicker entry={e} s={s} />
            ) : (
              <ColourMenu
                label={`Colour of ${e.label}`}
                value={e.colour}
                onChange={(colour) => colour && s.update(e.id, { colour })}
                trigger={<button type="button" aria-label={`Colour of ${e.label}`} className="size-7 shrink-0 rounded-md border border-black/15" style={{ background: e.colour }} />}
              />
            )}
            <input
              aria-label="Label"
              value={e.label}
              onChange={(ev) => s.update(e.id, { label: ev.target.value })}
              className="h-7 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1 text-xs hover:border-border focus:border-primary focus:outline-none"
            />
            <button
              type="button"
              aria-label={`Remove ${e.label}`}
              disabled={s.entries.length <= 1}
              onClick={() => s.remove(e.id)}
              className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground disabled:opacity-40"
            >
              <Minus className="size-3.5" />
            </button>
          </div>
        ))}
        <div className="mt-1 grid grid-cols-2 gap-1">
          <button type="button" onClick={() => s.add('icon')} className="flex h-8 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
            <Plus className="size-3.5" />
            Icon row
          </button>
          <button type="button" onClick={() => s.add('swatch')} className="flex h-8 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
            <Plus className="size-3.5" />
            Colour row
          </button>
        </div>
      </div>
      {look !== 'plain' && (
        <div className="border-t border-border py-1">
          <Row label={look === 'boxed' ? 'Frame' : 'Icon chips'}>
            <ColourMenu
              label="Block colour"
              value={s.colour}
              onChange={(c) => c && s.setColour(c)}
              trigger={
                <button type="button" className="flex h-8 w-full items-center gap-2 rounded-md border border-border bg-white px-2 text-xs">
                  <span className="size-4 rounded-sm border border-black/15" style={{ background: s.colour }} />
                  Block colour
                </button>
              }
            />
          </Row>
        </div>
      )}
      <div className="mt-auto border-t border-border p-3">
        <Button variant="secondary" size="sm" className="w-full gap-1.5">
          <Ungroup aria-hidden="true" />
          Detach legend
        </Button>
      </div>
    </section>
  )
}

/* ---------- Layout of the story page ---------- */

function Tile({ title, children, note }: { title: string; children: ReactNode; note?: string }) {
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-xs font-medium text-muted-foreground">{title}</figcaption>
      <div className="flex min-h-[120px] items-center justify-center overflow-hidden rounded-lg border border-border bg-white">{children}</div>
      {note && <p className="text-xs leading-snug text-muted-foreground">{note}</p>}
    </figure>
  )
}

/** The card in the Blocks tool: the block as it is placed, on a piece of white page. */
function Card({ look }: { look: Look }) {
  const d = draw(look, START, 'down', BLUE)
  const scale = Math.min(120 / d.w, 72 / d.h, 1)
  return (
    <figure className="flex w-[150px] flex-col gap-1.5 rounded-md border border-border-strong bg-panel p-1.5 text-muted-foreground">
      <span className="flex aspect-[3/2] w-full items-center justify-center rounded-sm bg-white p-1.5">
        <svg viewBox={`-4 -4 ${d.w + 8} ${d.h + 8}`} width={(d.w + 8) * scale} height={(d.h + 8) * scale} style={{ fontFamily: FONT }}>
          {d.body}
        </svg>
      </span>
      <span className="text-xs leading-tight">Legend</span>
    </figure>
  )
}

const VERSIONS: { look: Look; title: string; note: string; selectedNote: string }[] = [
  {
    look: 'plain',
    title: 'A · Plain key',
    note: 'No frame: marker, label, next row. What journals print beside a figure. Icons and colour squares take the same width, so the labels line up.',
    selectedNote: 'Hover a row on the page for its − (Undo toast). The + under the last row (or right of it, across) adds a row like the last one. Corners resize without stretching: icons and text grow together.',
  },
  {
    look: 'boxed',
    title: 'B · Boxed key',
    note: 'A white card with a "KEY" header in the block colour and thin lines between rows; icons sit on a pale round tile. Reads as one piece on a busy poster or slide. Across, each row becomes a column (marker over label).',
    selectedNote: 'Same handles as A. The frame and header take the block colour, picked from the preset squares like a panel’s.',
  },
  {
    look: 'chips',
    title: 'C · Chips',
    note: 'Each row is a rounded chip, tinted in its own colour (icon rows in the block colour). Compact and modern; across, it makes a neat strip over a figure.',
    selectedNote: 'Same handles as A. Changing a colour square’s colour re-tints its chip too.',
  },
]

export const Versions: Story = {
  name: 'Legend · A, B, C',
  render: () => (
    <div className="bg-background text-foreground">
      {VERSIONS.map((v) => (
        <section key={v.look} className="flex flex-col gap-4 border-b border-border p-6">
          <header>
            <h2 className="text-base font-semibold">{v.title}</h2>
            <p className="max-w-4xl text-sm text-muted-foreground">{v.note}</p>
          </header>
          <div className="flex flex-wrap items-start gap-6">
            <figure className="flex flex-col gap-2">
              <figcaption className="text-xs font-medium text-muted-foreground">Card in the Blocks tool</figcaption>
              <Card look={v.look} />
            </figure>
            <Tile title="Down">
              <LegendOnPage look={v.look} entries={PAGE} layout="down" />
            </Tile>
            <div className="max-w-[420px]">
              <Tile title="Selected, pointer over a row" note={v.selectedNote}>
                <LegendOnPage look={v.look} entries={PAGE} layout="down" selected hoverRow={1} />
              </Tile>
            </div>
            <Tile title="Across">
              <LegendOnPage look={v.look} entries={PAGE} layout="across" />
            </Tile>
          </div>
        </section>
      ))}
    </div>
  ),
}

function TryIt() {
  const [look, setLook] = useState<Look>('plain')
  const s = useLegend(PAGE)
  return (
    <div className="relative flex h-screen bg-background text-foreground">
      <div className="flex flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-border p-3">
          <span className="text-sm font-medium">Version</span>
          <SegmentedToggle
            label="Version"
            showLabels
            className="h-8"
            value={look}
            onValueChange={setLook}
            options={[
              { value: 'plain', label: 'A · Plain key' },
              { value: 'boxed', label: 'B · Boxed key' },
              { value: 'chips', label: 'C · Chips' },
            ]}
          />
          <span className="text-xs text-muted-foreground">Change rows, colours, icons and the layout in the panel on the right.</span>
        </div>
        <div className="flex flex-1 items-center justify-center overflow-auto bg-canvas p-8">
          <div className="shadow-sm">
            <LegendOnPage look={look} entries={s.entries} layout={s.layout} colour={s.colour} selected />
          </div>
        </div>
      </div>
      <LegendProperties look={look} s={s} />
      <ToastViewport contained />
    </div>
  )
}

export const Playground: Story = {
  name: 'Try it',
  render: () => (
    <ToastProvider>
      <TryIt />
    </ToastProvider>
  ),
}
