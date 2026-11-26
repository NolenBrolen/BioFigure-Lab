/*
 * BIO-107 design drafts: the Graphical abstract block. A title across the
 * top and three parts underneath (problem → method → finding), each with a
 * short heading, a space for an icon or a chart, and an optional caption.
 *
 * Visual drafts only: no tests, no accessibility pass, nothing wired up.
 * Every version shows the same things: the block filled in on a page, the
 * block selected (its bar), the block being made wider (it lays itself out
 * again, nothing stretches), and its card in the Blocks tool (empty spaces,
 * as clicking places it).
 *
 *   A  Banner and cards  A filled title bar in the block's colour; three
 *                        outlined cards of equal width, fat arrows between.
 *   B  Chevron flow      A big title with a thin rule under it; the headings
 *                        sit in a row of chevrons that point onward, getting
 *                        darker towards the finding; no boxes round the parts.
 *   C  Spotlight         A pale title strip; numbered steps on a thin line;
 *                        the finding gets a wider, tinted card of its own so
 *                        it is what the eye lands on.
 *
 * The icons are simple drawings in the app's colour-blind-safe colours,
 * standing in for library icons (icons never go into packages/ui).
 */
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Lock, MoreHorizontal, Unlink } from 'lucide-react'
import type { ReactNode } from 'react'

import { QuickActions, type QuickAction, type QuickActionGroup } from '../../components/quick-actions/QuickActions'
import { cn } from '../../lib/cn'

const meta = {
  title: 'Drafts/BIO-107 Graphical abstract',
  parameters: { controls: { disable: true }, layout: 'fullscreen' },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const noop = () => undefined
const SELECT = '#2563eb' // selection blue
const BLUE = '#0072b2' // the blocks' blue
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

type Box = { x: number; y: number; w: number; h: number }

/* ---------- What goes in the spaces ---------- */

type Content = 'tumour' | 'screen' | 'chart' | 'icon-space' | 'chart-space'

/** A tumour cell with a small, worn-out T cell beside it (64 × 64). */
function Tumour() {
  return (
    <>
      <path
        d="M30 8 C40 6 50 12 53 22 C57 30 55 40 49 47 C43 54 32 57 23 52 C14 48 8 39 10 29 C11 19 20 10 30 8 Z"
        fill="#f9dccc"
        stroke="#d55e00"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <circle cx="32" cy="29" r="10" fill="#d55e00" fillOpacity="0.75" />
      <circle cx="22" cy="42" r="3" fill="#d55e00" fillOpacity="0.4" />
      <circle cx="54" cy="52" r="9" fill="#d4ebf7" stroke="#0072b2" strokeWidth="2" />
      <circle cx="55" cy="51" r="5" fill="#56b4e9" fillOpacity="0.6" />
    </>
  )
}

/** A small well plate with a few wells hit (64 × 64). */
function Screen() {
  const wells = []
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 6; c++) {
      const hit = (r === 1 && c === 3) || (r === 2 && c === 1)
      wells.push(<circle key={`${r}-${c}`} cx={13 + c * 7.6} cy={25 + r * 7.6} r="2.8" fill={hit ? '#009e73' : '#d4d4d8'} />)
    }
  }
  return (
    <>
      <path d="M6 17 H54 L58 21 V52 H6 Z" fill="#f4f4f5" stroke="#52525b" strokeWidth="2" strokeLinejoin="round" />
      {wells}
    </>
  )
}

/** A filled graph: two bars with error bars and a significance bracket (96 × 72). */
function Chart() {
  return (
    <>
      <path d="M14 6 V62 H92" stroke={INK} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      {[18, 32, 46].map((y) => (
        <line key={y} x1="11" y1={y} x2="14" y2={y} stroke={INK} strokeWidth="1.25" />
      ))}
      <rect x="26" y="46" width="22" height="16" fill="#a1a1aa" />
      <rect x="60" y="20" width="22" height="42" fill={BLUE} />
      <path d="M37 41 V51 M33 41 H41 M71 13 V27 M67 13 H75" stroke={INK} strokeWidth="1.25" />
      <path d="M37 9 V6 H71 V9" stroke={INK} strokeWidth="1" fill="none" />
      <text x="54" y="4" textAnchor="middle" fontFamily={FONT} fontSize="8" fontWeight="700" fill={INK}>
        ***
      </text>
      <text x="37" y="70" textAnchor="middle" fontFamily={FONT} fontSize="7" fill={GREY}>
        Vehicle
      </text>
      <text x="71" y="70" textAnchor="middle" fontFamily={FONT} fontSize="7" fill={GREY}>
        Drug X
      </text>
    </>
  )
}

/** An empty icon space: dashed box, faded cell, cut-out "+" badge (64 × 64). */
function IconSpace({ colour }: { colour: string }) {
  return (
    <>
      <rect x="2" y="2" width="60" height="60" rx="8" fill={wash(colour, 0.05)} stroke={colour} strokeOpacity="0.6" strokeWidth="2" strokeDasharray="6 4" />
      <circle cx="32" cy="32" r="14" fill={wash(colour, 0.2)} />
      <circle cx="45" cy="45" r="9" fill={colour} stroke="#ffffff" strokeWidth="3" />
      <path d="M40.5 45 h9 M45 40.5 v9" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
    </>
  )
}

/** An empty chart space, as ContentSpace draws it (96 × 72). */
function ChartSpace() {
  const s = 30
  const x = 48 - s / 2
  const y = 36 - s / 2
  return (
    <>
      <rect x="0.5" y="0.5" width="95" height="71" rx="6" fill={wash(GREY, 0.05)} stroke={wash(GREY, 0.4)} strokeDasharray="3 3" />
      <path d={`M ${x} ${y} V ${y + s} H ${x + s}`} stroke={wash(GREY, 0.4)} strokeWidth="1.25" fill="none" strokeLinecap="round" />
      {[0.45, 0.8, 0.6].map((v, i) => (
        <rect key={i} x={x + s * (0.14 + i * 0.29)} y={y + s * (1 - v)} width={s * 0.18} height={s * v - 1.5} rx="1" fill={wash(GREY, 0.22)} />
      ))}
      <circle cx={x + s + 2} cy={y + s - 2} r="6" fill={wash(GREY, 0.05)} />
      <circle cx={x + s + 2} cy={y + s - 2} r="4.5" fill={wash(GREY, 0.45)} />
      <path d={`M ${x + s - 0.5} ${y + s - 2} h5 M ${x + s + 2} ${y + s - 4.5} v5`} stroke="#ffffff" strokeWidth="1.25" strokeLinecap="round" />
    </>
  )
}

/** The size a content takes: icons 64 × 64, charts 96 × 72. */
const contentSize = (c: Content) => (c === 'chart' || c === 'chart-space' ? { w: 96, h: 72 } : { w: 64, h: 64 })

/** Draws a content centred on (cx, cy), `k` times its own size. */
function Fill({ content, cx, cy, k = 1, colour = BLUE }: { content: Content; cx: number; cy: number; k?: number; colour?: string }) {
  const { w, h } = contentSize(content)
  return (
    <g transform={`translate(${cx - (w * k) / 2} ${cy - (h * k) / 2}) scale(${k})`}>
      {content === 'tumour' && <Tumour />}
      {content === 'screen' && <Screen />}
      {content === 'chart' && <Chart />}
      {content === 'icon-space' && <IconSpace colour={colour} />}
      {content === 'chart-space' && <ChartSpace />}
    </g>
  )
}

function Text({ x, y, children, anchor = 'middle', weight = 600, colour = INK, size = 12, upper, italic }: { x: number; y: number; children: ReactNode; anchor?: 'start' | 'middle' | 'end'; weight?: number; colour?: string; size?: number; upper?: boolean; italic?: boolean }) {
  return (
    <text x={x} y={y} textAnchor={anchor} dominantBaseline="middle" fontFamily={FONT} fontSize={size} fontWeight={weight} fill={colour} letterSpacing={upper ? 0.8 : 0} fontStyle={italic ? 'italic' : 'normal'}>
      {upper && typeof children === 'string' ? children.toUpperCase() : children}
    </text>
  )
}

/* ---------- The abstract's words ---------- */

type Part = { heading: string; content: Content; caption?: string }
type Abstract = { title: string; parts: [Part, Part, Part] }

const FILLED: Abstract = {
  title: 'Drug X restores T-cell killing in solid tumours',
  parts: [
    { heading: 'Problem', content: 'tumour', caption: 'Tumours wear out T cells' },
    { heading: 'Method', content: 'screen', caption: 'Screen of 1,200 compounds' },
    { heading: 'Finding', content: 'chart', caption: 'Killing up 3× in mice' },
  ],
}
const EMPTY: Abstract = {
  title: 'Title of your study',
  parts: [
    { heading: 'Problem', content: 'icon-space', caption: 'Caption' },
    { heading: 'Method', content: 'icon-space', caption: 'Caption' },
    { heading: 'Finding', content: 'chart-space', caption: 'Caption' },
  ],
}

/* ---------- The three versions ---------- */

type DrawOptions = { abstract: Abstract; width?: number; captions?: boolean }
type Drawn = { width: number; height: number; body: ReactNode }
type Version = (o: DrawOptions) => Drawn

const WIDTH = 600

/** A fat right-pointing arrow, its middle at (cx, cy). */
function FatArrow({ cx, cy, w, colour }: { cx: number; cy: number; w: number; colour: string }) {
  const shaft = 10
  const head = 24
  const neck = cx + w / 2 - 12
  const l = cx - w / 2
  const r = cx + w / 2
  return <path d={`M ${l} ${cy - shaft / 2} H ${neck} V ${cy - head / 2} L ${r} ${cy} L ${neck} ${cy + head / 2} V ${cy + shaft / 2} H ${l} Z`} fill={colour} strokeLinejoin="round" />
}

/** A · Banner and cards: filled title bar, three equal outlined cards, fat arrows in the gaps. */
const bannerCards: Version = ({ abstract, width = WIDTH, captions = true }) => {
  const colour = BLUE
  const bar = 40
  const below = 14
  const gap = 40
  const cardW = (width - 2 * gap) / 3
  const cardH = captions ? 168 : 146
  const top = bar + below
  const cards: Box[] = [0, 1, 2].map((i) => ({ x: i * (cardW + gap), y: top, w: cardW, h: cardH }))
  return {
    width,
    height: top + cardH,
    body: (
      <>
        <rect x="0" y="0" width={width} height={bar} rx="8" fill={colour} />
        <Text x={width / 2} y={bar / 2 + 0.5} colour="#ffffff" size={15} weight={700}>
          {abstract.title}
        </Text>
        {cards.map((box, i) => {
          const part = abstract.parts[i]
          const spaceY = box.y + 34 + (cardH - 34 - (captions ? 30 : 8)) / 2
          return (
            <g key={i}>
              <rect x={box.x} y={box.y} width={box.w} height={box.h} rx="10" fill="#ffffff" stroke={colour} strokeWidth="1.5" />
              <Text x={box.x + box.w / 2} y={box.y + 20} colour={shade(colour, 0.85)} size={13} weight={700}>
                {part.heading}
              </Text>
              <Fill content={part.content} cx={box.x + box.w / 2} cy={spaceY} colour={colour} />
              {captions && part.caption && (
                <Text x={box.x + box.w / 2} y={box.y + box.h - 18} colour={GREY} size={11} weight={400}>
                  {part.caption}
                </Text>
              )}
              {i < 2 && <FatArrow cx={box.x + box.w + gap / 2} cy={box.y + box.h / 2} w={gap - 12} colour={colour} />}
            </g>
          )
        })}
      </>
    ),
  }
}

/** B · Chevron flow: big title with a rule, headings in a row of chevrons, parts on open white. */
const chevronFlow: Version = ({ abstract, width = WIDTH, captions = true }) => {
  const colour = BLUE
  const titleH = 30
  const ruleY = titleH + 6
  const chevY = ruleY + 16
  const chevH = 30
  const point = 14
  const gap = 4
  const segW = (width - 2 * gap) / 3
  const contentTop = chevY + chevH + 14
  const contentH = 86
  const height = contentTop + contentH + (captions ? 26 : 0)
  const tints = [0.45, 0.72, 1]
  return {
    width,
    height,
    body: (
      <>
        <Text x={0} y={titleH / 2} anchor="start" colour={INK} size={19} weight={700}>
          {abstract.title}
        </Text>
        <line x1="0" y1={ruleY} x2={width} y2={ruleY} stroke={colour} strokeWidth="2" />
        {[0, 1, 2].map((i) => {
          const part = abstract.parts[i]
          const x = i * (segW + gap)
          const notch = i === 0 ? 0 : point
          const tip = i === 2 ? 0 : point
          const d = `M ${x} ${chevY} H ${x + segW - tip} L ${x + segW} ${chevY + chevH / 2} L ${x + segW - tip} ${chevY + chevH} H ${x} L ${x + notch} ${chevY + chevH / 2} Z`
          const fill = wash(colour, tints[i] ?? 1)
          const mid = x + segW / 2 + (notch - tip) / 4
          return (
            <g key={i}>
              <path d={d} fill={fill} strokeLinejoin="round" />
              <Text x={mid} y={chevY + chevH / 2 + 0.5} colour={i === 0 ? shade(colour, 0.55) : '#ffffff'} size={12} weight={700} upper>
                {part.heading}
              </Text>
              <Fill content={part.content} cx={x + segW / 2} cy={contentTop + contentH / 2} colour={colour} />
              {captions && part.caption && (
                <Text x={x + segW / 2} y={contentTop + contentH + 14} colour={INK} size={11} weight={400}>
                  {part.caption}
                </Text>
              )}
            </g>
          )
        })}
      </>
    ),
  }
}

/** C · Spotlight: pale title strip, numbered steps on a line, the finding in a wider tinted card. */
const spotlight: Version = ({ abstract, width = WIDTH, captions = true }) => {
  const colour = BLUE
  const strip = 36
  const top = strip + 18
  const findingShare = 0.42
  const findingW = width * findingShare
  const sideW = (width - findingW - 24) / 2
  const cardH = captions ? 170 : 148
  const lineY = top + 18
  const columns: Box[] = [
    { x: 0, y: top, w: sideW, h: cardH },
    { x: sideW + 12, y: top, w: sideW, h: cardH },
    { x: width - findingW, y: top, w: findingW, h: cardH },
  ]
  return {
    width,
    height: top + cardH,
    body: (
      <>
        <rect x="0" y="0" width={width} height={strip} rx="6" fill={wash(colour, 0.1)} />
        <rect x="0" y="0" width="5" height={strip} rx="2" fill={colour} />
        <Text x={16} y={strip / 2 + 0.5} anchor="start" colour={shade(colour, 0.7)} size={15} weight={700}>
          {abstract.title}
        </Text>
        {/* The finding's card first, so the line and badges sit on it. */}
        <rect x={columns[2].x} y={top} width={findingW} height={cardH} rx="12" fill={wash(colour, 0.1)} stroke={colour} strokeWidth="2" />
        {columns.map((box, i) => {
          const part = abstract.parts[i]
          const finding = i === 2
          const badgeX = box.x + 16
          const k = finding ? 1.25 : 1
          const contentMid = top + 36 + (cardH - 36 - (captions ? 30 : 8)) / 2
          return (
            <g key={i}>
              <circle cx={badgeX} cy={lineY} r="11" fill={finding ? colour : '#ffffff'} stroke={colour} strokeWidth="1.5" />
              <Text x={badgeX} y={lineY + 0.5} colour={finding ? '#ffffff' : colour} size={11} weight={700}>
                {String(i + 1)}
              </Text>
              <Text x={badgeX + 17} y={lineY + 0.5} anchor="start" colour={finding ? shade(colour, 0.7) : INK} size={finding ? 14 : 12} weight={700}>
                {part.heading}
              </Text>
              {i < 2 &&
                (() => {
                  // A thin arrow from after this heading to the next badge.
                  const from = badgeX + 17 + part.heading.length * 7.4 + 8
                  const to = (columns[i + 1]?.x ?? 0) + 16 - 15
                  const line = wash(colour, 0.6)
                  return (
                    <g>
                      <line x1={from} y1={lineY} x2={to} y2={lineY} stroke={line} strokeWidth="1.5" />
                      <path d={`M ${to - 6} ${lineY - 4} L ${to} ${lineY} L ${to - 6} ${lineY + 4}`} stroke={line} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </g>
                  )
                })()}
              <Fill content={part.content} cx={box.x + box.w / 2} cy={contentMid} k={k} colour={colour} />
              {captions && part.caption && (
                <Text x={box.x + box.w / 2} y={top + cardH - 18} colour={finding ? shade(colour, 0.7) : GREY} size={finding ? 12 : 11} weight={finding ? 600 : 400}>
                  {part.caption}
                </Text>
              )}
            </g>
          )
        })}
      </>
    ),
  }
}

/* ---------- Showing a block ---------- */

/** Resize handles on a box: the side and corner squares Fabric draws. */
function Handles({ box, dashed }: { box: Box; dashed?: boolean }) {
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
      <rect x={box.x - 4} y={box.y - 4} width={box.w + 8} height={box.h + 8} fill="none" stroke={SELECT} strokeWidth="1" strokeDasharray={dashed ? '3 3' : undefined} />
      {points.map(([px, py], i) => (
        <rect key={i} x={box.x - 4 + (box.w + 8) * (px ?? 0) - 4} y={box.y - 4 + (box.h + 8) * (py ?? 0) - 4} width="8" height="8" rx="1.5" fill="#ffffff" stroke={SELECT} strokeWidth="1" />
      ))}
    </g>
  )
}

function Block({ version, abstract, width, captions, selected, resizing }: DrawOptions & { version: Version; selected?: boolean; resizing?: boolean }) {
  const d = version({ abstract, width, captions })
  const margin = 12
  const whole: Box = { x: 0, y: 0, w: d.width, h: d.height }
  return (
    <svg width={d.width + 2 * margin} height={d.height + 2 * margin} viewBox={`${-margin} ${-margin} ${d.width + 2 * margin} ${d.height + 2 * margin}`} aria-hidden="true" className="overflow-visible">
      {d.body}
      {(selected || resizing) && <Handles box={whole} />}
      {resizing && (
        <g transform={`translate(${d.width + 4} ${d.height / 2})`}>
          <path d="M 6 0 h 14 m 0 0 l -5 -5 m 5 5 l -5 5" stroke={SELECT} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}
    </svg>
  )
}

const LOCK: QuickAction = { id: 'lock', label: 'Lock', icon: Lock, onClick: noop }
const MORE: QuickAction = { id: 'more', label: 'More actions', icon: MoreHorizontal, onClick: noop }

function abstractBar() {
  const own: QuickAction[] = [{ id: 'detach', label: 'Detach', icon: Unlink, onClick: noop }]
  const groups: QuickActionGroup[] = [{ id: 'own', actions: own }, { id: 'lock', actions: [LOCK] }, { id: 'more', actions: [MORE] }]
  return <QuickActions label="Graphical abstract actions" groups={groups} showLabels />
}

/** A grey stretch of canvas holding a white page. */
function Canvas({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-col items-center justify-center gap-3 rounded-lg bg-neutral-100 p-5 dark:bg-neutral-800', className)}>{children}</div>
}

function Page({ children }: { children: ReactNode }) {
  return <div className="rounded-sm bg-white p-5 shadow-sm">{children}</div>
}

/** The card's picture: the block with empty spaces, scaled to a 3:2 card. */
function CardPicture({ version }: { version: Version }) {
  const d = version({ abstract: EMPTY })
  return (
    <svg viewBox={`-8 -8 ${d.width + 16} ${d.height + 16}`} width="100%" height="100%" aria-hidden="true">
      {d.body}
    </svg>
  )
}

/** The Blocks tool's new "Graphical abstract" heading with its card. */
function BlocksSection({ version }: { version: Version }) {
  return (
    <div className="w-[260px] rounded-lg border bg-panel p-3">
      <h3 className="pb-2 text-xs font-medium text-muted-foreground">Graphical abstract</h3>
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2 flex flex-col gap-1.5 rounded-md border border-border-strong bg-panel p-1.5 text-muted-foreground">
          <span className="flex aspect-[2/1] w-full items-center justify-center overflow-hidden rounded-sm bg-white p-1.5">
            <CardPicture version={version} />
          </span>
          <span className="text-xs leading-tight">Problem → Method → Finding</span>
        </div>
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
        <p className="mt-1 max-w-[820px] text-xs text-muted-foreground">{about}</p>
      </header>
      <div className="flex flex-wrap items-stretch gap-5">
        <div className="flex flex-col gap-2">
          <div className="section-label">On the page</div>
          <Canvas className="min-h-[300px]">
            <Page>
              <Block version={version} abstract={FILLED} />
            </Page>
          </Canvas>
        </div>
        <div className="flex flex-col gap-2">
          <div className="section-label">Blocks tool</div>
          <Canvas className="min-h-[300px]">
            <BlocksSection version={version} />
          </Canvas>
        </div>
        <div className="flex flex-col gap-2">
          <div className="section-label">Selected, captions off</div>
          <Canvas className="min-h-[300px]">
            {abstractBar()}
            <Page>
              <Block version={version} abstract={FILLED} captions={false} selected />
            </Page>
          </Canvas>
        </div>
        <div className="flex flex-col gap-2">
          <div className="section-label">Made wider: the parts spread out, nothing stretches</div>
          <Canvas className="min-h-[300px]">
            <Page>
              <Block version={version} abstract={FILLED} width={780} resizing />
            </Page>
          </Canvas>
        </div>
      </div>
    </section>
  )
}

export const Versions: Story = {
  render: () => (
    <div className="flex flex-col gap-6 bg-background p-6 text-foreground">
      <p className="max-w-[820px] text-sm text-muted-foreground">
        A <b>Graphical abstract</b> block: a title across the top and three parts underneath, read left to right (here: the problem, the method, the finding). Each part has a short heading, a space for an icon or a graph, and an
        optional caption line. Title, headings and captions are typed over in the properties; each space is filled like any icon or chart space, and a filled one can be swapped (Replace icon, or a new graph). Placed from the Blocks
        tool, the first two parts start with icon spaces and the third with a chart space. Making the block wider or narrower spreads the parts out or brings them closer; icons, graphs and text keep their size.
      </p>
      <Draft
        letter="A"
        title="Banner and cards"
        version={bannerCards}
        about="A filled title bar in the block's colour, then three outlined cards of the same width, a fat arrow in each gap. Each card has its heading at the top in the colour, the icon or graph in the middle and the caption at the bottom in grey. The closest to the panels and sequences already in the editor."
      />
      <Draft
        letter="B"
        title="Chevron flow"
        version={chevronFlow}
        about="No boxes: a big title with a thin rule in the colour underneath, then the three headings in a row of chevrons that point onward and get darker towards the finding. The icons, graph and captions sit on open white under their chevron. Reads like a journal's graphical abstract; the most room for the pictures."
      />
      <Draft
        letter="C"
        title="Spotlight"
        version={spotlight}
        about="A pale title strip with a stripe in the colour. The parts are numbered steps on one thin line; problem and method stay open and narrow, and the finding gets a wider, tinted card with a filled badge and a bigger graph, so that is where the eye lands. Good when the result is the point."
      />
    </div>
  ),
}
