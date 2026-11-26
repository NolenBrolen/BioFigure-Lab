/*
 * BIO-95 design drafts: comparison blocks. Two blocks in the Blocks tool's
 * new "Comparisons" section:
 *
 *   Control vs Treatment  two matching panels side by side, "vs" between
 *   Before / After        two panels with a big arrow between them
 *
 * Visual drafts only: no tests, no accessibility pass, nothing wired up.
 * Every version shows the same things: both blocks on the page with cells in
 * them, the block selected (its bar), what resizing one side does, and the
 * two cards in the Blocks tool (empty icon spaces, as clicking places them).
 *
 *   A  Twin panels    Two Header bar panels in the panels' blue. A round "vs"
 *                     badge in the gap; a fat block arrow for Before/After.
 *   B  Paired colours The two sides in their own colours (grey for Control
 *                     or Before, blue for Treatment or After), Title tab and
 *                     Soft area looks; a thin "vs" divider; a long arrow with
 *                     a label for what happened ("+ LPS, 24 h").
 *   C  Split frame    One outlined frame cut in two: a straight divider with
 *                     a "vs" pill, or a chevron-shaped divider pointing to
 *                     After; small capital labels at the top of each half.
 *
 * The cells are simple drawings in the app's colour-blind-safe colours,
 * standing in for library icons (icons never go into packages/ui).
 */
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ArrowLeftRight, Lock, MoreHorizontal, Unlink } from 'lucide-react'
import type { ReactNode } from 'react'

import { QuickActions, type QuickAction, type QuickActionGroup } from '../../components/quick-actions/QuickActions'
import { cn } from '../../lib/cn'

const meta = {
  title: 'Drafts/BIO-95 Comparison blocks',
  parameters: { controls: { disable: true }, layout: 'fullscreen' },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const noop = () => undefined
const SELECT = '#2563eb' // selection blue
const BLUE = '#0072b2' // the panels' blue
const GREY = '#71717a'
const INK = '#27272a'
const FONT = 'Inter, system-ui, sans-serif'

function channels(hex: string): number[] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
}
const toHex = (parts: number[]) => `#${parts.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`
/** The colour on white: 0.1 a pale wash, 1 the colour itself. */
const wash = (hex: string, share: number) => toHex(channels(hex).map((c) => 255 - (255 - c) * share))
/** A darker shade, for titles written in the colour. */
const shade = (hex: string, keep = 0.62) => toHex(channels(hex).map((c) => c * keep))

/* ---------- The cells (64 × 64 drawings) ---------- */

type Cell = 'tcell' | 'activated' | 'monocyte' | 'dendritic' | 'space'

function CellArt({ cell, cx, cy, size, colour = BLUE }: { cell: Cell; cx: number; cy: number; size: number; colour?: string }) {
  const k = size / 64
  return (
    <g transform={`translate(${cx - size / 2} ${cy - size / 2}) scale(${k})`}>
      {cell === 'tcell' && (
        <>
          <circle cx="32" cy="32" r="19" fill="#d4ebf7" stroke="#0072b2" strokeWidth="2.5" />
          <circle cx="33" cy="31" r="12" fill="#56b4e9" fillOpacity="0.85" />
        </>
      )}
      {cell === 'activated' && (
        <>
          <circle cx="32" cy="32" r="24" fill="#d4ebf7" stroke="#0072b2" strokeWidth="2.5" />
          <circle cx="33" cy="31" r="14" fill="#56b4e9" fillOpacity="0.85" />
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
            const a = (i / 8) * Math.PI * 2 + 0.3
            return <circle key={i} cx={32 + 29 * Math.cos(a)} cy={32 + 29 * Math.sin(a)} r="2.4" fill="#009e73" />
          })}
        </>
      )}
      {cell === 'monocyte' && (
        <>
          <circle cx="32" cy="32" r="25" fill="#f3dde9" stroke="#cc79a7" strokeWidth="2.5" />
          <path d="M22 27 C22 19 34 16 41 21 C46 25 46 33 41 37 C37 40 35 35 31 37 C26 40 22 35 22 27 Z" fill="#cc79a7" fillOpacity="0.75" />
          <circle cx="24" cy="44" r="2.5" fill="#cc79a7" fillOpacity="0.5" />
          <circle cx="38" cy="47" r="2" fill="#cc79a7" fillOpacity="0.5" />
        </>
      )}
      {cell === 'dendritic' && (
        <>
          <path
            d="M32 6 C36 17 44 10 52 12 C47 21 58 27 58 32 C49 34 54 44 52 52 C43 47 37 57 32 58 C27 49 20 54 12 52 C15 43 6 37 6 32 C15 29 10 20 12 12 C21 15 28 8 32 6 Z"
            fill="#fbe7c2"
            stroke="#e69f00"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <circle cx="32" cy="32" r="10" fill="#e69f00" fillOpacity="0.8" />
        </>
      )}
      {cell === 'space' && (
        // An empty icon space: dashed box, faded cell, cut-out "+" badge.
        <>
          <rect x="2" y="2" width="60" height="60" rx="8" fill={wash(colour, 0.05)} stroke={colour} strokeOpacity="0.6" strokeWidth="2" strokeDasharray="6 4" />
          <circle cx="32" cy="32" r="14" fill={wash(colour, 0.2)} />
          <circle cx="45" cy="45" r="9" fill={colour} stroke="#ffffff" strokeWidth="3" />
          <path d="M40.5 45 h9 M45 40.5 v9" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
        </>
      )}
    </g>
  )
}

function Text({ x, y, children, anchor = 'middle', weight = 600, colour = INK, size = 12, upper, italic }: { x: number; y: number; children: ReactNode; anchor?: 'start' | 'middle'; weight?: number; colour?: string; size?: number; upper?: boolean; italic?: boolean }) {
  return (
    <text x={x} y={y} textAnchor={anchor} dominantBaseline="middle" fontFamily={FONT} fontSize={size} fontWeight={weight} fill={colour} letterSpacing={upper ? 0.8 : 0} fontStyle={italic ? 'italic' : 'normal'}>
      {upper && typeof children === 'string' ? children.toUpperCase() : children}
    </text>
  )
}

/* ---------- Panel looks (as the editor's panels draw them) ---------- */

type Box = { x: number; y: number; w: number; h: number }
type PanelLook = 'bar' | 'tab' | 'soft'

/** A panel in one of the editor's looks; returns where its contents' middle is. */
function Panel({ box, look, colour, title }: { box: Box; look: PanelLook; colour: string; title: string }) {
  const { x, y, w, h } = box
  if (look === 'bar') {
    return (
      <g>
        <rect x={x} y={y} width={w} height={h} rx="8" fill={wash(colour, 0.08)} stroke={colour} strokeWidth="1.5" />
        <path d={`M ${x} ${y + 26} V ${y + 8} Q ${x} ${y} ${x + 8} ${y} H ${x + w - 8} Q ${x + w} ${y} ${x + w} ${y + 8} V ${y + 26} Z`} fill={colour} />
        <Text x={x + 12} y={y + 13.5} anchor="start" colour="#ffffff">
          {title}
        </Text>
      </g>
    )
  }
  if (look === 'tab') {
    const pill = title.length * 6.6 + 20
    return (
      <g>
        <rect x={x} y={y} width={w} height={h} rx="8" fill="#ffffff" stroke={colour} strokeWidth="1.5" />
        <rect x={x + 12} y={y - 10} width={pill} height="20" rx="10" fill={colour} />
        <Text x={x + 12 + pill / 2} y={y + 0.5} colour="#ffffff" size={11}>
          {title}
        </Text>
      </g>
    )
  }
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="14" fill={wash(colour, 0.14)} />
      <Text x={x + 14} y={y + 18} anchor="start" colour={shade(colour)} size={13} weight={700}>
        {title}
      </Text>
    </g>
  )
}

/** Where a panel's contents sit (under its header or title). */
function contentMiddle(box: Box, look: PanelLook) {
  const top = look === 'bar' ? 26 : look === 'soft' ? 30 : 6
  return { x: box.x + box.w / 2, y: box.y + top + (box.h - top) / 2 }
}

/* ---------- What sits between the two sides ---------- */

function VsBadge({ cx, cy, colour = BLUE }: { cx: number; cy: number; colour?: string }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r="15" fill="#ffffff" stroke={colour} strokeWidth="1.5" />
      <Text x={cx} y={cy + 0.5} colour={colour} size={12} weight={700} italic>
        vs
      </Text>
    </g>
  )
}

/** A fat block arrow pointing right, its middle at (cx, cy). */
function BlockArrow({ cx, cy, w, colour = BLUE }: { cx: number; cy: number; w: number; colour?: string }) {
  const shaft = 12
  const head = 30
  const neck = cx + w / 2 - 18
  const l = cx - w / 2
  const r = cx + w / 2
  return <path d={`M ${l} ${cy - shaft / 2} H ${neck} V ${cy - head / 2} L ${r} ${cy} L ${neck} ${cy + head / 2} V ${cy + shaft / 2} H ${l} Z`} fill={colour} strokeLinejoin="round" />
}

/** A long thin arrow with an optional label above it. */
function LabelledArrow({ x1, x2, y, label, colour = INK }: { x1: number; x2: number; y: number; label?: string; colour?: string }) {
  return (
    <g>
      <line x1={x1} y1={y} x2={x2 - 9} y2={y} stroke={colour} strokeWidth="2" strokeLinecap="round" />
      <path d={`M ${x2} ${y} L ${x2 - 10} ${y - 5.5} L ${x2 - 10} ${y + 5.5} Z`} fill={colour} />
      {label && (
        <Text x={(x1 + x2) / 2} y={y - 13} size={11} weight={500} colour={colour}>
          {label}
        </Text>
      )}
    </g>
  )
}

/* ---------- The three versions, each drawing both blocks ---------- */

type Kind = 'vs' | 'arrow'
type Side = { title: string; cell: Cell }
type Pair = [Side, Side]

const FILLED: Record<Kind, Pair> = {
  vs: [
    { title: 'Control', cell: 'tcell' },
    { title: 'Treatment', cell: 'activated' },
  ],
  arrow: [
    { title: 'Before', cell: 'monocyte' },
    { title: 'After', cell: 'dendritic' },
  ],
}
const EMPTY: Record<Kind, Pair> = {
  vs: [
    { title: 'Control', cell: 'space' },
    { title: 'Treatment', cell: 'space' },
  ],
  arrow: [
    { title: 'Before', cell: 'space' },
    { title: 'After', cell: 'space' },
  ],
}

type DrawOptions = { kind: Kind; sides: Pair; panel?: { w: number; h: number }; selected?: boolean; resizing?: boolean }
type Drawn = { width: number; height: number; body: ReactNode; sides: [Box, Box] }
type Version = (o: DrawOptions) => Drawn

const PANEL = { w: 150, h: 128 }
const ICON = 64

/** A · Twin panels: two Header bar panels in blue, a vs badge or block arrow in the gap. */
const twinPanels: Version = ({ kind, sides, panel = PANEL }) => {
  const gap = kind === 'vs' ? 44 : 64
  const pad = 2
  const a: Box = { x: pad, y: pad, w: panel.w, h: panel.h }
  const b: Box = { x: pad + panel.w + gap, y: pad, w: panel.w, h: panel.h }
  const midY = contentMiddle(a, 'bar').y
  const between = pad + panel.w + gap / 2
  return {
    width: b.x + b.w + pad,
    height: panel.h + 2 * pad,
    sides: [a, b],
    body: (
      <>
        {[a, b].map((box, i) => (
          <g key={i}>
            <Panel box={box} look="bar" colour={BLUE} title={sides[i].title} />
            <CellArt cell={sides[i].cell} {...{ cx: contentMiddle(box, 'bar').x, cy: midY }} size={ICON} />
          </g>
        ))}
        {kind === 'vs' ? <VsBadge cx={between} cy={midY} /> : <BlockArrow cx={between} cy={midY} w={gap - 16} />}
      </>
    ),
  }
}

/** B · Paired colours: grey and blue sides; a thin vs divider, or a long arrow with what happened written on it. */
const pairedColours: Version = ({ kind, sides, panel = PANEL }) => {
  const look: PanelLook = kind === 'vs' ? 'tab' : 'soft'
  const gap = kind === 'vs' ? 36 : 96
  const top = kind === 'vs' ? 12 : 2
  const pad = 2
  const a: Box = { x: pad, y: top, w: panel.w, h: panel.h }
  const b: Box = { x: pad + panel.w + gap, y: top, w: panel.w, h: panel.h }
  const colours = [GREY, BLUE]
  const midY = contentMiddle(a, look).y
  const between = pad + panel.w + gap / 2
  return {
    width: b.x + b.w + pad,
    height: top + panel.h + pad,
    sides: [a, b],
    body: (
      <>
        {[a, b].map((box, i) => (
          <g key={i}>
            <Panel box={box} look={look} colour={colours[i]} title={sides[i].title} />
            <CellArt cell={sides[i].cell} cx={contentMiddle(box, look).x} cy={midY} size={ICON} colour={colours[i]} />
          </g>
        ))}
        {kind === 'vs' ? (
          <g>
            <line x1={between} y1={top + 8} x2={between} y2={midY - 14} stroke="#a1a1aa" strokeWidth="1.25" strokeDasharray="3 3" />
            <line x1={between} y1={midY + 14} x2={between} y2={top + panel.h - 8} stroke="#a1a1aa" strokeWidth="1.25" strokeDasharray="3 3" />
            <Text x={between} y={midY} colour={GREY} size={13} weight={600} italic>
              vs
            </Text>
          </g>
        ) : (
          <LabelledArrow x1={pad + panel.w + 12} x2={b.x - 12} y={midY} label="+ LPS, 24 h" />
        )}
      </>
    ),
  }
}

/** C · Split frame: one outlined frame cut in two, a vs pill on the straight divider, or a chevron divider pointing to After. */
const splitFrame: Version = ({ kind, sides, panel = PANEL }) => {
  const pad = 2
  const w = panel.w * 2 + 8
  const h = panel.h
  const x = pad
  const y = pad
  const mid = x + w / 2
  const midY = y + 26 + (h - 26) / 2
  const point = 16
  const halves: [Box, Box] = [
    { x, y, w: w / 2, h },
    { x: mid, y, w: w / 2, h },
  ]
  return {
    width: w + 2 * pad,
    height: h + 2 * pad,
    sides: halves,
    body: (
      <>
        <rect x={x} y={y} width={w} height={h} rx="10" fill="#ffffff" stroke={BLUE} strokeWidth="1.5" />
        {kind === 'arrow' ? (
          <>
            {/* After half tinted, the divider a chevron pointing into it. */}
            <path d={`M ${mid - point / 2} ${y} H ${x + w - 10} Q ${x + w} ${y} ${x + w} ${y + 10} V ${y + h - 10} Q ${x + w} ${y + h} ${x + w - 10} ${y + h} H ${mid - point / 2} L ${mid + point / 2} ${y + h / 2} Z`} fill={wash(BLUE, 0.1)} />
            <path d={`M ${mid - point / 2} ${y} L ${mid + point / 2} ${y + h / 2} L ${mid - point / 2} ${y + h}`} fill="none" stroke={BLUE} strokeWidth="1.5" strokeLinejoin="round" />
          </>
        ) : (
          <>
            <line x1={mid} y1={y} x2={mid} y2={y + h} stroke={BLUE} strokeWidth="1.5" />
            <rect x={mid - 15} y={midY - 10} width="30" height="20" rx="10" fill={BLUE} />
            <Text x={mid} y={midY + 0.5} colour="#ffffff" size={11} weight={700} italic>
              vs
            </Text>
          </>
        )}
        {halves.map((half, i) => (
          <g key={i}>
            <Text x={half.x + half.w / 2 + (kind === 'arrow' && i === 1 ? point / 2 : 0)} y={y + 16} colour={shade(BLUE, 0.85)} size={10} weight={700} upper>
              {sides[i].title}
            </Text>
            <CellArt cell={sides[i].cell} cx={half.x + half.w / 2 + (kind === 'arrow' ? (i === 1 ? point / 2 : -point / 4) : 0)} cy={midY + 4} size={ICON} />
          </g>
        ))}
      </>
    ),
  }
}

/* ---------- Showing a block ---------- */

/** Resize handles on a box: the eight squares Fabric draws. */
function Handles({ box }: { box: Box }) {
  const points = [
    [0, 0],
    [0.5, 0],
    [1, 0],
    [1, 0.5],
    [1, 1],
    [0.5, 1],
    [0, 1],
    [0, 0.5],
  ]
  return (
    <g>
      <rect x={box.x - 3} y={box.y - 3} width={box.w + 6} height={box.h + 6} fill="none" stroke={SELECT} strokeWidth="1" />
      {points.map(([px, py], i) => (
        <rect key={i} x={box.x - 3 + (box.w + 6) * px - 4} y={box.y - 3 + (box.h + 6) * py - 4} width="8" height="8" rx="1.5" fill="#ffffff" stroke={SELECT} strokeWidth="1" />
      ))}
    </g>
  )
}

function Block({ version, kind, sides, panel, selected, resizing }: DrawOptions & { version: Version }) {
  const d = version({ kind, sides, panel })
  const margin = 8
  const whole: Box = { x: 0, y: 0, w: d.width, h: d.height }
  return (
    <svg width={d.width + 2 * margin} height={d.height + 2 * margin} viewBox={`${-margin} ${-margin} ${d.width + 2 * margin} ${d.height + 2 * margin}`} aria-hidden="true" className="overflow-visible">
      {d.body}
      {selected && !resizing && <Handles box={whole} />}
      {resizing && (
        <>
          {/* The side being dragged has its handles; the other follows, ringed dotted. */}
          <Handles box={d.sides[1]} />
          <rect x={d.sides[0].x - 3} y={d.sides[0].y - 3} width={d.sides[0].w + 6} height={d.sides[0].h + 6} fill="none" stroke={SELECT} strokeWidth="1" strokeDasharray="3 3" />
          <g transform={`translate(${d.sides[1].x + d.sides[1].w + 3} ${d.sides[1].y + d.sides[1].h + 3})`}>
            <path d="M 2 2 l 10 10 m 0 0 v -6 m 0 6 h -6" stroke={SELECT} strokeWidth="1.5" fill="none" strokeLinecap="round" />
          </g>
        </>
      )}
    </svg>
  )
}

const LOCK: QuickAction = { id: 'lock', label: 'Lock', icon: Lock, onClick: noop }
const MORE: QuickAction = { id: 'more', label: 'More actions', icon: MoreHorizontal, onClick: noop }

function comparisonBar() {
  const own: QuickAction[] = [
    { id: 'swap', label: 'Swap sides', icon: ArrowLeftRight, onClick: noop },
    { id: 'detach', label: 'Detach', icon: Unlink, onClick: noop },
  ]
  const groups: QuickActionGroup[] = [{ id: 'own', actions: own }, { id: 'lock', actions: [LOCK] }, { id: 'more', actions: [MORE] }]
  return <QuickActions label="Comparison actions" groups={groups} showLabels />
}

/** A grey stretch of canvas holding a white page. */
function Canvas({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-col items-center justify-center gap-3 rounded-lg bg-neutral-100 p-5 dark:bg-neutral-800', className)}>{children}</div>
}

function Page({ children }: { children: ReactNode }) {
  return <div className="rounded-sm bg-white p-4 shadow-sm">{children}</div>
}

/** The card's picture: the block with empty spaces, scaled to a 3:2 card. */
function CardPicture({ version, kind }: { version: Version; kind: Kind }) {
  const d = version({ kind, sides: EMPTY[kind] })
  return (
    <svg viewBox={`-4 -14 ${d.width + 8} ${d.height + 18}`} width="100%" height="100%" aria-hidden="true">
      {d.body}
    </svg>
  )
}

/** The Blocks tool's new Comparisons section with the two cards. */
function BlocksSection({ version }: { version: Version }) {
  return (
    <div className="w-[260px] rounded-lg border bg-panel p-3">
      <h3 className="pb-2 text-xs font-medium text-muted-foreground">Comparisons</h3>
      <div className="grid grid-cols-2 gap-2">
        {(['vs', 'arrow'] as const).map((kind) => (
          <div key={kind} className="flex flex-col gap-1.5 rounded-md border border-border-strong bg-panel p-1.5 text-muted-foreground">
            <span className="flex aspect-[3/2] w-full items-center justify-center overflow-hidden rounded-sm bg-white p-1.5">
              <CardPicture version={version} kind={kind} />
            </span>
            <span className="text-xs leading-tight">{kind === 'vs' ? 'Control vs Treatment' : 'Before / After'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Draft({ letter, title, about, version }: { letter: string; title: string; about: ReactNode; version: Version }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-panel p-5">
      <header>
        <h2 className="text-base font-semibold">
          {letter} · {title}
        </h2>
        <p className="mt-1 max-w-[760px] text-xs text-muted-foreground">{about}</p>
      </header>
      <div className="flex flex-wrap items-stretch gap-5">
        <div className="flex flex-col gap-2">
          <div className="section-label">On the page</div>
          <Canvas className="min-h-[360px]">
            <Page>
              <div className="flex flex-col gap-6">
                <Block version={version} kind="vs" sides={FILLED.vs} />
                <Block version={version} kind="arrow" sides={FILLED.arrow} />
              </div>
            </Page>
          </Canvas>
        </div>
        <div className="flex flex-col gap-2">
          <div className="section-label">Selected</div>
          <Canvas className="min-h-[360px]">
            {comparisonBar()}
            <Page>
              <Block version={version} kind="vs" sides={FILLED.vs} selected />
            </Page>
          </Canvas>
        </div>
        <div className="flex flex-col gap-2">
          <div className="section-label">Resizing Treatment: Control grows with it</div>
          <Canvas className="min-h-[360px]">
            <Page>
              <Block version={version} kind="vs" sides={FILLED.vs} panel={{ w: 180, h: 150 }} resizing />
            </Page>
          </Canvas>
        </div>
        <div className="flex flex-col gap-2">
          <div className="section-label">Blocks tool</div>
          <Canvas className="min-h-[360px]">
            <BlocksSection version={version} />
          </Canvas>
        </div>
      </div>
    </section>
  )
}

export const Versions: Story = {
  render: () => (
    <div className="flex flex-col gap-6 bg-background p-6 text-foreground">
      <p className="max-w-[780px] text-sm text-muted-foreground">
        Two comparison blocks for a new <b>Comparisons</b> section in the Blocks tool: <b>Control vs Treatment</b> (here, resting T cells next to activated ones) and <b>Before / After</b> (a monocyte that becomes a dendritic cell). Both
        sides always stay the same size: resizing one resizes the other, and the gap between them stays. Each side starts with an empty icon space, like the panels and sequences. Selected, the bar has Swap sides and Detach. Titles are
        typed over, so either block also works for “Wild type vs Knockout” or “Day 0 / Day 7”.
      </p>
      <Draft
        letter="A"
        title="Twin panels"
        version={twinPanels}
        about="Two of the existing Header bar panels in the panels' blue, side by side. A round “vs” badge sits in the gap for Control vs Treatment; a fat block arrow for Before / After. The closest to what's already in the editor: each side can switch to any panel look and colour, both together."
      />
      <Draft
        letter="B"
        title="Paired colours"
        version={pairedColours}
        about="The sides tell themselves apart by colour: grey for Control and Before, blue for Treatment and After. Control vs Treatment uses Title tab panels with a light dashed divider and “vs”; Before / After uses Soft area panels and a long thin arrow that carries a label for what happened in between (“+ LPS, 24 h”), which you can type over or remove."
      />
      <Draft
        letter="C"
        title="Split frame"
        version={splitFrame}
        about="One outlined frame cut in two, so the pair reads as one figure piece. A straight divider with a blue “vs” pill for Control vs Treatment; for Before / After the divider is a chevron pointing into the After half, which is lightly tinted. Small capital labels at the top of each half. The most compact."
      />
    </div>
  ),
}
