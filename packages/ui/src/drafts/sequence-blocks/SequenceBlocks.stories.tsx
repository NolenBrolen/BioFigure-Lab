/*
 * BIO-75 design drafts: sequence blocks (a row of steps with even gaps and
 * arrows between them). Visual drafts only: no tests, no accessibility pass,
 * nothing wired up.
 *
 *   Looks      four looks for a sequence, each across and down, on the page
 *              and selected (quick-actions bar and the "+" that adds a step)
 *   Make a row two ways to turn three or more selected objects into a row
 *
 * The cells are simple drawings in the app's colour-blind-safe colours,
 * standing in for library icons (icons never go into packages/ui).
 */
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ArrowDown, ArrowRight, Group, Lock, MoreHorizontal, Plus, Unlink, createLucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { QuickActions, type QuickAction, type QuickActionGroup } from '../../components/quick-actions/QuickActions'
import { cn } from '../../lib/cn'

const meta = {
  title: 'Drafts/BIO-75 Sequence blocks',
  parameters: { controls: { disable: true }, layout: 'fullscreen' },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const noop = () => undefined
const BLUE = '#2563eb' // selection blue
const INK = '#27272a'
const FONT = 'Inter, system-ui, sans-serif'

/* ---------- The cells (64 × 64 drawings) ---------- */

type Cell = 'monocyte' | 'dendritic' | 'tcell'

function CellArt({ cell, x, y, size }: { cell: Cell; x: number; y: number; size: number }) {
  const k = size / 64
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`}>
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
      {cell === 'tcell' && (
        <>
          <circle cx="32" cy="32" r="24" fill="#d4ebf7" stroke="#0072b2" strokeWidth="2.5" />
          <circle cx="33" cy="31" r="16" fill="#56b4e9" fillOpacity="0.85" />
          <circle cx="28" cy="27" r="3" fill="#0072b2" fillOpacity="0.5" />
        </>
      )}
    </g>
  )
}

type Step = { cell: Cell; label: string }
const STEPS: Step[] = [
  { cell: 'monocyte', label: 'Day 0' },
  { cell: 'dendritic', label: 'Day 5' },
  { cell: 'tcell', label: 'Day 7' },
]

/* ---------- Pieces every look uses ---------- */

const ICON = 56

/** An arrow from (x1, y1) to (x2, y2) with a filled head. */
function Arrow({ x1, y1, x2, y2, colour = INK, width = 2 }: { x1: number; y1: number; x2: number; y2: number; colour?: string; width?: number }) {
  const angle = Math.atan2(y2 - y1, x2 - x1)
  const head = 8
  const back = { x: x2 - head * Math.cos(angle), y: y2 - head * Math.sin(angle) }
  const side = (turn: number) => `${x2 - head * Math.cos(angle + turn)} ${y2 - head * Math.sin(angle + turn)}`
  return (
    <g>
      <line x1={x1} y1={y1} x2={back.x} y2={back.y} stroke={colour} strokeWidth={width} strokeLinecap="round" />
      <path d={`M ${x2} ${y2} L ${side(0.45)} L ${side(-0.45)} Z`} fill={colour} />
    </g>
  )
}

function Label({ x, y, children, anchor = 'middle', weight = 500, colour = INK, size = 11 }: { x: number; y: number; children: ReactNode; anchor?: 'start' | 'middle'; weight?: number; colour?: string; size?: number }) {
  return (
    <text x={x} y={y} textAnchor={anchor} dominantBaseline="middle" fontFamily={FONT} fontSize={size} fontWeight={weight} fill={colour}>
      {children}
    </text>
  )
}

/** The round "+" that adds a step, at the end of a selected sequence. */
function AddStep({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r="11" fill="#ffffff" stroke={BLUE} strokeWidth="1.5" />
      <path d={`M ${x - 5} ${y} H ${x + 5} M ${x} ${y - 5} V ${y + 5}`} stroke={BLUE} strokeWidth="1.75" strokeLinecap="round" />
    </g>
  )
}

type Dir = 'across' | 'down'
type Drawn = { width: number; height: number; body: ReactNode; plus: { x: number; y: number } }

/* ---------- A · Arrows: icons, plain arrows between, labels under ---------- */

function drawArrows(dir: Dir, steps: Step[]): Drawn {
  const pad = 12
  if (dir === 'across') {
    const gap = 52
    const x = (i: number) => pad + i * (ICON + gap)
    const mid = pad + ICON / 2
    return {
      width: x(steps.length - 1) + ICON + pad,
      height: pad + ICON + 30,
      plus: { x: x(steps.length - 1) + ICON + gap / 2 + 4, y: mid },
      body: steps.map((s, i) => (
        <g key={i}>
          <CellArt cell={s.cell} x={x(i)} y={pad} size={ICON} />
          <Label x={x(i) + ICON / 2} y={pad + ICON + 16}>
            {s.label}
          </Label>
          {i < steps.length - 1 && <Arrow x1={x(i) + ICON + 10} y1={mid} x2={x(i + 1) - 10} y2={mid} />}
        </g>
      )),
    }
  }
  const gap = 40
  const y = (i: number) => pad + i * (ICON + gap)
  const mid = pad + ICON / 2
  return {
    width: pad + ICON + 60,
    height: y(steps.length - 1) + ICON + pad,
    plus: { x: mid, y: y(steps.length - 1) + ICON + gap / 2 + 4 },
    body: steps.map((s, i) => (
      <g key={i}>
        <CellArt cell={s.cell} x={pad} y={y(i)} size={ICON} />
        <Label x={pad + ICON + 12} y={y(i) + ICON / 2} anchor="start">
          {s.label}
        </Label>
        {i < steps.length - 1 && <Arrow x1={mid} y1={y(i) + ICON + 6} x2={mid} y2={y(i + 1) - 6} />}
      </g>
    )),
  }
}

/* ---------- B · Timeline: one line with a dot per step, no arrows between ---------- */

function drawTimeline(dir: Dir, steps: Step[]): Drawn {
  const pad = 12
  const line = '#0072b2'
  const dot = (cx: number, cy: number, key: number) => <circle key={key} cx={cx} cy={cy} r="5" fill="#ffffff" stroke={line} strokeWidth="2.5" />
  if (dir === 'across') {
    const gap = 40
    const x = (i: number) => pad + 8 + i * (ICON + gap)
    const lineY = pad + ICON + 14
    const end = x(steps.length - 1) + ICON + 22
    return {
      width: end + pad,
      height: lineY + 34,
      plus: { x: end + 22, y: lineY },
      body: (
        <>
          <Arrow x1={pad} y1={lineY} x2={end} y2={lineY} colour={line} width={3} />
          {steps.map((s, i) => (
            <g key={i}>
              <CellArt cell={s.cell} x={x(i)} y={pad} size={ICON} />
              {dot(x(i) + ICON / 2, lineY, i)}
              <Label x={x(i) + ICON / 2} y={lineY + 20} weight={600} colour={line}>
                {s.label}
              </Label>
            </g>
          ))}
        </>
      ),
    }
  }
  const gap = 24
  const y = (i: number) => pad + 8 + i * (ICON + gap)
  const lineX = pad + 6
  const end = y(steps.length - 1) + ICON + 18
  return {
    width: lineX + 30 + ICON + 60,
    height: end + pad,
    plus: { x: lineX, y: end + 22 },
    body: (
      <>
        <Arrow x1={lineX} y1={pad} x2={lineX} y2={end} colour={line} width={3} />
        {steps.map((s, i) => (
          <g key={i}>
            {dot(lineX, y(i) + ICON / 2, i)}
            <Label x={lineX + 16} y={y(i) + ICON / 2} anchor="start" weight={600} colour={line}>
              {s.label}
            </Label>
            <CellArt cell={s.cell} x={lineX + 60} y={y(i)} size={ICON} />
          </g>
        ))}
      </>
    ),
  }
}

/* ---------- C · Step cards: each step in a card with its number, chevrons between ---------- */

function drawCards(dir: Dir, steps: Step[]): Drawn {
  const pad = 14
  const w = ICON + 28
  const h = ICON + 46
  const colour = '#0072b2'
  const card = (cx: number, cy: number, i: number, s: Step) => (
    <g key={i}>
      <rect x={cx} y={cy} width={w} height={h} rx="10" fill="#eef6fb" stroke={colour} strokeOpacity="0.45" strokeWidth="1" />
      <CellArt cell={s.cell} x={cx + 14} y={cy + 12} size={ICON} />
      <Label x={cx + w / 2} y={cy + h - 15}>
        {s.label}
      </Label>
      <circle cx={cx + 2} cy={cy + 2} r="10" fill={colour} />
      <Label x={cx + 2} y={cy + 2.5} weight={700} colour="#ffffff" size={10}>
        {i + 1}
      </Label>
    </g>
  )
  const chevron = (cx: number, cy: number, down: boolean, key: number) => (
    <path key={key} d={down ? `M ${cx - 9} ${cy - 4} L ${cx} ${cy + 5} L ${cx + 9} ${cy - 4}` : `M ${cx - 4} ${cy - 9} L ${cx + 5} ${cy} L ${cx - 4} ${cy + 9}`} fill="none" stroke={colour} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  )
  const gap = 30
  if (dir === 'across') {
    const x = (i: number) => pad + i * (w + gap)
    return {
      width: x(steps.length - 1) + w + pad,
      height: h + 2 * pad,
      plus: { x: x(steps.length - 1) + w + gap / 2 + 4, y: pad + h / 2 },
      body: steps.map((s, i) => (
        <g key={i}>
          {card(x(i), pad, i, s)}
          {i < steps.length - 1 && chevron(x(i) + w + gap / 2, pad + h / 2, false, i)}
        </g>
      )),
    }
  }
  const y = (i: number) => pad + i * (h + gap)
  return {
    width: w + 2 * pad,
    height: y(steps.length - 1) + h + pad,
    plus: { x: pad + w / 2, y: y(steps.length - 1) + h + gap / 2 + 4 },
    body: steps.map((s, i) => (
      <g key={i}>
        {card(pad, y(i), i, s)}
        {i < steps.length - 1 && chevron(pad + w / 2, y(i) + h + gap / 2, true, i)}
      </g>
    )),
  }
}

/* ---------- D · Ribbon: one process ribbon of chevron segments, getting darker ---------- */

const RIBBON = ['#e3f0f8', '#c6e0f1', '#a3cde9', '#7fb9e0']

function drawRibbon(dir: Dir, steps: Step[]): Drawn {
  const pad = 10
  const point = 16
  if (dir === 'across') {
    const w = ICON + 40
    const h = ICON + 40
    const x = (i: number) => pad + i * (w + 4)
    const segment = (i: number) => {
      const x0 = x(i)
      const notch = i > 0 ? `L ${x0 + point} ${pad + h / 2}` : ''
      return `M ${x0} ${pad} L ${x0 + w} ${pad} L ${x0 + w + point} ${pad + h / 2} L ${x0 + w} ${pad + h} L ${x0} ${pad + h} ${notch} Z`
    }
    return {
      width: x(steps.length - 1) + w + point + pad,
      height: h + 2 * pad,
      plus: { x: x(steps.length - 1) + w + point + 26, y: pad + h / 2 },
      body: steps.map((s, i) => (
        <g key={i}>
          <path d={segment(i)} fill={RIBBON[i % RIBBON.length]} />
          <CellArt cell={s.cell} x={x(i) + (w - ICON) / 2 + (i > 0 ? point / 2 : 0)} y={pad + 6} size={ICON - 8} />
          <Label x={x(i) + w / 2 + (i > 0 ? point / 2 : 0)} y={pad + h - 15} weight={600} colour="#0b3d5c">
            {s.label}
          </Label>
        </g>
      )),
    }
  }
  const w = ICON + 104
  const h = ICON + 16
  const y = (i: number) => pad + i * (h + 4)
  const segment = (i: number) => {
    const y0 = y(i)
    const notch = i > 0 ? `L ${pad + w / 2} ${y0 + point}` : ''
    return `M ${pad} ${y0} ${notch} L ${pad + w} ${y0} L ${pad + w} ${y0 + h} L ${pad + w / 2} ${y0 + h + point} L ${pad} ${y0 + h} Z`
  }
  return {
    width: w + 2 * pad,
    height: y(steps.length - 1) + h + point + pad,
    plus: { x: pad + w / 2, y: y(steps.length - 1) + h + point + 26 },
    body: steps.map((s, i) => (
      <g key={i}>
        <path d={segment(i)} fill={RIBBON[i % RIBBON.length]} />
        <CellArt cell={s.cell} x={pad + 16} y={y(i) + 8 + (i > 0 ? 6 : 0)} size={ICON - 8} />
        <Label x={pad + ICON + 24} y={y(i) + h / 2 + (i > 0 ? 6 : 0)} anchor="start" weight={600} colour="#0b3d5c">
          {s.label}
        </Label>
      </g>
    )),
  }
}

/* ---------- Showing a sequence ---------- */

type Look = (dir: Dir, steps: Step[]) => Drawn

/** A sequence drawn on a piece of white page, optionally selected (blue outline and the "+"). */
function Sequence({ look, dir, selected = false, steps = STEPS }: { look: Look; dir: Dir; selected?: boolean; steps?: Step[] }) {
  const d = look(dir, steps)
  const room = selected ? 40 : 0
  const width = d.width + (dir === 'across' ? room : 0)
  const height = d.height + (dir === 'down' ? room : 0)
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className="overflow-visible">
      {d.body}
      {selected && (
        <>
          <rect x="1" y="1" width={d.width - 2} height={d.height - 2} fill="none" stroke={BLUE} strokeWidth="1" />
          <AddStep x={d.plus.x} y={d.plus.y} />
        </>
      )}
    </svg>
  )
}

const LOCK: QuickAction = { id: 'lock', label: 'Lock', icon: Lock, onClick: noop }
const MORE: QuickAction = { id: 'more', label: 'More actions', icon: MoreHorizontal, onClick: noop }

function sequenceBar(dir: Dir) {
  const own: QuickAction[] = [
    { id: 'add', label: 'Add step', icon: Plus, onClick: noop },
    { id: 'dir', label: dir === 'across' ? 'Across' : 'Down', icon: dir === 'across' ? ArrowRight : ArrowDown, onClick: noop },
    { id: 'detach', label: 'Detach', icon: Unlink, onClick: noop },
  ]
  const groups: QuickActionGroup[] = [{ id: 'own', actions: own }, { id: 'lock', actions: [LOCK] }, { id: 'more', actions: [MORE] }]
  return <QuickActions label="Sequence actions" groups={groups} showLabels />
}

/** A grey stretch of canvas holding a white page. */
function Canvas({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 rounded-lg bg-neutral-100 p-5 dark:bg-neutral-800', className)}>
      {children}
    </div>
  )
}

function Page({ children }: { children: ReactNode }) {
  return <div className="rounded-sm bg-white p-5 shadow-sm">{children}</div>
}

function LookDraft({ letter, title, about, look }: { letter: string; title: string; about: string; look: Look }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-panel p-5">
      <header>
        <h2 className="text-base font-semibold">
          {letter} · {title}
        </h2>
        <p className="mt-1 max-w-[720px] text-xs text-muted-foreground">{about}</p>
      </header>
      <div className="flex flex-wrap items-stretch gap-5">
        <div className="flex flex-col gap-2">
          <div className="section-label">On the page</div>
          <Canvas className="min-h-[300px]">
            <Page>
              <Sequence look={look} dir="across" />
            </Page>
          </Canvas>
        </div>
        <div className="flex flex-col gap-2">
          <div className="section-label">Selected</div>
          <Canvas className="min-h-[300px]">
            {sequenceBar('across')}
            <Page>
              <Sequence look={look} dir="across" selected />
            </Page>
          </Canvas>
        </div>
        <div className="flex flex-col gap-2">
          <div className="section-label">Down</div>
          <Canvas>
            <Page>
              <Sequence look={look} dir="down" />
            </Page>
          </Canvas>
        </div>
      </div>
    </section>
  )
}

export const Looks: Story = {
  render: () => (
    <div className="flex flex-col gap-6 bg-background p-6 text-foreground">
      <p className="max-w-[760px] text-sm text-muted-foreground">
        Four looks for a sequence block. Each step holds an icon (here, monocytes becoming dendritic cells that then prime T cells) and an optional label. Selected, the bar has Add step, Across/Down and Detach, and a “+” at the end
        of the row adds a step too. The gaps stay even whatever you put in the steps.
      </p>
      <LookDraft letter="A" title="Arrows" look={drawArrows} about="The plainest: the icons with a black arrow in each gap and the label under each icon. Closest to what people draw by hand today." />
      <LookDraft letter="B" title="Timeline" look={drawTimeline} about="One blue line with an arrowhead runs under the steps, a dot marks each one and the label sits under its dot. No arrows between the icons, so it reads as time passing." />
      <LookDraft letter="C" title="Step cards" look={drawCards} about="Each step sits in a pale card with its number in the corner, blue chevrons between. Reads as a protocol: step 1, 2, 3." />
      <LookDraft letter="D" title="Ribbon" look={drawRibbon} about="The steps share one ribbon of arrow-shaped pieces that get darker towards the end, the label inside each piece. The boldest; good as a figure's top strip." />
    </div>
  ),
}

/* ---------- Make a row ---------- */

/** Three square boxes in a row: the Make row button. */
const RowIcon = createLucideIcon('row-of-three', [
  ['rect', { x: '2', y: '8', width: '5', height: '8', rx: '1', key: 'a' }],
  ['rect', { x: '9.5', y: '8', width: '5', height: '8', rx: '1', key: 'b' }],
  ['rect', { x: '17', y: '8', width: '5', height: '8', rx: '1', key: 'c' }],
])

/** The three cells lying loose on the page, as picked with Shift. */
function Loose() {
  const spots: { cell: Cell; x: number; y: number; size: number }[] = [
    { cell: 'monocyte', x: 6, y: 34, size: 52 },
    { cell: 'dendritic', x: 92, y: 4, size: 60 },
    { cell: 'tcell', x: 168, y: 46, size: 48 },
  ]
  return (
    <svg width="230" height="112" viewBox="0 0 230 112" aria-hidden="true" className="overflow-visible">
      {spots.map((s, i) => (
        <g key={i}>
          <CellArt cell={s.cell} x={s.x} y={s.y} size={s.size} />
          <rect x={s.x - 2} y={s.y - 2} width={s.size + 4} height={s.size + 4} fill="none" stroke={BLUE} strokeWidth="1" />
        </g>
      ))}
      <rect x="1" y="1" width="228" height="108" fill="none" stroke={BLUE} strokeWidth="1" strokeDasharray="4 3" />
    </svg>
  )
}

function severalBar(row: QuickAction) {
  const groups: QuickActionGroup[] = [{ id: 'own', actions: [{ id: 'group', label: 'Group', icon: Group, onClick: noop }, row] }, { id: 'lock', actions: [LOCK] }, { id: 'more', actions: [MORE] }]
  return <QuickActions label="Selection actions" groups={groups} showLabels />
}

/** A picture tile in a widget, like the Frame widget's. */
function Tile({ name, picked, children }: { name: string; picked?: boolean; children: ReactNode }) {
  return (
    <div className={cn('flex w-[104px] flex-col items-center gap-1 rounded-md border p-1.5 text-xs', picked ? 'border-[#2563eb] bg-blue-50 text-[#1d4ed8] dark:bg-blue-950' : 'border-border-strong')}>
      <span className="flex h-[58px] w-full items-center justify-center rounded-sm bg-white">{children}</span>
      {name}
    </div>
  )
}

const mini = (dir: Dir) => (
  <svg width={dir === 'across' ? 78 : 30} height={dir === 'across' ? 24 : 50} viewBox={dir === 'across' ? '0 0 78 24' : '0 0 30 50'} aria-hidden="true">
    {dir === 'across' ? (
      <>
        <circle cx="10" cy="12" r="8" fill="#f3dde9" stroke="#cc79a7" strokeWidth="1.5" />
        <Arrow x1={21} y1={12} x2={30} y2={12} width={1.5} />
        <circle cx="39" cy="12" r="8" fill="#fbe7c2" stroke="#e69f00" strokeWidth="1.5" />
        <Arrow x1={50} y1={12} x2={59} y2={12} width={1.5} />
        <circle cx="68" cy="12" r="8" fill="#d4ebf7" stroke="#0072b2" strokeWidth="1.5" />
      </>
    ) : (
      <>
        <circle cx="15" cy="7" r="6" fill="#f3dde9" stroke="#cc79a7" strokeWidth="1.5" />
        <Arrow x1={15} y1={15} x2={15} y2={20} width={1.5} />
        <circle cx="15" cy="27" r="6" fill="#fbe7c2" stroke="#e69f00" strokeWidth="1.5" />
        <Arrow x1={15} y1={35} x2={15} y2={40} width={1.5} />
        <circle cx="15" cy="45" r="5" fill="#d4ebf7" stroke="#0072b2" strokeWidth="1.5" />
      </>
    )}
  </svg>
)

function RowDraft({ letter, title, about, before, after }: { letter: string; title: string; about: string; before: ReactNode; after: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-panel p-5">
      <header>
        <h2 className="text-base font-semibold">
          {letter} · {title}
        </h2>
        <p className="mt-1 max-w-[720px] text-xs text-muted-foreground">{about}</p>
      </header>
      <div className="flex flex-wrap items-stretch gap-5">
        <div className="flex flex-col gap-2">
          <div className="section-label">Three cells picked</div>
          <Canvas className="min-h-[340px] w-[420px] justify-end">{before}</Canvas>
        </div>
        <div className="flex flex-col gap-2">
          <div className="section-label">After the click</div>
          <Canvas className="min-h-[340px] w-[460px] justify-end">{after}</Canvas>
        </div>
      </div>
    </section>
  )
}

function Toast({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg">
      {text}
      <span className="font-semibold text-[#2563eb]">Undo</span>
    </div>
  )
}

export const MakeARow: Story = {
  name: 'Make a row',
  render: () => (
    <div className="flex flex-col gap-6 bg-background p-6 text-foreground">
      <p className="max-w-[760px] text-sm text-muted-foreground">
        Pick three or more objects (Shift-click or drag a box) and turn them into a sequence in the look you picked above (A here). Their order is left to right as they lie on the page, or top to bottom for Down. The steps keep their own
        size; the row lines up their middles.
      </p>
      <RowDraft
        letter="1"
        title="One click"
        about="The bar for several objects gets a Row button next to Group. One click lines them up across with arrows, at once, with an Undo toast. Across/Down is then in the new sequence's own bar."
        before={
          <>
            {severalBar({ id: 'row', label: 'Row', icon: RowIcon, onClick: noop })}
            <div className="mt-4">
              <Page>
                <Loose />
              </Page>
            </div>
          </>
        }
        after={
          <>
            {sequenceBar('across')}
            <Page>
              <Sequence look={drawArrows} dir="across" selected />
            </Page>
            <Toast text="Made a row of 3" />
          </>
        }
      />
      <RowDraft
        letter="2"
        title="Row widget"
        about="The Row button opens a small widget with two pictures, Across and Down. Picking one makes the row and closes the widget, like Frame does for icons."
        before={
          <>
            <div className="rounded-lg border bg-popover p-2 text-popover-foreground shadow-lg">
              <div className="section-label px-1 pb-1.5">Make a row</div>
              <div className="flex gap-2">
                <Tile name="Across" picked>
                  {mini('across')}
                </Tile>
                <Tile name="Down">{mini('down')}</Tile>
              </div>
            </div>
            {severalBar({ id: 'row', label: 'Row', icon: RowIcon, onClick: noop })}
            <div className="mt-4">
              <Page>
                <Loose />
              </Page>
            </div>
          </>
        }
        after={
          <>
            {sequenceBar('across')}
            <Page>
              <Sequence look={drawArrows} dir="across" selected />
            </Page>
          </>
        }
      />
    </div>
  ),
}
