/*
 * BIO-105 design drafts: the pathway cascade block. Visual drafts only: no
 * tests, no accessibility pass, nothing wired up. After the owner picks, the
 * chosen version gets built properly in the editor's Blocks tool (new
 * "Pathways" heading).
 *
 * A signalling pathway read top to bottom: a ligand outside the cell, a
 * receptor in the membrane, a chain of molecules (icon spaces linked by
 * arrows) and, at the end, the nucleus.
 *   A  Cell cutout     drawn like a textbook: a lipid bilayer across the top,
 *                      bare icons on thin arrows, a double-walled nucleus
 *   B  Flow cards      no biology drawn: each molecule is a card (icon, name,
 *                      role), arrows carry a verb, the nucleus is a dashed box
 *   C  Compartments    the figure is cut into bands (Outside, Membrane,
 *                      Cytoplasm, Nucleus) named down the left edge; bare icons
 *                      on fat chevron arrows
 *
 * Each version shows its card in the Blocks tool (what clicking it places),
 * the block filled in (adrenaline → β2 receptor → Gαs → adenylyl cyclase →
 * PKA → CREB → target genes) and the block selected.
 *
 * The pictures are real library icons, read from the repo's icons folder for
 * these drafts only (nothing from it is bundled into packages/ui).
 */
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactNode } from 'react'

import adrenalineSvg from '../../../../../icons/small-molecules/adrenaline-ball-stick-flat.svg?raw'
import atpSvg from '../../../../../icons/small-molecules/atp-ball-stick-flat.svg?raw'
import dnaSvg from '../../../../../icons/nucleic-acids/dna-double-helix-textbook.svg?raw'
import gpcrSvg from '../../../../../icons/membranes/gpcr-textbook.svg?raw'
import foldSvg from '../../../../../icons/molecules/protein-fold-simple-flat.svg?raw'
import surfaceSvg from '../../../../../icons/molecules/protein-surface-simple-flat.svg?raw'
import surfaceDetailedSvg from '../../../../../icons/molecules/protein-surface-detailed-flat.svg?raw'

const meta = {
  title: 'Drafts/BIO-105 Pathway cascade',
  parameters: { controls: { disable: true }, layout: 'fullscreen' },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const BLUE = '#0072b2' // the panels' blue
const TINT = '#e6f1f8'
const SELECT = '#2563eb' // selection blue
const INK = '#27272a'
const MUTED = '#71717a'
const LIPID = '#e3cfa1' // the membrane icons' lipid colour
const LIPID_EDGE = '#c9ae72'
const NUC = '#7c6bb0' // nucleus purple
const NUC_TINT = '#f4f1fa'
const FONT = 'Inter, system-ui, sans-serif'

const dataUrl = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`

/* ---------- The pathway shown in every version ---------- */

type Step = { name: string; role: string; icon?: string; verb?: string; minus?: boolean }
type Pathway = { ligand: Step; receptor: Step; chain: Step[]; nucleus: Step[] }

const FILLED: Pathway = {
  ligand: { name: 'Adrenaline', role: 'Ligand', icon: dataUrl(adrenalineSvg) },
  receptor: { name: 'β2 receptor', role: 'GPCR', icon: dataUrl(gpcrSvg), verb: 'activates' },
  chain: [
    { name: 'Gαs', role: 'G protein', icon: dataUrl(foldSvg), verb: 'activates' },
    { name: 'Adenylyl cyclase', role: 'Enzyme', icon: dataUrl(surfaceDetailedSvg), verb: 'makes cAMP', minus: true },
    { name: 'cAMP', role: 'Second messenger', icon: dataUrl(atpSvg), verb: 'activates' },
    { name: 'PKA', role: 'Kinase', icon: dataUrl(surfaceSvg), verb: 'phosphorylates' },
  ],
  nucleus: [
    { name: 'CREB', role: 'Transcription factor', icon: dataUrl(foldSvg), verb: 'binds' },
    { name: 'Target genes', role: 'Transcription', icon: dataUrl(dnaSvg) },
  ],
}

/** What clicking the card places: every space empty, with starting names. */
const EMPTY: Pathway = {
  ligand: { name: 'Ligand', role: '' },
  receptor: { name: 'Receptor', role: '' },
  chain: [{ name: 'Step 1', role: '' }, { name: 'Step 2', role: '' }],
  nucleus: [{ name: 'Target gene', role: '' }],
}

/** The card's picture: shorter, so it reads at card size. */
const CARD: Pathway = {
  ligand: { name: 'Ligand', role: '' },
  receptor: { name: 'Receptor', role: '' },
  chain: [{ name: 'Step 1', role: '' }],
  nucleus: [{ name: 'Target gene', role: '' }],
}

/* ---------- Pieces every version uses ---------- */

/** An empty icon space as the editor draws it: faint dashed box, faded cell, plus badge. */
function EmptySpace({ x, y, w, h, colour = BLUE }: { x: number; y: number; w: number; h: number; colour?: string }) {
  const r = Math.min(15, Math.max(8, Math.min(w, h) * 0.2))
  const m = { x: x + w / 2, y: y + h / 2 }
  const badge = { x: m.x + r * 0.68, y: m.y + r * 0.68, r: Math.max(4, r * 0.36) }
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={Math.min(8, w * 0.14)} fill="#fff" fillOpacity={0.6} stroke={colour} strokeOpacity={0.4} strokeDasharray="3 3" />
      <rect x={x} y={y} width={w} height={h} rx={Math.min(8, w * 0.14)} fill={colour} fillOpacity={0.05} />
      <circle cx={m.x} cy={m.y} r={r} fill="#eef5fa" stroke="#b3d3e8" />
      <circle cx={m.x - r * 0.12} cy={m.y - r * 0.1} r={r * 0.58} fill="#c6dfee" />
      <circle cx={badge.x} cy={badge.y} r={badge.r + 1.5} fill="#f2f7fb" />
      <circle cx={badge.x} cy={badge.y} r={badge.r} fill="#94c0dc" />
      <path d={`M ${badge.x - badge.r / 2} ${badge.y} H ${badge.x + badge.r / 2} M ${badge.x} ${badge.y - badge.r / 2} V ${badge.y + badge.r / 2}`} stroke="#fff" strokeWidth={1.25} strokeLinecap="round" />
    </g>
  )
}

/** An icon space: the icon when filled, the empty space otherwise. */
function Space({ step, x, y, size }: { step: Step; x: number; y: number; size: number }) {
  return step.icon ? <image href={step.icon} x={x} y={y} width={size} height={size} /> : <EmptySpace x={x} y={y} w={size} h={size} />
}

function Text({ x, y, children, anchor = 'start', size = 11, weight = 500, colour = INK, italic = false, spacing }: { x: number; y: number; children: ReactNode; anchor?: 'start' | 'middle' | 'end'; size?: number; weight?: number; colour?: string; italic?: boolean; spacing?: number }) {
  return (
    <text x={x} y={y} textAnchor={anchor} dominantBaseline="middle" fontFamily={FONT} fontSize={size} fontWeight={weight} fill={colour} fontStyle={italic ? 'italic' : undefined} letterSpacing={spacing}>
      {children}
    </text>
  )
}

/** A thin arrow straight down with a filled head. */
function DownArrow({ x, y1, y2, colour = BLUE, width = 1.5 }: { x: number; y1: number; y2: number; colour?: string; width?: number }) {
  const head = 4 + width * 1.5
  return (
    <g>
      <line x1={x} y1={y1} x2={x} y2={y2 - head + 1} stroke={colour} strokeWidth={width} strokeLinecap="round" />
      <path d={`M ${x - head * 0.7} ${y2 - head} L ${x} ${y2} L ${x + head * 0.7} ${y2 - head} Z`} fill={colour} />
    </g>
  )
}

/** A short, fat chevron arrow (version C). */
function Chevron({ x, y1, y2, colour = BLUE }: { x: number; y1: number; y2: number; colour?: string }) {
  const h = y2 - y1
  const w = 16
  const head = Math.min(9, h * 0.55)
  return <path d={`M ${x - w / 2} ${y1} H ${x + w / 2} V ${y2 - head} L ${x} ${y2} L ${x - w / 2} ${y2 - head} Z`} fill={colour} fillOpacity={0.9} />
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

/** A small round button on the canvas: "+" to add, "−" to remove. */
function RoundButton({ x, y, minus = false }: { x: number; y: number; minus?: boolean }) {
  return (
    <g>
      <circle cx={x} cy={y} r={9} fill={minus ? '#fff' : SELECT} stroke={SELECT} strokeWidth={1.25} />
      <path d={minus ? `M ${x - 4} ${y} H ${x + 4}` : `M ${x - 4} ${y} H ${x + 4} M ${x} ${y - 4} V ${y + 4}`} stroke={minus ? SELECT : '#fff'} strokeWidth={1.75} strokeLinecap="round" />
    </g>
  )
}

/** The block's name and role beside a space (A and C). */
function NameBeside({ step, x, y }: { step: Step; x: number; y: number }) {
  if (!step.role) return <Text x={x} y={y}>{step.name}</Text>
  return (
    <g>
      <Text x={x} y={y - 7} size={11.5} weight={600}>
        {step.name}
      </Text>
      <Text x={x} y={y + 8} size={10} colour={MUTED}>
        {step.role}
      </Text>
    </g>
  )
}

/** A lipid bilayer band across the block: two rows of heads, tails between. */
function Bilayer({ x, w, top, h }: { x: number; w: number; top: number; h: number }) {
  const heads: ReactNode[] = []
  const r = 3.1
  for (let px = x + r; px <= x + w - r; px += 7) {
    heads.push(
      <g key={px}>
        <path d={`M ${px - 1} ${top + r} V ${top + h / 2 - 1} M ${px + 1} ${top + r} V ${top + h / 2 - 1} M ${px - 1} ${top + h - r} V ${top + h / 2 + 1} M ${px + 1} ${top + h - r} V ${top + h / 2 + 1}`} stroke={LIPID} strokeWidth={0.9} />
        <circle cx={px} cy={top + r} r={r} fill={LIPID} stroke={LIPID_EDGE} strokeWidth={0.6} />
        <circle cx={px} cy={top + h - r} r={r} fill={LIPID} stroke={LIPID_EDGE} strokeWidth={0.6} />
      </g>,
    )
  }
  return <g>{heads}</g>
}

/* ---------- A · Cell cutout ---------- */

const AW = 340

function cutoutLayout(p: Pathway) {
  const cx = 118
  const S = 58
  const R = 84
  const arrow = 30
  const ligand = { y: 14, size: 48 }
  const receptor = { y: ligand.y + ligand.size + 14, size: R }
  // The GPCR icon's own membrane runs from 44 to 84 of its 128: the block's band lines up with it.
  const band = { top: receptor.y + (R * 44) / 128, h: (R * 40) / 128 }
  let y = receptor.y + R + arrow
  const chain = p.chain.map(() => {
    const at = y
    y += S + arrow
    return at
  })
  const nucTop = y - 6
  y = nucTop + 22
  const nuclear = p.nucleus.map(() => {
    const at = y
    y += S + arrow
    return at
  })
  const nucBottom = y - arrow + 26
  return { cx, S, R, arrow, ligand, receptor, band, chain, nucTop, nuclear, nucBottom, h: nucBottom + 12 }
}

function CellCutout({ p, selected = false, card = false }: { p: Pathway; selected?: boolean; card?: boolean }) {
  const L = cutoutLayout(p)
  const { cx, S, R } = L
  const labelX = cx + S / 2 + 14
  const all = [...p.chain, ...p.nucleus]
  const lastChainY = L.chain.at(-1) ?? L.receptor.y
  return (
    <svg viewBox={`0 0 ${AW} ${L.h}`} className={card ? 'h-full w-auto' : 'w-full'}>
      <Text x={12} y={L.ligand.y + 6} size={9} colour={MUTED} spacing={0.6}>
        OUTSIDE
      </Text>
      <Text x={12} y={L.band.top + L.band.h + 14} size={9} colour={MUTED} spacing={0.6}>
        CYTOPLASM
      </Text>
      <Bilayer x={6} w={AW - 12} top={L.band.top} h={L.band.h} />
      {/* Ligand, then the receptor sitting in the bilayer. */}
      <Space step={p.ligand} x={cx - L.ligand.size / 2} y={L.ligand.y} size={L.ligand.size} />
      <NameBeside step={p.ligand} x={labelX} y={L.ligand.y + L.ligand.size / 2} />
      <DownArrow x={cx} y1={L.ligand.y + L.ligand.size + 2} y2={L.receptor.y + 10} />
      <Space step={p.receptor} x={cx - R / 2} y={L.receptor.y} size={R} />
      <NameBeside step={p.receptor} x={cx + R / 2 + 10} y={L.receptor.y + 16} />
      {/* The nucleus: a double wall with a few pores. */}
      <rect x={24} y={L.nucTop} width={AW - 48} height={L.nucBottom - L.nucTop} rx={46} fill={NUC_TINT} stroke={NUC} strokeWidth={1.75} strokeDasharray="38 5" />
      <rect x={29} y={L.nucTop + 5} width={AW - 58} height={L.nucBottom - L.nucTop - 10} rx={41} fill="none" stroke={NUC} strokeOpacity={0.55} strokeWidth={1} strokeDasharray="38 5" />
      <Text x={AW - 40} y={L.nucBottom - 18} anchor="end" size={9} colour={NUC} weight={600} spacing={0.6}>
        NUCLEUS
      </Text>
      {/* The chain. */}
      <DownArrow x={cx} y1={L.receptor.y + R - 4} y2={(L.chain[0] ?? L.nucTop + 22) - 4} />
      {p.chain.map((step, i) => {
        const y = L.chain[i] ?? 0
        const next = L.chain[i + 1] ?? (L.nuclear[0] ?? 0)
        return (
          <g key={step.name}>
            <Space step={step} x={cx - S / 2} y={y} size={S} />
            <NameBeside step={step} x={labelX} y={y + S / 2} />
            <DownArrow x={cx} y1={y + S + 4} y2={next - 4} />
          </g>
        )
      })}
      {p.nucleus.map((step, i) => {
        const y = L.nuclear[i] ?? 0
        const next = L.nuclear[i + 1]
        return (
          <g key={step.name}>
            <Space step={step} x={cx - S / 2} y={y} size={S} />
            <NameBeside step={step} x={labelX} y={y + S / 2} />
            {next !== undefined && <DownArrow x={cx} y1={y + S + 4} y2={next - 4} />}
          </g>
        )
      })}
      {selected && (
        <g>
          <SelectionBox x={4} y={4} w={AW - 8} h={L.h - 8} />
          {/* Between the last chain step and the nucleus: add a step there. */}
          <RoundButton x={cx + 22} y={lastChainY + S + L.arrow / 2} />
          {all.map((step, i) =>
            step.minus ? <RoundButton key={step.name} minus x={labelX + step.name.length * 6.4 + 14} y={(L.chain[i] ?? 0) + S / 2 - 7} /> : null,
          )}
        </g>
      )}
    </svg>
  )
}

/* ---------- B · Flow cards ---------- */

const BW = 340

function cardsLayout(p: Pathway) {
  const cw = 196
  const ch = 50
  const arrow = 30
  const x = (BW - cw) / 2
  const ligand = 14
  const membrane = ligand + ch + arrow + ch / 2
  const receptor = membrane - ch / 2
  let y = receptor + ch + arrow
  const chain = p.chain.map(() => {
    const at = y
    y += ch + arrow
    return at
  })
  const nucTop = y + 6
  y = nucTop + 26
  const nuclear = p.nucleus.map(() => {
    const at = y
    y += ch + arrow
    return at
  })
  const nucBottom = y - arrow + 14
  return { cw, ch, arrow, x, ligand, membrane, receptor, chain, nucTop, nuclear, nucBottom, h: nucBottom + 12 }
}

function FlowCard({ step, x, y, w, h, tinted = false }: { step: Step; x: number; y: number; w: number; h: number; tinted?: boolean }) {
  const s = h - 12
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={10} fill={tinted ? TINT : '#fff'} stroke={BLUE} strokeWidth={1.25} />
      <Space step={step} x={x + 6} y={y + 6} size={s} />
      {step.role ? (
        <g>
          <Text x={x + s + 16} y={y + h / 2 - 7} size={12} weight={600}>
            {step.name}
          </Text>
          <Text x={x + s + 16} y={y + h / 2 + 9} size={10} colour={MUTED}>
            {step.role}
          </Text>
        </g>
      ) : (
        <Text x={x + s + 16} y={y + h / 2} size={12} weight={600}>
          {step.name}
        </Text>
      )}
    </g>
  )
}

function FlowCards({ p, selected = false, card = false }: { p: Pathway; selected?: boolean; card?: boolean }) {
  const L = cardsLayout(p)
  const mid = BW / 2
  const verbX = mid + 10
  const arrowWithVerb = (from: number, to: number, verb: string | undefined, key: string) => (
    <g key={key}>
      <DownArrow x={mid} y1={from + 3} y2={to - 3} />
      {verb && !card && (
        <Text x={verbX} y={Math.min((from + to) / 2, from + 15)} size={10} colour={MUTED} italic>
          {verb}
        </Text>
      )}
    </g>
  )
  const lastChain = L.chain.at(-1) ?? L.receptor
  return (
    <svg viewBox={`0 0 ${BW} ${L.h}`} className={card ? 'h-full w-auto' : 'w-full'}>
      {/* The membrane: just a double rule with its name. */}
      <line x1={10} y1={L.membrane - 2.5} x2={BW - 10} y2={L.membrane - 2.5} stroke="#a1a1aa" strokeWidth={1.25} />
      <line x1={10} y1={L.membrane + 2.5} x2={BW - 10} y2={L.membrane + 2.5} stroke="#a1a1aa" strokeWidth={1.25} />
      <Text x={12} y={L.membrane - 12} size={9} colour={MUTED} spacing={0.6}>
        OUTSIDE
      </Text>
      <Text x={12} y={L.membrane + 13} size={9} colour={MUTED} spacing={0.6}>
        CYTOPLASM
      </Text>
      <Text x={BW - 12} y={L.membrane - 12} anchor="end" size={9} colour={MUTED} spacing={0.6}>
        MEMBRANE
      </Text>
      <FlowCard step={p.ligand} x={L.x} y={L.ligand} w={L.cw} h={L.ch} />
      {arrowWithVerb(L.ligand + L.ch, L.receptor, card ? undefined : 'binds', 'a-lig')}
      <FlowCard step={p.receptor} x={L.x} y={L.receptor} w={L.cw} h={L.ch} tinted />
      {/* The nucleus: a dashed box the last steps sit in. */}
      <rect x={18} y={L.nucTop} width={BW - 36} height={L.nucBottom - L.nucTop} rx={14} fill={NUC_TINT} stroke={NUC} strokeWidth={1.25} strokeDasharray="5 4" />
      <Text x={30} y={L.nucTop + 13} size={9} colour={NUC} weight={600} spacing={0.8}>
        NUCLEUS
      </Text>
      {arrowWithVerb(L.receptor + L.ch, L.chain[0] ?? L.nuclear[0] ?? 0, p.receptor.verb, 'a-rec')}
      {p.chain.map((step, i) => {
        const y = L.chain[i] ?? 0
        const next = L.chain[i + 1] ?? L.nuclear[0] ?? 0
        return (
          <g key={step.name}>
            <FlowCard step={step} x={L.x} y={y} w={L.cw} h={L.ch} />
            {arrowWithVerb(y + L.ch, next, step.verb, `a-${step.name}`)}
          </g>
        )
      })}
      {p.nucleus.map((step, i) => {
        const y = L.nuclear[i] ?? 0
        const next = L.nuclear[i + 1]
        return (
          <g key={step.name}>
            <FlowCard step={step} x={L.x} y={y} w={L.cw} h={L.ch} />
            {next !== undefined && arrowWithVerb(y + L.ch, next, step.verb, `a-${step.name}`)}
          </g>
        )
      })}
      {selected && (
        <g>
          <SelectionBox x={4} y={4} w={BW - 8} h={L.h - 8} />
          <RoundButton x={mid - 22} y={lastChain + L.ch + L.arrow / 2} />
          {p.chain.map((step, i) => (step.minus ? <RoundButton key={step.name} minus x={L.x + L.cw} y={L.chain[i] ?? 0} /> : null))}
        </g>
      )}
    </svg>
  )
}

/* ---------- C · Compartments ---------- */

const CW = 340

function bandsLayout(p: Pathway) {
  const cx = 128
  const S = 56
  const R = 76
  const arrow = 28
  const rail = 30
  const ligand = { y: 12, size: 46 }
  const memTop = ligand.y + ligand.size + 16
  const receptor = { y: memTop - 2, size: R }
  const memBottom = memTop + R - 4
  let y = memBottom + arrow
  const chain = p.chain.map(() => {
    const at = y
    y += S + arrow
    return at
  })
  const nucTop = y - arrow / 2 - 2
  y = nucTop + arrow / 2 + 4
  const nuclear = p.nucleus.map(() => {
    const at = y
    y += S + arrow
    return at
  })
  const h = y - arrow + 14
  return { cx, S, R, arrow, rail, ligand, memTop, memBottom, receptor, chain, nucTop, nuclear, h }
}

/** A compartment's name, turned, in the left rail. */
function RailName({ name, top, bottom, colour }: { name: string; top: number; bottom: number; colour: string }) {
  const y = (top + bottom) / 2
  return (
    <text x={15} y={y} transform={`rotate(-90 15 ${y})`} textAnchor="middle" dominantBaseline="middle" fontFamily={FONT} fontSize={8.5} fontWeight={600} letterSpacing={0.8} fill={colour}>
      {name}
    </text>
  )
}

function Compartments({ p, selected = false, card = false }: { p: Pathway; selected?: boolean; card?: boolean }) {
  const L = bandsLayout(p)
  const { cx, S, R } = L
  const labelX = cx + S / 2 + 16
  const firstChain = L.chain[0] ?? L.nucTop
  const lastChain = L.chain.at(-1) ?? L.receptor.y
  return (
    <svg viewBox={`0 0 ${CW} ${L.h}`} className={card ? 'h-full w-auto' : 'w-full'}>
      {/* Bands, full width; the rail on the left names them. */}
      <rect x={0} y={0} width={CW} height={L.memTop} fill="#fafafa" />
      <rect x={0} y={L.memTop} width={CW} height={L.memBottom - L.memTop} fill="#f6efdc" />
      <line x1={0} y1={L.memTop} x2={CW} y2={L.memTop} stroke={LIPID_EDGE} strokeWidth={1} />
      <line x1={0} y1={L.memBottom} x2={CW} y2={L.memBottom} stroke={LIPID_EDGE} strokeWidth={1} />
      <rect x={0} y={L.memBottom} width={CW} height={L.nucTop - L.memBottom} fill="#eef5fa" />
      <rect x={0} y={L.nucTop} width={CW} height={L.h - L.nucTop} fill={NUC_TINT} />
      <line x1={0} y1={L.nucTop} x2={CW} y2={L.nucTop} stroke={NUC} strokeOpacity={0.5} strokeWidth={1} strokeDasharray="4 3" />
      <line x1={L.rail} y1={0} x2={L.rail} y2={L.h} stroke="#e4e4e7" />
      <RailName name="OUTSIDE" top={0} bottom={L.memTop} colour={MUTED} />
      <RailName name="MEMBRANE" top={L.memTop} bottom={L.memBottom} colour="#9a7b35" />
      <RailName name="CYTOPLASM" top={L.memBottom} bottom={L.nucTop} colour={BLUE} />
      <RailName name="NUCLEUS" top={L.nucTop} bottom={L.h} colour={NUC} />
      <Space step={p.ligand} x={cx - L.ligand.size / 2} y={L.ligand.y} size={L.ligand.size} />
      <NameBeside step={p.ligand} x={labelX} y={L.ligand.y + L.ligand.size / 2} />
      <Space step={p.receptor} x={cx - R / 2} y={L.receptor.y} size={R} />
      <NameBeside step={p.receptor} x={labelX + 10} y={L.receptor.y + R / 2} />
      <Chevron x={cx} y1={L.receptor.y + R - 4} y2={firstChain - 4} />
      {p.chain.map((step, i) => {
        const y = L.chain[i] ?? 0
        const next = L.chain[i + 1] ?? L.nuclear[0] ?? 0
        return (
          <g key={step.name}>
            <Space step={step} x={cx - S / 2} y={y} size={S} />
            <NameBeside step={step} x={labelX} y={y + S / 2} />
            <Chevron x={cx} y1={y + S + 4} y2={next - 4} />
          </g>
        )
      })}
      {p.nucleus.map((step, i) => {
        const y = L.nuclear[i] ?? 0
        const next = L.nuclear[i + 1]
        return (
          <g key={step.name}>
            <Space step={step} x={cx - S / 2} y={y} size={S} />
            <NameBeside step={step} x={labelX} y={y + S / 2} />
            {next !== undefined && <Chevron x={cx} y1={y + S + 4} y2={next - 4} />}
          </g>
        )
      })}
      {selected && (
        <g>
          <SelectionBox x={2} y={2} w={CW - 4} h={L.h - 4} />
          <RoundButton x={cx + 26} y={lastChain + S + L.arrow / 2} />
          {p.chain.map((step, i) => (step.minus ? <RoundButton key={step.name} minus x={labelX + step.name.length * 6.4 + 14} y={(L.chain[i] ?? 0) + S / 2 - 7} /> : null))}
        </g>
      )}
      {card && <rect x={0} y={0} width={CW} height={L.h} fill="none" />}
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
      <span className="flex aspect-[3/2] w-full items-center justify-center overflow-hidden rounded-sm bg-white p-1">{children}</span>
      <span className="text-xs leading-tight">{name}</span>
    </figure>
  )
}

type Look = 'cutout' | 'cards' | 'bands'

function Draw({ look, p, selected, card }: { look: Look; p: Pathway; selected?: boolean; card?: boolean }) {
  if (look === 'cutout') return <CellCutout p={p} selected={selected} card={card} />
  if (look === 'cards') return <FlowCards p={p} selected={selected} card={card} />
  return <Compartments p={p} selected={selected} card={card} />
}

const VERSIONS: { look: Look; title: string; note: string; selectedNote: string }[] = [
  {
    look: 'cutout',
    title: 'A · Cell cutout',
    note: 'Drawn like a textbook page: a lipid bilayer across the top with the receptor sitting in it, the molecules as bare icons on thin arrows, the last steps inside a double-walled nucleus. The most pictorial of the three.',
    selectedNote:
      'The + between the last step and the nucleus adds an empty step there (also Add step in the bar); hovering a name shows its −. A step dragged into the nucleus moves inside it. Resizing makes the bilayer longer and the nucleus wider, never stretched.',
  },
  {
    look: 'cards',
    title: 'B · Flow cards',
    note: 'No biology drawn: each molecule is a card with its icon, name and role, and each arrow can carry a short verb (activates, phosphorylates). The membrane is a plain double rule, the nucleus a dashed box. Reads like a diagram in a review paper.',
    selectedNote: 'Same + and − as A. The verbs are typed in the properties (or double-click one) and can be turned off as a whole.',
  },
  {
    look: 'bands',
    title: 'C · Compartments',
    note: 'The block is cut into bands, Outside, Membrane, Cytoplasm and Nucleus, named down the left edge, so it is clear at a glance where each molecule acts. Bare icons on short, fat chevron arrows.',
    selectedNote: 'Same + and − as A. The Cytoplasm band grows as steps are added; dragging a step across a band line moves it into that compartment.',
  },
]

function Version({ look, title, note, selectedNote }: (typeof VERSIONS)[number]) {
  return (
    <section className="flex flex-col gap-4 border-b border-border p-6">
      <header>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="max-w-4xl text-sm text-muted-foreground">{note}</p>
      </header>
      <div className="grid grid-cols-[160px_minmax(0,320px)_minmax(0,320px)_minmax(0,320px)] items-start gap-6">
        <Tile title="Card in the Blocks tool">
          <Card name="Pathway cascade">
            <Draw look={look} p={CARD} card />
          </Card>
        </Tile>
        <Tile title="Just placed">
          <Draw look={look} p={EMPTY} />
        </Tile>
        <Tile title="Filled in">
          <Draw look={look} p={FILLED} />
        </Tile>
        <Tile title="Selected" note={selectedNote}>
          <Draw look={look} p={FILLED} selected />
        </Tile>
      </div>
    </section>
  )
}

/* ---------- Stories ---------- */

export const PathwayCascade: Story = {
  name: 'Pathway cascade · A, B, C',
  render: () => (
    <div className="bg-background text-foreground">
      {VERSIONS.map((v) => (
        <Version key={v.look} {...v} />
      ))}
    </div>
  ),
}

export const SideBySide: Story = {
  name: 'Side by side (filled in)',
  render: () => (
    <div className="grid grid-cols-3 gap-6 bg-background p-6 text-foreground">
      {VERSIONS.map((v) => (
        <Tile key={v.look} title={v.title}>
          <Draw look={v.look} p={FILLED} />
        </Tile>
      ))}
    </div>
  ),
}
