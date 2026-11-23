/*
 * The editor screen as a static mock-up, to see the look and the components
 * on a real layout. Not the real editor: nothing here is wired up, and it gets
 * replaced by the app in apps/editor. Buttons, icon buttons, text fields, the
 * search field and tooltips are the real components; the rest are stand-ins
 * until those components are built.
 */
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  BringToFront,
  Check,
  ChevronLeft,
  Circle,
  Link2,
  Maximize,
  Minus,
  MousePointer2,
  MoveUpRight,
  Redo2,
  RotateCw,
  SendToBack,
  Square,
  Type,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import type { ReactNode } from 'react'

import { Button } from '../components/button/Button'
import { IconButton } from '../components/icon-button/IconButton'
import { SearchField } from '../components/search-field/SearchField'
import { Skeleton } from '../components/skeleton/Skeleton'
import { Slider } from '../components/slider/Slider'
import { TextField } from '../components/text-field/TextField'
import { MockSwatch } from './mock-controls'
import { BacteriumShape, MacrophageShape, macrophageColours, sampleCategories, type SampleIcon } from './sample-shapes'

export type EditorSampleProps = {
  /** Force light or dark. Leave empty to follow the Storybook toolbar. */
  theme?: 'light' | 'dark'
  className?: string
}

export function EditorSample({ theme, className = 'h-screen w-full' }: EditorSampleProps) {
  return (
    <div
      data-theme={theme}
      className={`grid grid-cols-[var(--panel-left-width)_minmax(0,1fr)_var(--panel-right-width)] grid-rows-[var(--topbar-height)_minmax(0,1fr)] gap-px overflow-hidden bg-border text-sm text-foreground ${className}`}
    >
      <TopBar />
      <IconLibraryPanel />
      <CanvasArea />
      <PropertiesPanel />
    </div>
  )
}

const panelClass = 'bg-panel'

/* --------------------------------------------------------------------------
 * Top bar: back, figure name, Saved on the left; Undo, Redo, Export right.
 * ----------------------------------------------------------------------- */
function TopBar() {
  return (
    <header className={`${panelClass} col-span-3 flex items-center gap-1 px-2`}>
      <IconButton icon={ChevronLeft} label="Back to your figures" />
      <div className="mx-1 h-5 w-px bg-border" />
      <button
        type="button"
        title="Rename"
        className="h-(--control-height) truncate rounded-md px-2 font-medium transition-colors duration-(--duration-instant) hover:bg-accent"
      >
        Phagocytosis sequence
      </button>
      <span className="flex items-center gap-1 text-xs text-muted-foreground" role="status">
        <Check className="size-3.5" strokeWidth={2} />
        Saved
      </span>

      <div className="ml-auto flex items-center gap-1">
        <IconButton icon={Undo2} label="Undo" shortcut="Mod+Z" />
        <IconButton icon={Redo2} label="Redo" shortcut="Mod+Shift+Z" />
        <div className="mx-1 h-5 w-px bg-border" />
        <Button variant="primary">Export</Button>
      </div>
    </header>
  )
}

/* --------------------------------------------------------------------------
 * Left panel: searchable icon library.
 * ----------------------------------------------------------------------- */
function IconLibraryPanel() {
  return (
    <aside aria-label="Icon library" className={`${panelClass} flex min-h-0 flex-col overflow-hidden`}>
      <div className="p-3 pb-2">
        <SearchField label="Search icons" placeholder="Search icons" />
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3 [scrollbar-gutter:stable]">
        {sampleCategories.map((category, index) => (
          <section key={category.name} className="pt-2">
            <div className="flex h-7 items-center justify-between">
              <h3 className="section-label">{category.name}</h3>
              <span className="text-2xs text-muted-foreground tabular-nums">{category.count}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {category.icons.map((icon) => (
                <IconTile key={icon.name} icon={icon} />
              ))}
              {/* The last category is still loading: placeholders the same size as real tiles. */}
              {index === sampleCategories.length - 1 &&
                [0, 1, 2].map((i) => (
                  <div key={i} className="flex flex-col gap-1">
                    <Skeleton className="aspect-square w-full" />
                    <Skeleton shape="text" className="w-3/4" />
                  </div>
                ))}
            </div>
          </section>
        ))}
      </div>
    </aside>
  )
}

function IconTile({ icon: { name, Icon } }: { icon: SampleIcon }) {
  return (
    <button type="button" title={`Add ${name}`} className="group flex min-w-0 flex-col gap-1 text-left">
      <span className="relative grid aspect-square w-full place-items-center rounded-md bg-muted ring-1 ring-transparent transition-colors duration-(--duration-instant) ring-inset group-hover:bg-accent group-hover:ring-border-strong">
        <Icon className="size-3/5" />
      </span>
      <span className="truncate text-2xs text-muted-foreground group-hover:text-foreground">{name}</span>
    </button>
  )
}

/* --------------------------------------------------------------------------
 * Centre: the canvas with the white figure page, tools and zoom controls.
 * ----------------------------------------------------------------------- */
function CanvasArea() {
  return (
    <main aria-label="Canvas" className="relative flex min-h-0 min-w-0 items-center justify-center overflow-hidden bg-canvas">
      {/* The page shrinks to fit when the canvas is narrow, like "zoom to fit". */}
      <div className="flex w-full max-w-[722px] flex-col gap-2 px-8 pb-12">
        <span className="truncate text-xs text-muted-foreground">Figure 1 · double column, 174 × 70 mm</span>
        <SampleFigure />
      </div>

      {/* Bottom row: drawing tools in the middle (a suggestion, not decided yet)
          and zoom controls in the corner. One row, so they never overlap. */}
      <div className="pointer-events-none absolute inset-x-3 bottom-3 grid grid-cols-[1fr_auto_1fr] items-end gap-2">
        <div />
        <div role="toolbar" aria-label="Tools" className="pointer-events-auto flex gap-1 rounded-lg border bg-panel p-1 shadow-md">
          <IconButton icon={MousePointer2} label="Select" shortcut="V" tooltipSide="top" pressed />
          <IconButton icon={Square} label="Rectangle" shortcut="R" tooltipSide="top" />
          <IconButton icon={Circle} label="Ellipse" shortcut="O" tooltipSide="top" />
          <IconButton icon={Minus} label="Line" shortcut="L" tooltipSide="top" />
          <IconButton icon={MoveUpRight} label="Arrow" shortcut="A" tooltipSide="top" />
          <IconButton icon={Type} label="Text" shortcut="T" tooltipSide="top" />
        </div>
        <div className="pointer-events-auto flex items-center gap-1 justify-self-end rounded-lg border bg-panel p-1 shadow-md">
          <IconButton icon={ZoomOut} label="Zoom out" shortcut="Mod+-" tooltipSide="top" />
          <span className="w-11 text-center text-xs tabular-nums">100%</span>
          <IconButton icon={ZoomIn} label="Zoom in" shortcut="Mod+=" tooltipSide="top" />
          <div className="mx-0.5 h-5 w-px bg-border" />
          <IconButton icon={Maximize} label="Fit page" shortcut="Shift+1" tooltipSide="top" />
        </div>
      </div>
    </main>
  )
}

const engulfArms = 'M338 100 C334 84 337 70 345 64 M364 110 C378 106 386 94 384 80'

/** A three-step phagocytosis figure, with the first macrophage selected. */
function SampleFigure() {
  const s = 0.9
  const iconAt = (cx: number, cy: number) => `translate(${cx - 64 * s} ${cy - 64 * s}) scale(${s})`
  const small = (cx: number, cy: number, scale: number) => `translate(${cx - 64 * scale} ${cy - 64 * scale}) scale(${scale})`
  const font = { fontFamily: 'var(--font-sans)' }
  const label = { fontSize: 13, fill: '#1f2937', textAnchor: 'middle' as const, style: font }
  const letter = { fontSize: 15, fontWeight: 700, fill: '#111827', style: font }
  const selection = { stroke: 'var(--selection)' }
  const arrow = (x1: number, x2: number) => (
    <g fill="#4b5563">
      <path d={`M${x1} 120 H${x2 - 8}`} stroke="#4b5563" strokeWidth={2.5} strokeLinecap="round" />
      <path d={`M${x2 - 10} 113 L${x2} 120 L${x2 - 10} 127 Z`} />
    </g>
  )
  const sel = { x: 110 - 64 * s, y: 120 - 64 * s, size: 128 * s }
  const handles = [0, 0.5, 1].flatMap((fx) => [0, 0.5, 1].map((fy) => [fx, fy])).filter(([fx, fy]) => !(fx === 0.5 && fy === 0.5))

  return (
    <svg
      viewBox="0 0 658 265"
      role="img"
      aria-label="Sample figure: a macrophage recognises, engulfs and encloses a bacterium"
      className="h-auto w-full bg-page shadow-(--elevation-page)"
    >
      {/* 1. Recognition */}
      <text x={18} y={30} {...letter}>A</text>
      <g transform={iconAt(110, 120)}>
        <MacrophageShape />
      </g>
      <g transform={small(178, 74, 0.42)}>
        <BacteriumShape />
      </g>
      <text x={115} y={232} {...label}>Recognition</text>
      {arrow(198, 258)}

      {/* 2. Engulfment: the bacterium sinks in and two arms of the membrane reach
          around it. Arm outlines go under the cell and arm fills over it, so the
          outline stays one continuous line. */}
      <text x={238} y={30} {...letter}>B</text>
      <g transform={small(358, 80, 0.42)}>
        <BacteriumShape />
      </g>
      <path d={engulfArms} fill="none" stroke={macrophageColours.stroke} strokeWidth={11} strokeLinecap="round" />
      <g transform={iconAt(329, 126)}>
        <MacrophageShape nucleus={[48, 78]} />
      </g>
      <path d={engulfArms} fill="none" stroke={macrophageColours.fill} strokeWidth={6} strokeLinecap="round" />
      <text x={334} y={232} {...label}>Engulfment</text>
      {arrow(414, 474)}

      {/* 3. Phagosome */}
      <text x={458} y={30} {...letter}>C</text>
      <g transform={iconAt(548, 120)}>
        <MacrophageShape nucleus={[46, 76]} />
      </g>
      <circle cx={566} cy={106} r={17} fill="#fbe7da" stroke={macrophageColours.stroke} strokeWidth={2} strokeDasharray="4 3" />
      <g transform={small(566, 106, 0.24)}>
        <BacteriumShape />
      </g>
      <text x={548} y={232} {...label}>Phagosome</text>

      {/* Selection box around the first macrophage */}
      <g>
        <rect x={sel.x} y={sel.y} width={sel.size} height={sel.size} fill="none" strokeWidth={1.5} style={selection} />
        {handles.map(([fx, fy]) => (
          <rect
            key={`${fx}-${fy}`}
            x={sel.x + fx * sel.size - 4}
            y={sel.y + fy * sel.size - 4}
            width={8}
            height={8}
            rx={1.5}
            fill="#ffffff"
            strokeWidth={1.5}
            style={selection}
          />
        ))}
        <rect x={110 - 34} y={sel.y + sel.size + 8} width={68} height={18} rx={4} style={{ fill: 'var(--selection)' }} />
        <text x={110} y={sel.y + sel.size + 21} fontSize={10.5} fontWeight={500} fill="#ffffff" textAnchor="middle" style={font}>
          30 × 30 mm
        </text>
      </g>
    </svg>
  )
}

/* --------------------------------------------------------------------------
 * Right panel: properties of the selected icon.
 * ----------------------------------------------------------------------- */
function PropertiesPanel() {
  return (
    <aside aria-label="Properties" className={`${panelClass} flex min-h-0 flex-col overflow-y-auto`}>
      <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b px-3">
        <span className="truncate font-medium">Macrophage</span>
      </div>

      <PanelSection title="Position and size">
        <div className="grid grid-cols-2 gap-2">
          <TextField label="X position" hideLabel prefix="X" defaultValue="13.9" suffix="mm" />
          <TextField label="Y position" hideLabel prefix="Y" defaultValue="16.5" suffix="mm" />
          <TextField label="Width" hideLabel prefix="W" defaultValue="30.5" suffix="mm" />
          <TextField label="Height" hideLabel prefix="H" defaultValue="30.5" suffix="mm" />
          <TextField label="Rotation" hideLabel prefix={<RotateCw strokeWidth={1.75} />} defaultValue="0" suffix="°" />
          <div className="flex justify-end">
            <IconButton icon={Link2} label="Keep proportions" pressed />
          </div>
        </div>
      </PanelSection>

      <PanelSection title="Colour">
        <div className="flex flex-col gap-2">
          <PropertyRow label="Fill">
            <TextField
              label="Fill colour"
              hideLabel
              prefix={<MockSwatch colour={macrophageColours.fill} label="Pick fill colour" />}
              defaultValue="F8D3BF"
            />
          </PropertyRow>
          <PropertyRow label="Stroke">
            <div className="flex gap-2">
              <TextField
                label="Stroke colour"
                hideLabel
                prefix={<MockSwatch colour={macrophageColours.stroke} label="Pick stroke colour" />}
                defaultValue="D9895B"
                className="flex-1"
              />
              <TextField label="Stroke width" hideLabel defaultValue="1" suffix="pt" className="w-16" />
            </div>
          </PropertyRow>
          <PropertyRow label="Opacity">
            <Slider label="Opacity" hideLabel defaultValue={80} unit="%" />
          </PropertyRow>
        </div>
      </PanelSection>

      <PanelSection title="Arrange">
        <div className="flex flex-col gap-1">
          <div className="flex gap-1">
            <IconButton icon={AlignStartVertical} label="Align left" />
            <IconButton icon={AlignCenterVertical} label="Align centre" />
            <IconButton icon={AlignEndVertical} label="Align right" />
            <IconButton icon={AlignStartHorizontal} label="Align top" />
            <IconButton icon={AlignCenterHorizontal} label="Align middle" />
            <IconButton icon={AlignEndHorizontal} label="Align bottom" />
          </div>
          <div className="flex gap-1">
            <IconButton icon={BringToFront} label="Bring to front" shortcut="Mod+]" />
            <IconButton icon={SendToBack} label="Send to back" shortcut="Mod+[" />
          </div>
        </div>
      </PanelSection>
    </aside>
  )
}

function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b px-3 pt-2 pb-3">
      <h3 className="section-label flex h-7 items-center">{title}</h3>
      {children}
    </section>
  )
}

function PropertyRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}
