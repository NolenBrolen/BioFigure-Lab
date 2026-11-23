/*
 * The Arrows and Shapes panels in the left panel. Picking a tile turns on its
 * drawing tool; the path and line switches also restyle the selected arrows.
 * The Arrows panel highlights the arrow type while the arrow tool is on or an
 * arrow is selected, and opens on what was picked last. Picking a type while
 * arrows are selected restyles them and keeps them selected.
 * Each is a plain left-panel view, ready to hang off the tool rail.
 *
 * The Arrows panel keeps its tiles while an arrow is selected (the owner's
 * pick, 2026-11-14: the big tiles are the quickest way to change an arrow);
 * they show the selected arrow's path, line and ends, and its colour and
 * opacity sit in label-left rows below them (see ArrowProperties).
 *
 * The Shapes panel turns into the properties of one shape (design F, tried
 * 2026-11-12): selecting a shape, also the one just placed, opens them in
 * place of the tiles, under a header with a back button and the shape's
 * name (the editor screen decides when, for every panel). Picking a tile
 * only turns on its tool; opening the panel turns on the rectangle. Back
 * (which also deselects the shape), or clearing the selection, shows the
 * tiles again.
 */
import { ArrowsPanel } from '@biofigure-lab/ui/components/arrows-panel/ArrowsPanel'
import { ShapePicture, ShapesPanel } from '@biofigure-lab/ui/components/shapes-panel/ShapesPanel'
import { ARROW_PRESETS, DOUBLE_BRACKETS, type ArrowLook, type ShapeKind } from '@biofigure-lab/ui/lib/arrow-geometry'
import { useState, type ReactNode } from 'react'

import type { FigureCanvas, SelectionInfo } from '../editor/FigureCanvas'
import { DEFAULT_ARROW, type DrawChoice, type Tool } from '../editor/shapes'
import { ArrowProperties } from './ArrowProperties'
import { PropertiesHeader } from './properties-pane'
import { ShapeProperties } from './ShapeProperties'

type Props = { figure: FigureCanvas | null; tool: Tool }
type ArrowsProps = Props & {
  /** The selected arrow or line. */
  arrow?: SelectionInfo
}
type ShowsProperties = {
  /** Showing the selected object's properties instead of the tiles. */
  open: boolean
  /** Back to the tiles; also lets go of the object. */
  onBack: () => void
}

/** The panel tile for an arrow look: the preset with the same ends. */
const presetOf = (look: ArrowLook) => ARROW_PRESETS.find((preset) => preset.start === look.start && preset.end === look.end && preset.mid === look.mid)?.id

export function ArrowsView({ figure, tool, arrow }: ArrowsProps) {
  const look = figure?.drawChoice.look ?? DEFAULT_ARROW
  const [route, setRoute] = useState(look.route)
  const [line, setLine] = useState(look.line)
  const [picked, setPicked] = useState(presetOf(look))
  // A selected arrow shows its own path, line and ends in the tiles.
  const own = arrow?.arrowLook
  return (
    <aside aria-label="Arrows" className="flex min-h-0 flex-col overflow-y-auto bg-panel [scrollbar-gutter:stable]">
      <ArrowsPanel
        className="p-3"
        route={own?.route ?? route}
        line={own?.line ?? line}
        onRouteChange={(value) => {
          setRoute(value)
          figure?.setDrawChoice({ look: { route: value } }, true)
        }}
        onLineChange={(value) => {
          setLine(value)
          figure?.setDrawChoice({ look: { line: value } }, true)
        }}
        picked={own ? presetOf(own) : tool === 'arrow' || arrow ? picked : tool === 'line' ? 'line' : undefined}
        onPick={(preset) => {
          setPicked(preset.id)
          const restyled = figure?.setDrawChoice({ look: { start: preset.start, end: preset.end, mid: preset.mid } }, true)
          if (!restyled) figure?.setTool('arrow')
        }}
      />
      {arrow && <ArrowProperties arrow={arrow} usedColours={() => figure?.usedColours() ?? []} onChange={(patch) => figure?.change(patch)} />}
    </aside>
  )
}

/** Shapes that are drawn with their own tools (and their own R and O keys). */
const OWN_TOOLS: Partial<Record<ShapeKind, Tool>> = { rectangle: 'rectangle', ellipse: 'ellipse' }

type ShapesProps = Props & ShowsProperties & {
  /** The selected shape, whose properties the panel opens. */
  shape?: SelectionInfo
  /** What the Shapes panel draws next, with its look. */
  next: DrawChoice
  /** The text sections, while the selected shape holds text. */
  textControls?: ReactNode
}

export function ShapesView({ figure, tool, shape, next, open, onBack, textControls }: ShapesProps) {
  // The Bracket and Double bracket tiles each draw the style picked last for them, curly at first.
  const [bracket, setBracket] = useState<ShapeKind>('brace')
  const [doubleBracket, setDoubleBracket] = useState<ShapeKind>('double-brace')
  const pickedTool = OWN_TOOLS[next.shape] ?? 'shape'
  // R and O turn on the rectangle and ellipse tools, so their tiles light up then too.
  const shown = tool === 'rectangle' || tool === 'ellipse' ? tool : tool === pickedTool ? next.shape : undefined
  return (
    <aside aria-label="Shapes" className="flex min-h-0 flex-col overflow-y-auto bg-panel [scrollbar-gutter:stable]">
      {!(open && shape) ? (
        <ShapesPanel
          className="p-3"
          picked={shown}
          onPick={(picked) => {
            const kind = picked === 'bracket' ? bracket : picked === 'double-bracket' ? doubleBracket : picked
            figure?.setDrawChoice({ shape: kind })
            // The properties open once the shape is placed (and selected), not on picking it.
            figure?.setTool(OWN_TOOLS[kind] ?? 'shape')
          }}
        />
      ) : (
        <>
          <PropertiesHeader backLabel="Back to shapes" picture={shape.shapeKind && <ShapePicture shape={shape.shapeKind} />} name={shape.name} onBack={onBack} />
          <ShapeProperties
            shape={shape}
            next={next}
            textControls={textControls}
            usedColours={() => figure?.usedColours() ?? []}
            onStyle={(patch) => {
              // The next shape takes the look set last, also when it was set on a selected shape.
              if (shape) figure?.change(patch)
              figure?.setDrawChoice({ style: patch })
            }}
            onTextFit={(fit) => {
              if (shape) figure?.setTextFit(fit)
              figure?.setDrawChoice({ style: { textFit: fit } })
            }}
            onTextColour={(colour) => void figure?.changeShapeText({ colour })}
            onBracketStyle={(kind) => {
              if (DOUBLE_BRACKETS.has(kind)) setDoubleBracket(kind)
              else setBracket(kind)
              figure?.setBracketStyle(kind)
            }}
            onShapeKind={(kind) => {
              // With nothing selected it picks the next shape, like its tile.
              if (shape) return figure?.setShapeKind(kind)
              figure?.setDrawChoice({ shape: kind })
              figure?.setTool(OWN_TOOLS[kind] ?? 'shape')
            }}
            onCornerRadius={(radius) => figure?.setCornerRadius(radius)}
            // After the tab has taken the click, so the text cursor keeps the keyboard.
            onTextTab={() => setTimeout(() => figure?.typeInSelectedShape())}
            onTypeText={() => figure?.typeInSelectedShape()}
          />
        </>
      )}
    </aside>
  )
}
