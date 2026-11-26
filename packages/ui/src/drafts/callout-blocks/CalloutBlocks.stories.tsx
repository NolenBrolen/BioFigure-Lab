/*
 * BIO-97 design drafts: callout blocks. Visual drafts only: no tests, no
 * accessibility pass, nothing wired up. After the owner picks, the chosen
 * versions get built properly in the editor's Blocks tool (new "Callouts"
 * heading).
 *
 * Zoom inset: a magnified view of one spot of the figure, with lines back to
 * a small marker on that spot.
 *   A  Lens       round marker, round inset, two lines touching both circles
 *   B  Frame      square marker, square inset, lines corner to corner, "10×" tag
 *   C  Pin        a dot on the spot, one line to a tinted round inset with a caption
 *   + "What the inset shows": a live magnified copy vs a space for an icon.
 *
 * Labelled icon: an icon with leader-line labels around it.
 *   A  Plain lines   dot on the part, straight line, text in a column each side
 *   B  Chips         elbow lines ending in tinted label chips
 *   C  Numbers + key numbered badges on short lines, the names in a key beside
 *
 * Each version shows its card in the Blocks tool (what clicking it places),
 * the block on the page filled in, and the block selected.
 *
 * The pictures are real library icons, read from the repo's icons folder for
 * these drafts only (nothing from it is bundled into packages/ui).
 */
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactNode } from 'react'

import bCellSvg from '../../../../../icons/cells/b-cell-detailed-flat.svg?raw'
import epithelialSvg from '../../../../../icons/cells/epithelial-cell-detailed-flat.svg?raw'
import mouseSvg from '../../../../../icons/animals/mouse-side-grey.svg?raw'

const meta = {
  title: 'Drafts/BIO-97 Callout blocks',
  parameters: { controls: { disable: true }, layout: 'fullscreen' },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const BLUE = '#0072b2' // the panels' blue
const TINT = '#e6f1f8'
const SELECT = '#2563eb' // selection blue
const INK = '#27272a'
const FONT = 'Inter, system-ui, sans-serif'

type XY = { x: number; y: number }

const dataUrl = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
const MOUSE = dataUrl(mouseSvg)
const EPITHELIAL = dataUrl(epithelialSvg)
const BCELL = dataUrl(bCellSvg)

/** A library icon (128 × 128 grid) drawn at (x, y), `size` wide. */
function Icon({ href, x, y, size }: { href: string; x: number; y: number; size: number }) {
  return <image href={href} x={x} y={y} width={size} height={size} />
}

/* ---------- Pieces both blocks use ---------- */

/** An empty icon space as the editor draws it: faint dashed box, faded cell, plus badge. */
function EmptySpace({ x, y, w, h, round = false, colour = BLUE }: { x: number; y: number; w: number; h: number; round?: boolean; colour?: string }) {
  const r = Math.min(15, Math.max(8, Math.min(w, h) * 0.2))
  const m = { x: x + w / 2, y: y + h / 2 }
  const badge = { x: m.x + r * 0.68, y: m.y + r * 0.68, r: Math.max(4, r * 0.36) }
  return (
    <g>
      {round ? (
        <circle cx={m.x} cy={m.y} r={w / 2} fill={colour} fillOpacity={0.05} stroke={colour} strokeOpacity={0.32} strokeDasharray="3 3" />
      ) : (
        <rect x={x} y={y} width={w} height={h} rx={8} fill={colour} fillOpacity={0.05} stroke={colour} strokeOpacity={0.32} strokeDasharray="3 3" />
      )}
      <circle cx={m.x} cy={m.y} r={r} fill="#eef5fa" stroke="#b3d3e8" />
      <circle cx={m.x - r * 0.12} cy={m.y - r * 0.1} r={r * 0.58} fill="#c6dfee" />
      <circle cx={badge.x} cy={badge.y} r={badge.r + 1.5} fill="#f2f7fb" />
      <circle cx={badge.x} cy={badge.y} r={badge.r} fill="#94c0dc" />
      <path d={`M ${badge.x - badge.r / 2} ${badge.y} H ${badge.x + badge.r / 2} M ${badge.x} ${badge.y - badge.r / 2} V ${badge.y + badge.r / 2}`} stroke="#fff" strokeWidth={1.25} strokeLinecap="round" />
    </g>
  )
}

function Text({ x, y, children, anchor = 'start', size = 11, weight = 500, colour = INK }: { x: number; y: number; children: ReactNode; anchor?: 'start' | 'middle' | 'end'; size?: number; weight?: number; colour?: string }) {
  return (
    <text x={x} y={y} textAnchor={anchor} dominantBaseline="middle" fontFamily={FONT} fontSize={size} fontWeight={weight} fill={colour}>
      {children}
    </text>
  )
}

/** Fabric's selection box with its eight square handles. */
function SelectionBox({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const pts = [
    [x, y],
    [x + w / 2, y],
    [x + w, y],
    [x + w, y + h / 2],
    [x + w, y + h],
    [x + w / 2, y + h],
    [x, y + h],
    [x, y + h / 2],
  ]
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="none" stroke={SELECT} strokeWidth={1} />
      {pts.map(([px = 0, py = 0], i) => (
        <rect key={i} x={px - 3.5} y={py - 3.5} width={7} height={7} fill="#fff" stroke={SELECT} strokeWidth={1} />
      ))}
    </g>
  )
}

/** A round drag handle (the marker, a label's end). */
function DragDot({ x, y }: { x: number; y: number }) {
  return <circle cx={x} cy={y} r={4.5} fill="#fff" stroke={SELECT} strokeWidth={1.5} />
}

/** A small round button on the canvas: "+" to add, "−" to remove. */
function RoundButton({ x, y, minus = false }: { x: number; y: number; minus?: boolean }) {
  return (
    <g>
      <circle cx={x} cy={y} r={9} fill={minus ? '#fff' : SELECT} stroke={SELECT} strokeWidth={1.25} />
      <path d={minus ? `M ${x - 4} ${y} H ${x + 4}` : `M ${x - 4} ${y} H ${x + 4} M ${x} ${y - 4} V ${y + 4}`} stroke={minus ? SELECT : '#fff'} strokeWidth={1.75} strokeLinecap="round" />
    </g>
  )
}

/** The floating quick-actions bar over a selection (a plain picture of it). */
function Bar({ x, y, items }: { x: number; y: number; items: string[] }) {
  const widths = items.map((item) => item.length * 6.2 + 18)
  const total = widths.reduce((a, b) => a + b, 0) + 8
  let at = x - total / 2 + 4
  return (
    <g>
      <rect x={x - total / 2} y={y} width={total} height={26} rx={7} fill="#fff" stroke="#e4e4e7" />
      {items.map((item, i) => {
        const w = widths[i] ?? 0
        const cx = at + w / 2
        at += w
        return (
          <Text key={item} x={cx} y={y + 13.5} anchor="middle" size={10.5} colour={INK}>
            {item}
          </Text>
        )
      })}
    </g>
  )
}

/** Two outer lines touching both circles (a magnifier's look). */
function tangents(a: XY, ra: number, b: XY, rb: number): [XY, XY][] {
  const d = Math.hypot(b.x - a.x, b.y - a.y)
  const theta = Math.atan2(b.y - a.y, b.x - a.x)
  const phi = Math.acos((ra - rb) / d)
  return [1, -1].map((s) => {
    const angle = theta + s * phi
    return [
      { x: a.x + ra * Math.cos(angle), y: a.y + ra * Math.sin(angle) },
      { x: b.x + rb * Math.cos(angle), y: b.y + rb * Math.sin(angle) },
    ]
  })
}

/** The two corner-to-corner lines that run along the outside of both boxes. */
function cornerLines(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): [XY, XY][] {
  const corners = (r: typeof a): XY[] => [
    { x: r.x, y: r.y },
    { x: r.x + r.w, y: r.y },
    { x: r.x + r.w, y: r.y + r.h },
    { x: r.x, y: r.y + r.h },
  ]
  const ca = corners(a)
  const cb = corners(b)
  const all = [...ca, ...cb]
  const lines: [XY, XY][] = []
  ca.forEach((p, i) => {
    const q = cb[i]
    if (!q) return
    const side = (r: XY) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)
    const sides = all.map(side).filter((v) => Math.abs(v) > 0.01)
    if (sides.every((v) => v > 0) || sides.every((v) => v < 0)) lines.push([p, q])
  })
  return lines
}

/* ---------- Zoom inset ---------- */

type InsetLook = 'lens' | 'frame' | 'pin'
type InsetContent = 'icon' | 'live' | 'empty'

// The scene: a mouse, a marker on its belly, the inset up and to the right.
const MOUSE_AT = { x: 0, y: 62, size: 200 }
const SPOT = { x: 142, y: 154 }
const MARK_R = 14
const INSET = { x: 280, y: 108 }
const INSET_R = 64

/** What the inset shows, clipped to its shape. */
function InsetFill({ content, look, id }: { content: InsetContent; look: InsetLook; id: string }) {
  const square = look === 'frame'
  const box = { x: INSET.x - INSET_R, y: INSET.y - INSET_R, w: 2 * INSET_R, h: 2 * INSET_R }
  if (content === 'empty') return <EmptySpace x={box.x + 6} y={box.y + 6} w={box.w - 12} h={box.h - 12} round={!square} />
  return (
    <g>
      <clipPath id={id}>{square ? <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={6} /> : <circle cx={INSET.x} cy={INSET.y} r={INSET_R} />}</clipPath>
      <g clipPath={`url(#${id})`}>
        {look === 'pin' && <rect x={box.x} y={box.y} width={box.w} height={box.h} fill={TINT} />}
        {content === 'icon' ? (
          <Icon href={EPITHELIAL} x={box.x + box.w * 0.16} y={box.y + box.h * 0.16} size={box.w * 0.68} />
        ) : (
          // A live copy: the same mouse, magnified so the marked spot fills the inset.
          <svg x={box.x} y={box.y} width={box.w} height={box.h} viewBox={`${SPOT.x - MARK_R} ${SPOT.y - MARK_R} ${2 * MARK_R} ${2 * MARK_R}`} preserveAspectRatio="xMidYMid slice">
            <rect x={0} y={0} width={400} height={300} fill="#fff" />
            <Icon href={MOUSE} x={MOUSE_AT.x} y={MOUSE_AT.y} size={MOUSE_AT.size} />
          </svg>
        )}
      </g>
    </g>
  )
}

function ZoomInset({ look, content, selected = false, id }: { look: InsetLook; content: InsetContent; selected?: boolean; id: string }) {
  const line = { stroke: BLUE, strokeWidth: 1.25 }
  const box = { x: INSET.x - INSET_R, y: INSET.y - INSET_R, w: 2 * INSET_R, h: 2 * INSET_R }
  const mark = { x: SPOT.x - MARK_R, y: SPOT.y - MARK_R, w: 2 * MARK_R, h: 2 * MARK_R }
  return (
    <svg viewBox="0 0 360 250" className="w-full">
      <rect width={360} height={250} fill="#fff" />
      <Icon href={MOUSE} x={MOUSE_AT.x} y={MOUSE_AT.y} size={MOUSE_AT.size} />

      {look === 'lens' && (
        <g>
          {tangents(SPOT, MARK_R, INSET, INSET_R).map(([p, q], i) => (
            <line key={i} x1={p.x} y1={p.y} x2={q.x} y2={q.y} {...line} />
          ))}
          <circle cx={SPOT.x} cy={SPOT.y} r={MARK_R} fill={BLUE} fillOpacity={0.08} stroke={BLUE} strokeWidth={1.5} />
          <circle cx={INSET.x} cy={INSET.y} r={INSET_R} fill="#fff" />
          <InsetFill content={content} look={look} id={id} />
          <circle cx={INSET.x} cy={INSET.y} r={INSET_R} fill="none" stroke={BLUE} strokeWidth={2} />
        </g>
      )}

      {look === 'frame' && (
        <g>
          {cornerLines(mark, box).map(([p, q], i) => (
            <line key={i} x1={p.x} y1={p.y} x2={q.x} y2={q.y} {...line} strokeDasharray="4 3" />
          ))}
          <rect x={mark.x} y={mark.y} width={mark.w} height={mark.h} rx={2} fill="none" stroke={BLUE} strokeWidth={1.5} strokeDasharray="4 3" />
          <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={6} fill="#fff" />
          <InsetFill content={content} look={look} id={id} />
          <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={6} fill="none" stroke={BLUE} strokeWidth={2} />
          <rect x={box.x + box.w - 36} y={box.y + box.h - 22} width={30} height={16} rx={4} fill={BLUE} />
          <Text x={box.x + box.w - 21} y={box.y + box.h - 13.5} anchor="middle" size={9.5} weight={600} colour="#fff">
            10×
          </Text>
        </g>
      )}

      {look === 'pin' && (
        <g>
          {(() => {
            const angle = Math.atan2(INSET.y - SPOT.y, INSET.x - SPOT.x)
            const end = { x: INSET.x - INSET_R * Math.cos(angle), y: INSET.y - INSET_R * Math.sin(angle) }
            return <line x1={SPOT.x} y1={SPOT.y} x2={end.x} y2={end.y} stroke={BLUE} strokeWidth={1.5} />
          })()}
          <circle cx={SPOT.x} cy={SPOT.y} r={6} fill={BLUE} stroke="#fff" strokeWidth={2} />
          <circle cx={INSET.x} cy={INSET.y} r={INSET_R} fill={TINT} />
          <InsetFill content={content} look={look} id={id} />
          <circle cx={INSET.x} cy={INSET.y} r={INSET_R} fill="none" stroke={BLUE} strokeWidth={3} />
          <Text x={INSET.x} y={INSET.y + INSET_R + 16} anchor="middle" size={11} weight={600} colour={BLUE}>
            Gut epithelium
          </Text>
        </g>
      )}

      {selected && (
        <g>
          <SelectionBox x={box.x - 4} y={box.y - 4} w={box.w + 8} h={box.h + (look === 'pin' ? 30 : 8)} />
          <DragDot x={SPOT.x + (look === 'pin' ? 0 : MARK_R)} y={SPOT.y + (look === 'pin' ? 0 : MARK_R * (look === 'frame' ? 1 : 0))} />
          <Bar x={INSET.x - 20} y={4} items={content === 'live' ? ['Zoom 10×', 'Detach'] : ['Swap icon', 'Detach']} />
        </g>
      )}
    </svg>
  )
}

/* ---------- Labelled icon ---------- */

type LabelLook = 'plain' | 'chips' | 'numbers'

// The B cell in the middle; points on it in the icon's 128 grid. The numbers
// look moves the cell left to make room for its key.
const LW = 420
const LH = 250
const cellAt = (look: LabelLook) => ({ x: look === 'numbers' ? 95 : 145, y: 55, size: 130 })
const onCell = (look: LabelLook, gx: number, gy: number): XY => {
  const c = cellAt(look)
  return { x: c.x + (gx / 128) * c.size, y: c.y + (gy / 128) * c.size }
}

type Label = { name: string; grid: XY; y: number; side: 'left' | 'right' }
const LABELS: Label[] = [
  { name: 'B-cell receptor', grid: { x: 73, y: 17 }, y: 58, side: 'right' },
  { name: 'Rough ER', grid: { x: 88, y: 42 }, y: 112, side: 'right' },
  { name: 'Nucleus', grid: { x: 55, y: 64 }, y: 102, side: 'left' },
  { name: 'Plasma membrane', grid: { x: 26, y: 84 }, y: 160, side: 'left' },
]
const COLUMN = { left: 118, right: 302 }

function LabelledIcon({ look, empty = false, selected = false }: { look: LabelLook; empty?: boolean; selected?: boolean }) {
  const cell = cellAt(look)
  const middle = { x: cell.x + cell.size / 2, y: cell.y + cell.size / 2 }
  const key = { x: 300, y: 78, step: 26 }
  return (
    <svg viewBox={`0 0 ${LW} ${LH}`} className="w-full">
      <rect width={LW} height={LH} fill="#fff" />
      {empty ? <EmptySpace x={cell.x + 10} y={cell.y + 10} w={cell.size - 20} h={cell.size - 20} /> : <Icon href={BCELL} x={cell.x} y={cell.y} size={cell.size} />}

      {LABELS.map((label, i) => {
        const part = onCell(look, label.grid.x, label.grid.y)
        const shown = empty ? `Label ${i + 1}` : label.name
        const dir = label.side === 'right' ? 1 : -1
        const at = { x: label.side === 'right' ? COLUMN.right : COLUMN.left, y: label.y }

        if (look === 'plain') {
          const elbow = { x: at.x - dir * 14, y: at.y }
          return (
            <g key={label.name}>
              <polyline points={`${part.x},${part.y} ${elbow.x},${elbow.y} ${at.x},${at.y}`} fill="none" stroke={INK} strokeWidth={1} />
              <circle cx={part.x} cy={part.y} r={2.5} fill={INK} />
              <Text x={at.x + dir * 5} y={at.y} anchor={label.side === 'right' ? 'start' : 'end'} size={11} weight={500}>
                {shown}
              </Text>
            </g>
          )
        }

        if (look === 'chips') {
          const w = shown.length * 6 + 16
          const chipX = label.side === 'right' ? at.x : at.x - w
          const bend = { x: part.x + dir * Math.min(18, Math.abs(at.y - part.y)), y: at.y }
          return (
            <g key={label.name}>
              <polyline points={`${part.x},${part.y} ${bend.x},${bend.y} ${at.x},${at.y}`} fill="none" stroke={BLUE} strokeWidth={1.25} strokeLinejoin="round" />
              <circle cx={part.x} cy={part.y} r={3.5} fill="#fff" stroke={BLUE} strokeWidth={1.5} />
              <rect x={chipX} y={at.y - 10} width={w} height={20} rx={10} fill={TINT} stroke={BLUE} strokeWidth={1} />
              <Text x={chipX + w / 2} y={at.y + 0.5} anchor="middle" size={10.5} weight={600} colour={BLUE}>
                {shown}
              </Text>
            </g>
          )
        }

        // Numbers + key: a numbered badge on a short line out from the part.
        const away = { x: part.x - middle.x, y: part.y - middle.y }
        const len = Math.hypot(away.x, away.y) || 1
        const reach = len > cell.size * 0.3 ? 22 : cell.size * 0.5 - len + 18
        const badge = { x: part.x + (away.x / len) * reach, y: part.y + (away.y / len) * reach }
        return (
          <g key={label.name}>
            <line x1={part.x} y1={part.y} x2={badge.x} y2={badge.y} stroke={BLUE} strokeWidth={1.25} />
            <circle cx={part.x} cy={part.y} r={2.5} fill={BLUE} />
            <circle cx={badge.x} cy={badge.y} r={9} fill={BLUE} />
            <Text x={badge.x} y={badge.y + 0.5} anchor="middle" size={10} weight={700} colour="#fff">
              {i + 1}
            </Text>
          </g>
        )
      })}

      {look === 'numbers' &&
        LABELS.map((label, i) => (
          <g key={label.name}>
            <circle cx={key.x} cy={key.y + i * key.step} r={8} fill={BLUE} />
            <Text x={key.x} y={key.y + 0.5 + i * key.step} anchor="middle" size={9.5} weight={700} colour="#fff">
              {i + 1}
            </Text>
            <Text x={key.x + 14} y={key.y + i * key.step} size={10.5}>
              {empty ? `Label ${i + 1}` : label.name}
            </Text>
          </g>
        ))}

      {selected && (
        <g>
          <SelectionBox x={look === 'numbers' ? 60 : 14} y={40} w={look === 'numbers' ? 350 : 392} h={170} />
          {LABELS.map((label) => {
            const part = onCell(look, label.grid.x, label.grid.y)
            return <DragDot key={label.name} x={part.x} y={part.y} />
          })}
          {/* Hovering a label shows its remove button. */}
          {look === 'numbers' ? (
            <RoundButton x={key.x - 18} y={key.y + key.step} minus />
          ) : (
            <RoundButton x={COLUMN.right + (look === 'chips' ? 'Rough ER'.length * 6 + 16 : 58) + 14} y={112} minus />
          )}
          <RoundButton x={look === 'numbers' ? key.x : LW / 2} y={look === 'numbers' ? key.y + 4 * key.step : 228} />
          <Bar x={LW / 2} y={6} items={['Add label', 'Swap icon', 'Detach']} />
        </g>
      )}
    </svg>
  )
}

/* ---------- Layout ---------- */

function Tile({ title, children, note }: { title: string; children: ReactNode; note?: string }) {
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-xs font-medium text-muted-foreground">{title}</figcaption>
      <div className="overflow-hidden rounded-lg border border-border bg-white">{children}</div>
      {note && <p className="text-xs leading-snug text-muted-foreground">{note}</p>}
    </figure>
  )
}

/** The card in the Blocks tool: the block as it is placed, on a piece of white page. */
function Card({ name, children }: { name: string; children: ReactNode }) {
  return (
    <figure className="flex w-[150px] flex-col gap-1.5 rounded-md border border-border-strong bg-panel p-1.5 text-muted-foreground">
      <span className="flex aspect-[3/2] w-full items-center justify-center rounded-sm bg-white p-1.5">{children}</span>
      <span className="text-xs leading-tight">{name}</span>
    </figure>
  )
}

function Version({ title, note, card, page, selected, selectedNote }: { title: string; note: string; card: ReactNode; page: ReactNode; selected: ReactNode; selectedNote: string }) {
  return (
    <section className="flex flex-col gap-4 border-b border-border p-6">
      <header>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{note}</p>
      </header>
      <div className="grid grid-cols-[160px_1fr_1fr] items-start gap-6">
        <Tile title="Card in the Blocks tool">{card}</Tile>
        <Tile title="On the page">{page}</Tile>
        <Tile title="Selected" note={selectedNote}>
          {selected}
        </Tile>
      </div>
    </section>
  )
}

const INSET_VERSIONS: { look: InsetLook; title: string; note: string; selectedNote: string }[] = [
  {
    look: 'lens',
    title: 'A · Lens',
    note: 'A round marker on the spot and a round inset, joined by the two lines that touch both circles, like a magnifying glass.',
    selectedNote: 'Drag the inset or the marker (round handle) anywhere: the two lines are worked out again as you drag. The corners resize the inset and it stays round.',
  },
  {
    look: 'frame',
    title: 'B · Frame',
    note: 'A dashed square on the spot and a square inset, joined corner to corner, with a "10×" tag. The usual look for microscopy zooms.',
    selectedNote: 'Same handles as A. The tag shows how much the inset magnifies; it can be switched off in the properties.',
  },
  {
    look: 'pin',
    title: 'C · Pin',
    note: 'Just a dot on the spot and one line to a tinted round inset with a caption under it. The quietest of the three.',
    selectedNote: 'The dot is the marker’s handle. The caption is part of the block and can be switched off.',
  },
]

const LABEL_VERSIONS: { look: LabelLook; title: string; note: string; selectedNote: string }[] = [
  {
    look: 'plain',
    title: 'A · Plain lines',
    note: 'A small dot on each part, a thin straight line with a short level end, the text in a column on each side. Textbook style.',
    selectedNote: 'Drag a label or the dot on its part; the line follows. Hover a label for its − button; the + (or Add label) adds one with its own line.',
  },
  {
    look: 'chips',
    title: 'B · Chips',
    note: 'Elbow lines in the block colour ending in tinted label chips; a ring marks each part.',
    selectedNote: 'Same handles as A. The chips take the block colour, picked from the preset squares like a panel’s.',
  },
  {
    look: 'numbers',
    title: 'C · Numbers + key',
    note: 'Short lines to numbered badges around the icon; the names sit in a key beside it. Tidy when the names are long or the icon is small.',
    selectedNote: 'Drag a badge around the icon or the dot on its part. Removing a label renumbers the rest; the + under the key adds the next number.',
  },
]

/* ---------- Stories ---------- */

export const ZoomInsets: Story = {
  name: 'Zoom inset · A, B, C',
  render: () => (
    <div className="bg-background text-foreground">
      {INSET_VERSIONS.map((v) => (
        <Version
          key={v.look}
          title={v.title}
          note={v.note}
          selectedNote={v.selectedNote}
          card={
            <Card name="Zoom inset">
              <ZoomInset look={v.look} content="empty" id={`card-${v.look}`} />
            </Card>
          }
          page={<ZoomInset look={v.look} content="icon" id={`page-${v.look}`} />}
          selected={<ZoomInset look={v.look} content="icon" selected id={`sel-${v.look}`} />}
        />
      ))}
    </div>
  ),
}

export const InsetContent: Story = {
  name: 'Zoom inset · what the inset shows',
  render: () => (
    <div className="flex flex-col gap-4 bg-background p-6 text-foreground">
      <header>
        <h2 className="text-base font-semibold">Live copy or a space for an icon?</h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Recommended: <strong>a space for an icon</strong> (left). Figures zoom in to show something at a smaller scale (a mouse → its gut cells), which an icon does well; a live copy only blows up the same drawing, which for icons
          looks blurry and adds nothing (right). Placed, the inset is an empty icon space; click it and pick an icon, as in a panel.
        </p>
      </header>
      <div className="grid max-w-5xl grid-cols-3 gap-6">
        <Tile title="Space for an icon, filled (recommended)">
          <ZoomInset look="lens" content="icon" id="content-icon" />
        </Tile>
        <Tile title="Space for an icon, just placed">
          <ZoomInset look="lens" content="empty" id="content-empty" />
        </Tile>
        <Tile title="Live magnified copy of the marked spot" note="Moves with the marker, updates as the figure changes. Useful for photos and micrographs, less so for icons.">
          <ZoomInset look="lens" content="live" id="content-live" />
        </Tile>
      </div>
    </div>
  ),
}

export const LabelledIcons: Story = {
  name: 'Labelled icon · A, B, C',
  render: () => (
    <div className="bg-background text-foreground">
      {LABEL_VERSIONS.map((v) => (
        <Version
          key={v.look}
          title={v.title}
          note={v.note}
          selectedNote={v.selectedNote}
          card={
            <Card name="Labelled icon">
              <LabelledIcon look={v.look} empty />
            </Card>
          }
          page={<LabelledIcon look={v.look} />}
          selected={<LabelledIcon look={v.look} selected />}
        />
      ))}
    </div>
  ),
}
