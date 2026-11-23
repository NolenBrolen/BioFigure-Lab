/*
 * Simple science shapes for the sample screen only.
 *
 * These are placeholders drawn in code to fill the mock-up. They are not
 * library icons and won't ship in the icon library. Each one uses the
 * library's 128x128 frame and no SVG filters, like real icons will.
 */
import type { ComponentType, SVGProps } from 'react'

type Point = [number, number]

const fmt = ([x, y]: Point) => `${x.toFixed(1)} ${y.toFixed(1)}`

/** A smooth, slightly wobbly closed outline, for cells. */
function blobPath(cx: number, cy: number, r: number, wobble: number, lobes: number, phase = 0, count = 28) {
  const pts: Point[] = Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2
    const rr = r + wobble * Math.sin(lobes * a + phase) + wobble * 0.35 * Math.sin(3 * a + 1.3)
    return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)]
  })
  let d = `M${fmt(pts[0])}`
  for (let i = 0; i < count; i++) {
    const p0 = pts[(i - 1 + count) % count]
    const p1 = pts[i]
    const p2 = pts[(i + 1) % count]
    const p3 = pts[(i + 2) % count]
    const c1: Point = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2: Point = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += `C${fmt(c1)} ${fmt(c2)} ${fmt(p2)}`
  }
  return `${d}Z`
}

/* --- Shapes as SVG groups in a 128x128 frame, reused by the sample figure --- */

export const macrophageColours = { fill: '#f8d3bf', stroke: '#d9895b', nucleus: '#b45f86' }
const macrophageOutline = blobPath(64, 64, 47, 4.5, 5, 0.4)

export function MacrophageShape({ nucleus = [54, 70] }: { nucleus?: Point }) {
  return (
    <g>
      <path d={macrophageOutline} fill={macrophageColours.fill} stroke={macrophageColours.stroke} strokeWidth={4} />
      <ellipse cx={nucleus[0]} cy={nucleus[1]} rx={18} ry={13} fill={macrophageColours.nucleus} transform={`rotate(-18 ${nucleus[0]} ${nucleus[1]})`} />
      <circle cx={84} cy={50} r={4} fill="#eeb79a" />
      <circle cx={40} cy={46} r={3} fill="#eeb79a" />
      <circle cx={80} cy={88} r={3.5} fill="#eeb79a" />
    </g>
  )
}

export function BacteriumShape() {
  return (
    <g transform="rotate(-30 64 64)">
      <path d="M104 64 C112 56 118 72 126 64" fill="none" stroke="#3f8f5f" strokeWidth={3} strokeLinecap="round" />
      <rect x={22} y={46} width={84} height={36} rx={18} fill="#bfe3c8" stroke="#3f8f5f" strokeWidth={4} />
      <path d="M44 64 C52 56 60 72 68 64 S84 56 88 64" fill="none" stroke="#6fb488" strokeWidth={3} strokeLinecap="round" />
    </g>
  )
}

function CellShape() {
  return (
    <g>
      <path d={blobPath(64, 64, 50, 2.5, 3, 1)} fill="#fde4e1" stroke="#e08a80" strokeWidth={4} />
      <circle cx={70} cy={58} r={19} fill="#c56b8a" />
      <circle cx={65} cy={54} r={5} fill="#9c4468" />
      <circle cx={38} cy={80} r={4} fill="#eaa79d" />
      <circle cx={50} cy={96} r={3} fill="#eaa79d" />
      <circle cx={92} cy={86} r={4.5} fill="#eaa79d" />
    </g>
  )
}

function RedBloodCellShape() {
  return (
    <g>
      <ellipse cx={64} cy={64} rx={50} ry={42} fill="#e5484d" stroke="#b4232a" strokeWidth={4} />
      <ellipse cx={64} cy={64} rx={25} ry={20} fill="#c9363b" />
    </g>
  )
}

function VirusShape() {
  const spikes = Array.from({ length: 10 }, (_, i) => (i / 10) * Math.PI * 2)
  return (
    <g>
      {spikes.map((a) => (
        <g key={a}>
          <line x1={64 + 32 * Math.cos(a)} y1={64 + 32 * Math.sin(a)} x2={64 + 46 * Math.cos(a)} y2={64 + 46 * Math.sin(a)} stroke="#e0823d" strokeWidth={4} strokeLinecap="round" />
          <circle cx={64 + 50 * Math.cos(a)} cy={64 + 50 * Math.sin(a)} r={6} fill="#f4a261" />
        </g>
      ))}
      <circle cx={64} cy={64} r={32} fill="#ffd8b0" stroke="#e0823d" strokeWidth={4} />
      <circle cx={64} cy={64} r={14} fill="#f4a261" />
    </g>
  )
}

function YeastShape() {
  return (
    <g>
      <ellipse cx={92} cy={38} rx={20} ry={18} fill="#f3e3b5" stroke="#b8913a" strokeWidth={4} />
      <ellipse cx={56} cy={72} rx={42} ry={38} fill="#f3e3b5" stroke="#b8913a" strokeWidth={4} />
      <circle cx={50} cy={78} r={12} fill="#d8b866" />
    </g>
  )
}

function AntibodyShape() {
  return (
    <g strokeLinecap="round" fill="none">
      <path d="M64 114 V66 L34 28 M64 66 L94 28" stroke="#3d5af1" strokeWidth={12} strokeLinejoin="round" />
      <path d="M46 60 L26 35 M82 60 L102 35" stroke="#93a5ff" strokeWidth={9} />
    </g>
  )
}

function DnaShape() {
  const steps = 48
  const strand = (sign: 1 | -1) =>
    Array.from({ length: steps + 1 }, (_, i) => {
      const y = 12 + (104 * i) / steps
      return `${i ? 'L' : 'M'}${(64 + sign * 24 * Math.sin((i / steps) * Math.PI * 3)).toFixed(1)} ${y.toFixed(1)}`
    }).join(' ')
  const rungs = Array.from({ length: 11 }, (_, i) => 1 + i * 4.4)
  return (
    <g fill="none" strokeLinecap="round">
      {rungs.map((i) => {
        const y = 12 + (104 * i) / steps
        const x = 24 * Math.sin((i / steps) * Math.PI * 3)
        return <line key={i} x1={64 - x} y1={y} x2={64 + x} y2={y} stroke="#c9d2e8" strokeWidth={4} />
      })}
      <path d={strand(1)} stroke="#5b7cfa" strokeWidth={6} />
      <path d={strand(-1)} stroke="#f07167" strokeWidth={6} />
    </g>
  )
}

function MitochondrionShape() {
  return (
    <g transform="rotate(-24 64 64)">
      <ellipse cx={64} cy={64} rx={54} ry={30} fill="#ffd3a8" stroke="#d9822b" strokeWidth={4} />
      <path d="M22 64 q8 -18 16 0 t16 0 t16 0 t16 0 t16 0 t8 0" fill="none" stroke="#e59a4f" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  )
}

function FlaskShape() {
  return (
    <g strokeLinejoin="round">
      <path d="M54 16 V48 L24 104 Q20 112 30 112 H98 Q108 112 104 104 L74 48 V16 Z" fill="#eef4fb" />
      <path d="M34.7 84 H93.3 L104 104 Q108 112 98 112 H30 Q20 112 24 104 Z" fill="#7cc6e8" />
      <path d="M54 16 V48 L24 104 Q20 112 30 112 H98 Q108 112 104 104 L74 48 V16" fill="none" stroke="#5c6b80" strokeWidth={4} />
      <path d="M48 16 H80" stroke="#5c6b80" strokeWidth={5} strokeLinecap="round" />
    </g>
  )
}

function PetriDishShape() {
  return (
    <g>
      <path d="M12 62 v14 a52 24 0 0 0 104 0 v-14" fill="#dce7f1" stroke="#7f93a8" strokeWidth={4} />
      <ellipse cx={64} cy={62} rx={52} ry={24} fill="#eef4f9" stroke="#7f93a8" strokeWidth={4} />
      <ellipse cx={64} cy={63} rx={42} ry={17} fill="#f5e9c4" />
      <ellipse cx={48} cy={58} rx={5} ry={3} fill="#e8a33d" />
      <ellipse cx={70} cy={68} rx={6} ry={3.5} fill="#f2c14e" />
      <ellipse cx={82} cy={56} rx={4} ry={2.5} fill="#e8a33d" />
      <ellipse cx={58} cy={70} rx={3.5} ry={2} fill="#d98a2b" />
    </g>
  )
}

function PipetteShape() {
  return (
    <g transform="rotate(35 64 64)" strokeLinejoin="round">
      <rect x={52} y={6} width={24} height={36} rx={12} fill="#f08080" stroke="#b44c4c" strokeWidth={4} />
      <path d="M56 42 H72 V92 L66 120 H62 L56 92 Z" fill="#eef4fb" stroke="#5c6b80" strokeWidth={4} />
      <path d="M58.5 78 H69.5 V92 L64.8 112 H63.2 L58.5 92 Z" fill="#7cc6e8" />
    </g>
  )
}

/* --- The same shapes as standalone icons for the library panel --- */

type IconProps = SVGProps<SVGSVGElement>

function asIcon(Shape: ComponentType) {
  return function SampleIcon(props: IconProps) {
    return (
      <svg viewBox="0 0 128 128" aria-hidden="true" {...props}>
        <Shape />
      </svg>
    )
  }
}

export type SampleIcon = {
  name: string
  /** Sample data, to show what the origin label looks like. */
  Icon: ComponentType<IconProps>
}

export const sampleCategories: { name: string; count: number; icons: SampleIcon[] }[] = [
  {
    name: 'Cells',
    count: 48,
    icons: [
      { name: 'Animal cell', Icon: asIcon(CellShape) },
      { name: 'Macrophage', Icon: asIcon(() => <MacrophageShape />) },
      { name: 'Red blood cell', Icon: asIcon(RedBloodCellShape) },
    ],
  },
  {
    name: 'Microbes',
    count: 31,
    icons: [
      { name: 'Bacterium', Icon: asIcon(BacteriumShape) },
      { name: 'Virus', Icon: asIcon(VirusShape) },
      { name: 'Yeast', Icon: asIcon(YeastShape) },
    ],
  },
  {
    name: 'Molecules',
    count: 64,
    icons: [
      { name: 'Antibody', Icon: asIcon(AntibodyShape) },
      { name: 'DNA', Icon: asIcon(DnaShape) },
      { name: 'Mitochondrion', Icon: asIcon(MitochondrionShape) },
    ],
  },
  {
    name: 'Lab equipment',
    count: 27,
    icons: [
      { name: 'Flask', Icon: asIcon(FlaskShape) },
      { name: 'Petri dish', Icon: asIcon(PetriDishShape) },
      { name: 'Pipette', Icon: asIcon(PipetteShape) },
    ],
  },
]
