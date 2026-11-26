/*
 * BIO-96 design drafts: process blocks. Three new blocks, three versions each:
 *
 *   Experiment timeline  a real day axis with dosing, sampling and the endpoint placed by day
 *   Cycle                steps evenly round a circle with curved arrows
 *   Branching            one step splitting into 2-3 arms (treatment groups)
 *
 * Visual drafts only: no tests, no accessibility pass, nothing wired up.
 * The pictures are simple drawings in the app's colour-blind-safe colours,
 * standing in for library icons (icons never go into packages/ui).
 */
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Lock, MoreHorizontal, Plus, Unlink } from 'lucide-react'
import type { ReactNode } from 'react'

import { QuickActions, type QuickAction, type QuickActionGroup } from '../../components/quick-actions/QuickActions'
import { cn } from '../../lib/cn'

const meta = {
  title: 'Drafts/BIO-96 Process blocks',
  parameters: { controls: { disable: true }, layout: 'fullscreen' },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const noop = () => undefined
const SELECT = '#2563eb' // selection blue
const BLOCK = '#0072b2' // the blocks' blue
const INK = '#27272a'
const MUTED = '#71717a'
const FONT = 'Inter, system-ui, sans-serif'
const ORANGE = '#e69f00'
const VERMILLION = '#d55e00'
const SKY = '#56b4e9'
const PALE = '#eef5fa'
const SHADES = ['#9cc7e2', '#5aa2cf', '#2f86c0', '#0072b2', '#005a8e']
const shadeAt = (i: number) => SHADES.at(i % SHADES.length) ?? BLOCK
const darkText = (colour: string) => colour === '#9cc7e2'

/* ---------- Drawings (64 × 64), standing in for icons ---------- */

type Art = 'mouse' | 'syringe' | 'drop' | 'tube' | 'g1' | 's' | 'g2' | 'm' | 'space'

function Drawing({ art, x, y, size, tag }: { art: Art; x: number; y: number; size: number; tag?: string }) {
  const k = size / 64
  const fur = '#8a8088'
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`}>
      {art === 'mouse' && (
        <>
          <path d="M50 42 C60 42 62 52 55 56" fill="none" stroke={fur} strokeWidth="2.5" strokeLinecap="round" />
          <ellipse cx="36" cy="40" rx="18" ry="13" fill="#ece7ea" stroke={fur} strokeWidth="2.5" />
          <ellipse cx="17" cy="36" rx="11" ry="9" fill="#ece7ea" stroke={fur} strokeWidth="2.5" />
          <circle cx="20" cy="26" r="6" fill="#f3dde9" stroke={fur} strokeWidth="2.5" />
          <circle cx="13" cy="34" r="1.8" fill={INK} />
          <circle cx="6.5" cy="38" r="2" fill="#cc79a7" />
          {tag && <circle cx="46" cy="22" r="8" fill={tag} stroke="#ffffff" strokeWidth="2.5" />}
        </>
      )}
      {art === 'syringe' && (
        <g transform="rotate(-40 32 32)">
          <line x1="3" y1="32" x2="14" y2="32" stroke="#52525b" strokeWidth="2" strokeLinecap="round" />
          <rect x="13" y="29" width="5" height="6" fill="#52525b" />
          <rect x="18" y="24" width="27" height="16" rx="2" fill="#ffffff" stroke={BLOCK} strokeWidth="2.5" />
          <rect x="20" y="27" width="15" height="10" fill={SKY} />
          <rect x="45" y="30" width="10" height="4" fill={BLOCK} />
          <rect x="55" y="23" width="4" height="18" rx="1" fill={BLOCK} />
        </g>
      )}
      {art === 'drop' && (
        <>
          <path d="M32 6 C40 18 49 28 49 39 A17 17 0 0 1 15 39 C15 28 24 18 32 6 Z" fill="#fadccb" stroke={VERMILLION} strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M23 40 A9 9 0 0 0 30 49" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
        </>
      )}
      {art === 'tube' && (
        <g transform="rotate(20 32 32)">
          <path d="M24 30 V46 A8 8 0 0 0 40 46 V30 Z" fill={VERMILLION} fillOpacity="0.75" />
          <path d="M24 9 V46 A8 8 0 0 0 40 46 V9" fill="none" stroke="#52525b" strokeWidth="2.5" />
          <rect x="21" y="5" width="22" height="5" rx="2" fill="#52525b" />
        </g>
      )}
      {art === 'g1' && (
        <>
          <circle cx="32" cy="32" r="17" fill="#d4ebf7" stroke={BLOCK} strokeWidth="2.5" />
          <circle cx="32" cy="32" r="7" fill={SKY} />
        </>
      )}
      {art === 's' && (
        <>
          <circle cx="32" cy="32" r="21" fill="#d4ebf7" stroke={BLOCK} strokeWidth="2.5" />
          <circle cx="32" cy="32" r="10" fill={SKY} />
          <path d="M26 30 q3 -3.5 6 0 t6 0 M26 35 q3 -3.5 6 0 t6 0" fill="none" stroke={BLOCK} strokeWidth="1.6" strokeLinecap="round" />
        </>
      )}
      {art === 'g2' && (
        <>
          <circle cx="32" cy="32" r="25" fill="#d4ebf7" stroke={BLOCK} strokeWidth="2.5" />
          <circle cx="32" cy="32" r="12" fill={SKY} />
          <path d="M25 28 q3.5 -3.5 7 0 t7 0 M25 33 q3.5 -3.5 7 0 t7 0 M25 38 q3.5 -3.5 7 0 t7 0" fill="none" stroke={BLOCK} strokeWidth="1.6" strokeLinecap="round" />
        </>
      )}
      {art === 'm' && (
        <>
          <circle cx="19" cy="32" r="14" fill="#d4ebf7" stroke={BLOCK} strokeWidth="2.5" />
          <circle cx="45" cy="32" r="14" fill="#d4ebf7" stroke={BLOCK} strokeWidth="2.5" />
          <circle cx="19" cy="32" r="6" fill={SKY} />
          <circle cx="45" cy="32" r="6" fill={SKY} />
        </>
      )}
      {art === 'space' && (
        <>
          <rect x="2" y="2" width="60" height="60" rx="6" fill={BLOCK} fillOpacity="0.06" stroke={BLOCK} strokeOpacity="0.55" strokeWidth="1.5" strokeDasharray="5 4" />
          <circle cx="50" cy="50" r="9" fill="#ffffff" stroke={BLOCK} strokeOpacity="0.55" strokeWidth="1.5" />
          <path d="M46 50 H54 M50 46 V54" stroke={BLOCK} strokeOpacity="0.7" strokeWidth="1.75" strokeLinecap="round" />
        </>
      )}
    </g>
  )
}

/* ---------- Pieces every draft uses ---------- */

type Anchor = 'start' | 'middle' | 'end'

function Label({ x, y, children, anchor = 'middle', weight = 500, colour = INK, size = 11 }: { x: number; y: number; children: ReactNode; anchor?: Anchor; weight?: number; colour?: string; size?: number }) {
  return (
    <text x={x} y={y} textAnchor={anchor} dominantBaseline="middle" fontFamily={FONT} fontSize={size} fontWeight={weight} fill={colour}>
      {children}
    </text>
  )
}

/** A filled arrowhead with its tip at (x, y), pointing along `angle` (radians). */
function Head({ x, y, angle, colour = INK, size = 8 }: { x: number; y: number; angle: number; colour?: string; size?: number }) {
  const side = (turn: number) => `${x - size * Math.cos(angle + turn)} ${y - size * Math.sin(angle + turn)}`
  return <path d={`M ${x} ${y} L ${side(0.45)} L ${side(-0.45)} Z`} fill={colour} />
}

function Arrow({ x1, y1, x2, y2, colour = INK, width = 1.5 }: { x1: number; y1: number; x2: number; y2: number; colour?: string; width?: number }) {
  const angle = Math.atan2(y2 - y1, x2 - x1)
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2 - 7 * Math.cos(angle)} y2={y2 - 7 * Math.sin(angle)} stroke={colour} strokeWidth={width} strokeLinecap="round" />
      <Head x={x2} y={y2} angle={angle} colour={colour} />
    </g>
  )
}

/** The round "+" handle of a selected block. */
function AddControl({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r="11" fill="#ffffff" stroke={SELECT} strokeWidth="1.5" />
      <path d={`M ${x - 5} ${y} H ${x + 5} M ${x} ${y - 5} V ${y + 5}`} stroke={SELECT} strokeWidth="1.75" strokeLinecap="round" />
    </g>
  )
}

/** A block's drawing; selected, it gets the blue outline and its "+". */
function Figure({ width, height, selected = false, plus, children }: { width: number; height: number; selected?: boolean; plus: { x: number; y: number }; children: ReactNode }) {
  const room = selected ? 30 : 0
  return (
    <svg width={width + room} height={height + room} viewBox={`0 0 ${width + room} ${height + room}`} aria-hidden="true" className="overflow-visible">
      {children}
      {selected && (
        <>
          <rect x="0.5" y="0.5" width={width - 1} height={height - 1} fill="none" stroke={SELECT} strokeWidth="1" />
          <AddControl x={plus.x} y={plus.y} />
        </>
      )}
    </svg>
  )
}

const LOCK: QuickAction = { id: 'lock', label: 'Lock', icon: Lock, onClick: noop }
const MORE: QuickAction = { id: 'more', label: 'More actions', icon: MoreHorizontal, onClick: noop }

function blockBar(add: string) {
  const own: QuickAction[] = [
    { id: 'add', label: add, icon: Plus, onClick: noop },
    { id: 'detach', label: 'Detach', icon: Unlink, onClick: noop },
  ]
  const groups: QuickActionGroup[] = [{ id: 'own', actions: own }, { id: 'lock', actions: [LOCK] }, { id: 'more', actions: [MORE] }]
  return <QuickActions label="Block actions" groups={groups} showLabels />
}

/** A grey stretch of canvas holding a white page. */
function Canvas({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-col items-center justify-center gap-3 rounded-lg bg-neutral-100 p-5 dark:bg-neutral-800', className)}>{children}</div>
}

function Page({ children }: { children: ReactNode }) {
  return <div className="rounded-sm bg-white p-5 shadow-sm">{children}</div>
}

function Draft({ letter, title, about, add, draw }: { letter: string; title: string; about: string; add: string; draw: (selected: boolean) => ReactNode }) {
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
          <Canvas className="min-h-[300px]">
            <Page>{draw(false)}</Page>
          </Canvas>
        </div>
        <div className="flex flex-col gap-2">
          <div className="section-label">Selected</div>
          <Canvas className="min-h-[300px]">
            {blockBar(add)}
            <Page>{draw(true)}</Page>
          </Canvas>
        </div>
      </div>
    </section>
  )
}

function Intro({ children }: { children: ReactNode }) {
  return <p className="max-w-[820px] text-sm text-muted-foreground">{children}</p>
}

/* ======================================================================
 * Experiment timeline: a scaled day axis, events placed by their day
 * ==================================================================== */

const DAYS = 28
const DOSES = [0, 3, 7, 10]
const SAMPLES = [7, 14, 21]
const END = 28
const EVENT_DAYS = [0, 3, 7, 10, 14, 21, 28]
const ALL_DAYS = Array.from({ length: DAYS + 1 }, (_, d) => d)
const WEEKS = [0, 7, 14, 21, 28]

const scale = (x0: number, x1: number) => (day: number) => x0 + (day * (x1 - x0)) / DAYS

function Triangle({ x, y }: { x: number; y: number }) {
  return <path d={`M ${x} ${y + 5} L ${x - 6} ${y - 6} L ${x + 6} ${y - 6} Z`} fill={BLOCK} />
}

function Flag({ x, y, height = 18 }: { x: number; y: number; height?: number }) {
  return (
    <g>
      <line x1={x} y1={y} x2={x} y2={y - height} stroke={VERMILLION} strokeWidth="2" />
      <path d={`M ${x} ${y - height} L ${x + 13} ${y - height + 5} L ${x} ${y - height + 10} Z`} fill={VERMILLION} />
    </g>
  )
}

function Star({ x, y, r = 7 }: { x: number; y: number; r?: number }) {
  const points = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const radius = i % 2 === 0 ? r : r * 0.45
    return `${x + radius * Math.cos(a)} ${y + radius * Math.sin(a)}`
  })
  return <path d={`M ${points.join(' L ')} Z`} fill={VERMILLION} />
}

/** A · Ruler: a thin axis with a tick per day, small markers above, a key under. */
function TimelineRuler(selected: boolean) {
  const x0 = 40
  const x1 = 500
  const axis = 104
  const px = scale(x0, x1)
  return (
    <Figure width={540} height={176} selected={selected} plus={{ x: x1 + 30, y: axis }}>
      <line x1={x0 - 12} y1={axis} x2={x1 + 8} y2={axis} stroke={INK} strokeWidth="1.5" />
      {ALL_DAYS.map((d) => {
        const named = EVENT_DAYS.includes(d)
        return <line key={d} x1={px(d)} y1={axis} x2={px(d)} y2={axis + (named ? 7 : 3.5)} stroke={INK} strokeWidth={named ? 1.5 : 1} />
      })}
      {EVENT_DAYS.map((d) => (
        <Label key={d} x={px(d)} y={axis + 19} size={10}>
          Day {d}
        </Label>
      ))}
      {DOSES.map((d) => (
        <Triangle key={d} x={px(d)} y={axis - 12} />
      ))}
      {SAMPLES.map((d) => (
        <g key={d}>
          <line x1={px(d)} y1={axis - 27} x2={px(d)} y2={axis - 4} stroke={ORANGE} strokeWidth="1.25" strokeDasharray="2 2" />
          <circle cx={px(d)} cy={axis - 32} r="5.5" fill={ORANGE} />
        </g>
      ))}
      <Flag x={px(END)} y={axis} height={52} />
      <g>
        <Triangle x={x0} y={156} />
        <Label x={x0 + 12} y={155} anchor="start" size={10}>
          Dosing, 5 mg/kg i.p.
        </Label>
        <circle cx={x0 + 150} cy={155} r="5" fill={ORANGE} />
        <Label x={x0 + 161} y={155} anchor="start" size={10}>
          Blood sample
        </Label>
        <Flag x={x0 + 258} y={163} height={16} />
        <Label x={x0 + 276} y={155} anchor="start" size={10}>
          Endpoint, tumours taken
        </Label>
      </g>
    </Figure>
  )
}

/** B · Bar with pins: a thick bar coloured by phase, icons on pins above (dosing) and below (sampling). */
function TimelinePins(selected: boolean) {
  const x0 = 50
  const x1 = 500
  const top = 118
  const bar = 16
  const px = scale(x0, x1)
  const mid = top + bar / 2
  const treatmentEnd = px(10) + 10
  return (
    <Figure width={560} height={220} selected={selected} plus={{ x: x1 + 38, y: mid }}>
      <rect x={px(0) - 14} y={top} width={px(DAYS) - px(0) + 28} height={bar} rx="8" fill="#bcd9ec" />
      <rect x={px(0) - 14} y={top} width={treatmentEnd - px(0) + 14} height={bar} rx="8" fill={BLOCK} />
      <rect x={treatmentEnd - 8} y={top} width="8" height={bar} fill={BLOCK} />
      <Label x={px(0) - 20} y={mid + 1} anchor="end" size={10} colour={MUTED}>
        Day
      </Label>
      {EVENT_DAYS.map((d) => (
        <Label key={d} x={px(d)} y={mid + 1} size={9} weight={700} colour={px(d) < treatmentEnd ? '#ffffff' : '#0b3d5c'}>
          {d}
        </Label>
      ))}
      <Label x={px(4)} y={top + bar + 14} size={10} colour={MUTED}>
        Treatment
      </Label>
      <Label x={px(17.5)} y={top + bar + 14} size={10} colour={MUTED}>
        Follow-up
      </Label>
      <Label x={px(0) - 15} y={42} anchor="start" size={10} weight={600}>
        Dosing
      </Label>
      {DOSES.map((d) => (
        <g key={d}>
          <line x1={px(d)} y1={top} x2={px(d)} y2={86} stroke={BLOCK} strokeWidth="1.5" />
          <Drawing art="syringe" x={px(d) - 15} y={54} size={30} />
        </g>
      ))}
      {SAMPLES.map((d) => (
        <g key={d}>
          <line x1={px(d)} y1={top + bar} x2={px(d)} y2={170} stroke={ORANGE} strokeWidth="1.5" />
          <Drawing art="drop" x={px(d) - 14} y={168} size={28} />
        </g>
      ))}
      <Label x={px(SAMPLES[0] ?? 7) - 14} y={208} anchor="start" size={10} weight={600}>
        Blood sample
      </Label>
      <line x1={px(END)} y1={top} x2={px(END)} y2={86} stroke={VERMILLION} strokeWidth="1.5" />
      <Drawing art="tube" x={px(END) - 16} y={52} size={32} />
      <Label x={px(END)} y={42} size={10} weight={600}>
        Endpoint
      </Label>
    </Figure>
  )
}

/** C · Lanes: one row per kind of event over a shared day axis, like a study schedule. */
function TimelineLanes(selected: boolean) {
  const x0 = 140
  const x1 = 520
  const px = scale(x0, x1)
  const lanes = [
    { name: 'Dosing', y: 36 },
    { name: 'Blood sample', y: 72 },
    { name: 'Endpoint', y: 108 },
  ]
  const axis = 136
  return (
    <Figure width={560} height={166} selected={selected} plus={{ x: 30, y: 136 }}>
      {lanes.map((lane) => (
        <g key={lane.name}>
          <rect x={x0 - 14} y={lane.y - 13} width={x1 - x0 + 28} height="26" rx="4" fill={PALE} />
          <Label x={14} y={lane.y} anchor="start" size={11}>
            {lane.name}
          </Label>
        </g>
      ))}
      {WEEKS.map((d) => (
        <line key={d} x1={px(d)} y1={20} x2={px(d)} y2={axis} stroke="#a1a1aa" strokeWidth="1" strokeDasharray="3 3" />
      ))}
      {DOSES.map((d) => (
        <rect key={d} x={px(d) - 5.5} y={36 - 5.5} width="11" height="11" fill={BLOCK} transform={`rotate(45 ${px(d)} 36)`} />
      ))}
      {SAMPLES.map((d) => (
        <circle key={d} cx={px(d)} cy={72} r="6" fill={ORANGE} />
      ))}
      <Star x={px(END)} y={108} r={8} />
      <line x1={x0 - 14} y1={axis} x2={x1 + 14} y2={axis} stroke={INK} strokeWidth="1.25" />
      {ALL_DAYS.map((d) => {
        const week = WEEKS.includes(d)
        return <line key={d} x1={px(d)} y1={axis} x2={px(d)} y2={axis + (week ? 6 : 3)} stroke={INK} strokeWidth={week ? 1.25 : 1} />
      })}
      {WEEKS.map((d) => (
        <Label key={d} x={px(d)} y={axis + 18} size={10}>
          Day {d}
        </Label>
      ))}
    </Figure>
  )
}

export const ExperimentTimeline: Story = {
  name: 'Experiment timeline',
  render: () => (
    <div className="flex flex-col gap-6 bg-background p-6 text-foreground">
      <Intro>
        An in-vivo study schedule: mice dosed on days 0, 3, 7 and 10, blood taken on days 7, 14 and 21, tumours taken on day 28. Unlike the sequence block’s Timeline look (steps evenly spaced, whatever their time), this is a real scale: each
        event sits at its day, so day 3 is closer to day 0 than day 14 is to day 7. Events are listed in the properties (kind and day, each with a − button); the “+” adds one after the last day, and changing a day moves its marker along the
        axis. Changing the length (28 days here) re-scales the whole axis without stretching the markers.
      </Intro>
      <Draft
        letter="A"
        title="Ruler"
        add="Add event"
        draw={TimelineRuler}
        about="A thin axis with a tick for every day and a label under each day that has an event. Small markers above it (triangles for dosing, dots for sampling, a flag at the endpoint) and a key underneath. The most journal-like and the most compact."
      />
      <Draft
        letter="B"
        title="Bar with pins"
        add="Add event"
        draw={TimelinePins}
        about="A thick rounded bar coloured by phase (Treatment dark, Follow-up light), the day numbers written on it. Each event is a pin with an icon space at its end: dosing above the bar, sampling below, so events on the same day never collide. Icons explain the events, so no key is needed."
      />
      <Draft
        letter="C"
        title="Lanes"
        add="Add event"
        draw={TimelineLanes}
        about="One pale row per kind of event, named on the left, over one shared day axis with a dashed line each week. Reads like a study schedule; clearest when many kinds of event overlap. The “+” at the bottom left adds a lane."
      />
    </div>
  ),
}

/* ======================================================================
 * Cycle: steps evenly round a circle with curved arrows
 * ==================================================================== */

type CycleStep = { art: Art; label: string; sub?: string }
const PHASES: CycleStep[] = [
  { art: 'g1', label: 'G1', sub: 'Growth' },
  { art: 's', label: 'S', sub: 'DNA copied' },
  { art: 'g2', label: 'G2', sub: 'Growth' },
  { art: 'm', label: 'M', sub: 'Division' },
]
/** What the "+" gives: an empty icon space with the next label. */
const PHASES_PLUS: CycleStep[] = [...PHASES, { art: 'space', label: 'Step 5' }]

const angleOf = (i: number, n: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n
const polar = (cx: number, cy: number, r: number, a: number) => ({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) })

/** A clockwise arc on a circle, from angle a1 to a2. */
function arc(cx: number, cy: number, r: number, a1: number, a2: number) {
  const p1 = polar(cx, cy, r, a1)
  const p2 = polar(cx, cy, r, a2)
  return `M ${p1.x} ${p1.y} A ${r} ${r} 0 ${a2 - a1 > Math.PI ? 1 : 0} 1 ${p2.x} ${p2.y}`
}

function CycleTitle({ x, y }: { x: number; y: number }) {
  return (
    <Label x={x} y={y} size={13} weight={600}>
      Cell cycle
    </Label>
  )
}

/** A · Ring: icons on a circle, thin arrows following the circle between them, labels outside. */
function CycleRing(selected: boolean) {
  const steps = selected ? PHASES_PLUS : PHASES
  const n = steps.length
  const [cx, cy, r, icon] = [200, 180, 100, 50]
  const gap = (icon / 2 + 10) / r
  return (
    <Figure width={400} height={360} selected={selected} plus={{ x: 384, y: 344 }}>
      <CycleTitle x={cx} y={cy} />
      {steps.map((step, i) => {
        const a = angleOf(i, n)
        const next = a + (2 * Math.PI) / n
        const p = polar(cx, cy, r, a)
        const tip = polar(cx, cy, r, next - gap)
        const out = polar(cx, cy, r + icon / 2 + 12, a)
        const cos = Math.cos(a)
        const anchor: Anchor = cos > 0.35 ? 'start' : cos < -0.35 ? 'end' : 'middle'
        const shift = anchor === 'middle' ? Math.sign(Math.sin(a)) * 12 : 0
        return (
          <g key={i}>
            <path d={arc(cx, cy, r, a + gap, next - gap - 6 / r)} fill="none" stroke={INK} strokeWidth="1.75" strokeLinecap="round" />
            <Head x={tip.x} y={tip.y} angle={next - gap + Math.PI / 2} />
            <Drawing art={step.art} x={p.x - icon / 2} y={p.y - icon / 2} size={icon} />
            <Label x={out.x} y={out.y + shift - 7} anchor={anchor} size={12} weight={600}>
              {step.label}
            </Label>
            {step.sub && (
              <Label x={out.x} y={out.y + shift + 8} anchor={anchor} size={10} colour={MUTED}>
                {step.sub}
              </Label>
            )}
          </g>
        )
      })}
    </Figure>
  )
}

/** B · Segments: a ring of arrow-shaped coloured pieces, the step names inside, icons outside. */
function CycleSegments(selected: boolean) {
  const steps = selected ? PHASES_PLUS : PHASES
  const n = steps.length
  const [cx, cy, mid, thick, icon] = [200, 180, 92, 30, 44]
  const outer = mid + thick / 2
  const inner = mid - thick / 2
  const span = (2 * Math.PI) / n
  const gap = 3 / mid
  const point = 10 / mid
  return (
    <Figure width={400} height={360} selected={selected} plus={{ x: 384, y: 344 }}>
      <CycleTitle x={cx} y={cy} />
      {steps.map((step, i) => {
        const a = angleOf(i, n)
        const s = a - span / 2 + gap
        const e = a + span / 2 - gap
        const o1 = polar(cx, cy, outer, s)
        const o2 = polar(cx, cy, outer, e)
        const tip = polar(cx, cy, mid, e + point)
        const i2 = polar(cx, cy, inner, e)
        const i1 = polar(cx, cy, inner, s)
        const notch = polar(cx, cy, mid, s + point)
        const d = `M ${o1.x} ${o1.y} A ${outer} ${outer} 0 0 1 ${o2.x} ${o2.y} L ${tip.x} ${tip.y} L ${i2.x} ${i2.y} A ${inner} ${inner} 0 0 0 ${i1.x} ${i1.y} L ${notch.x} ${notch.y} Z`
        const colour = step.art === 'space' ? '#d4e6f2' : shadeAt(i)
        const text = polar(cx, cy, mid, a + point / 2)
        const p = polar(cx, cy, outer + icon / 2 + 10, a)
        return (
          <g key={i}>
            <path d={d} fill={colour} />
            <Label x={text.x} y={text.y + 1} size={11} weight={700} colour={darkText(colour) || step.art === 'space' ? '#0b3d5c' : '#ffffff'}>
              {step.label}
            </Label>
            <Drawing art={step.art} x={p.x - icon / 2} y={p.y - icon / 2} size={icon} />
          </g>
        )
      })}
    </Figure>
  )
}

/** C · Loop of cards: each step in a pale card, bold blue arrows bowing outward between them. */
function CycleCards(selected: boolean) {
  const steps = selected ? PHASES_PLUS : PHASES
  const n = steps.length
  const card = n > 4 ? 66 : 76
  const [cx, cy, r] = [210, 200, 112]
  const gap = (card / 2 + 12) / (r + 16)
  const bow = 1 + 1.6 / n
  return (
    <Figure width={420} height={400} selected={selected} plus={{ x: 404, y: 384 }}>
      <CycleTitle x={cx} y={cy} />
      {steps.map((step, i) => {
        const a = angleOf(i, n)
        const next = a + (2 * Math.PI) / n
        const start = polar(cx, cy, r + 16, a + gap)
        const end = polar(cx, cy, r + 16, next - gap)
        const bend = polar(cx, cy, (r + 16) * bow, (a + next) / 2)
        const p = polar(cx, cy, r, a)
        const empty = step.art === 'space'
        return (
          <g key={i}>
            <path d={`M ${start.x} ${start.y} Q ${bend.x} ${bend.y} ${end.x} ${end.y}`} fill="none" stroke={BLOCK} strokeWidth="3.5" strokeLinecap="round" />
            <Head x={end.x + 4 * Math.cos(Math.atan2(end.y - bend.y, end.x - bend.x))} y={end.y + 4 * Math.sin(Math.atan2(end.y - bend.y, end.x - bend.x))} angle={Math.atan2(end.y - bend.y, end.x - bend.x)} colour={BLOCK} size={12} />
            <rect x={p.x - card / 2} y={p.y - card / 2} width={card} height={card} rx="10" fill={empty ? '#ffffff' : PALE} stroke={BLOCK} strokeOpacity={empty ? 0.4 : 0.35} strokeWidth="1.25" />
            <Drawing art={step.art} x={p.x - card * 0.26} y={p.y - card / 2 + 6} size={card * 0.52} />
            <Label x={p.x} y={p.y + card / 2 - 13} size={11} weight={600} colour="#0b3d5c">
              {step.label}
            </Label>
          </g>
        )
      })}
    </Figure>
  )
}

export const Cycle: Story = {
  render: () => (
    <div className="flex flex-col gap-6 bg-background p-6 text-foreground">
      <Intro>
        The cell cycle as four steps (G1, S, G2, M), each holding an icon. The steps sit evenly round a circle and the arrows follow it, so it reads as a loop with no start or end. Selected, a fifth step has been added with the “+”: an empty icon
        space with the next label, and all five spread out evenly again. A step’s − in the properties takes it away and the rest close up the same way. Each step is an ordinary icon, as in a sequence.
      </Intro>
      <Draft
        letter="A"
        title="Ring"
        add="Add step"
        draw={CycleRing}
        about="The icons themselves sit on the circle, thin black arrows run along it between them, and each step’s name (with an optional second line) sits outside. Light and textbook-like; the icons carry it."
      />
      <Draft
        letter="B"
        title="Segments"
        add="Add step"
        draw={CycleSegments}
        about="A ring of arrow-shaped pieces in shades of the block’s colour, the step names written inside, each piece pointing into the next. Icons sit outside the ring. The classic cell-cycle wheel; the boldest of the three."
      />
      <Draft
        letter="C"
        title="Loop of cards"
        add="Add step"
        draw={CycleCards}
        about="Each step is a pale card with its icon and name, and thick blue arrows bow outward from one card to the next. Reads as a feedback loop or a lab workflow that repeats."
      />
    </div>
  ),
}

/* ======================================================================
 * Branching: one step splitting into arms
 * ==================================================================== */

type ArmStep = { label: string; sub: string; tag: string }
const ARMS: ArmStep[] = [
  { label: 'Vehicle', sub: 'Saline i.p.', tag: '#a1a1aa' },
  { label: 'Low dose', sub: '5 mg/kg i.p.', tag: SKY },
  { label: 'High dose', sub: '20 mg/kg i.p.', tag: BLOCK },
]

/** A · Tree: lines with rounded corners from the source to each arm, all in the block's colour; arms stacked down the right. */
function BranchTree(selected: boolean) {
  const src = 118
  const trunk = 124
  const end = 198
  const ys = [44, 118, 192]
  return (
    <Figure width={420} height={236} selected={selected} plus={{ x: 227, y: 250 }}>
      <Drawing art="mouse" x={16} y={src - 32} size={64} />
      <Label x={48} y={src + 40} size={10} colour={MUTED}>
        Mice, n = 30
      </Label>
      <line x1={82} y1={src} x2={trunk} y2={src} stroke={BLOCK} strokeWidth="2" />
      {ARMS.map((arm, i) => {
        const y = ys.at(i) ?? src
        const down = Math.sign(y - src)
        const path = down === 0 ? `M ${trunk} ${src} H ${end - 7}` : `M ${trunk} ${src} V ${y - down * 10} Q ${trunk} ${y} ${trunk + 10} ${y} H ${end - 7}`
        return (
          <g key={arm.label}>
            <path d={path} fill="none" stroke={BLOCK} strokeWidth="2" />
            <Head x={end} y={y} angle={0} colour={BLOCK} />
            <Drawing art="mouse" x={end + 4} y={y - 26} size={52} tag={arm.tag} />
            <Label x={end + 64} y={y - 7} anchor="start" size={12} weight={600}>
              {arm.label}
            </Label>
            <Label x={end + 64} y={y + 9} anchor="start" size={10} colour={MUTED}>
              {arm.sub}
            </Label>
          </g>
        )
      })}
    </Figure>
  )
}

/** B · Fan: curved arrows fanning down from the source to arms side by side, names under them. */
function BranchFan(selected: boolean) {
  const xs = [80, 210, 340]
  const from = { x: 210, y: 76 }
  return (
    <Figure width={420} height={244} selected={selected} plus={{ x: 432, y: 177 }}>
      <Drawing art="mouse" x={178} y={8} size={64} />
      <Label x={250} y={40} anchor="start" size={10} colour={MUTED}>
        Mice, n = 30
      </Label>
      {ARMS.map((arm, i) => {
        const x = xs.at(i) ?? from.x
        return (
          <g key={arm.label}>
            <path d={`M ${from.x} ${from.y} C ${from.x} 112 ${x} 106 ${x} 140`} fill="none" stroke={INK} strokeWidth="1.75" strokeLinecap="round" />
            <Head x={x} y={147} angle={Math.PI / 2} />
            <Drawing art="mouse" x={x - 26} y={150} size={52} tag={arm.tag} />
            <Label x={x} y={214} size={12} weight={600}>
              {arm.label}
            </Label>
            <Label x={x} y={230} size={10} colour={MUTED}>
              {arm.sub}
            </Label>
          </g>
        )
      })}
    </Figure>
  )
}

/** C · Arm rows: a brace from the source, each arm a pale row with its name chip and its own steps. */
function BranchRows(selected: boolean) {
  const ys = [50, 120, 190]
  const chip = ['#9cc7e2', '#2f86c0', '#005a8e']
  return (
    <Figure width={540} height={240} selected={selected} plus={{ x: 150, y: 254 }}>
      <Drawing art="mouse" x={8} y={90} size={60} />
      <Label x={38} y={160} size={10} colour={MUTED}>
        n = 30
      </Label>
      <Arrow x1={70} y1={120} x2={98} y2={120} colour={BLOCK} width={2} />
      <path d="M 120 26 Q 110 26 110 36 V 110 Q 110 120 102 120 Q 110 120 110 130 V 204 Q 110 214 120 214" fill="none" stroke={BLOCK} strokeWidth="2" />
      {ARMS.map((arm, i) => {
        const y = ys.at(i) ?? 120
        const fill = chip.at(i) ?? BLOCK
        return (
          <g key={arm.label}>
            <rect x={128} y={y - 28} width={404} height={56} rx="10" fill={PALE} />
            <rect x={138} y={y - 13} width={88} height={26} rx="13" fill={fill} />
            <Label x={182} y={y + 1} size={11} weight={600} colour={darkText(fill) ? '#0b3d5c' : '#ffffff'}>
              {arm.label}
            </Label>
            <Arrow x1={234} y1={y} x2={256} y2={y} />
            <Drawing art="syringe" x={260} y={y - 18} size={36} />
            <Arrow x1={302} y1={y} x2={324} y2={y} />
            <Drawing art="drop" x={328} y={y - 18} size={36} />
            <Arrow x1={370} y1={y} x2={392} y2={y} />
            <Drawing art="tube" x={396} y={y - 18} size={36} />
            <Label x={444} y={y + 1} anchor="start" size={10} colour={MUTED}>
              {arm.sub}
            </Label>
          </g>
        )
      })}
    </Figure>
  )
}

export const Branching: Story = {
  render: () => (
    <div className="flex flex-col gap-6 bg-background p-6 text-foreground">
      <Intro>
        Thirty mice split into three treatment groups. The source and each arm hold an icon and a name with a second line. Selected, the “+” after the last arm adds another (up to 5); each arm has a − in the properties, and the block keeps at least
        two. The arms stay evenly spaced and the lines are drawn again as arms come and go.
      </Intro>
      <Draft
        letter="A"
        title="Tree"
        add="Add arm"
        draw={BranchTree}
        about="Square lines with rounded corners in the block’s colour, from the source to a trunk and out to each arm. Arms stacked down the right with their names beside them. Tidy, like a CONSORT or study-design chart."
      />
      <Draft
        letter="B"
        title="Fan"
        add="Add arm"
        draw={BranchFan}
        about="Soft curved black arrows fanning down from the source to the arms side by side, the names under each. Lighter and friendlier; fits the top of a figure."
      />
      <Draft
        letter="C"
        title="Arm rows"
        add="Add arm"
        draw={BranchRows}
        about="A brace from the source, then each arm is its own pale row starting with a coloured name chip and followed by that arm’s steps (dose, sample, readout), like a small sequence per arm. The richest; good when the arms are treated differently."
      />
    </div>
  ),
}
