/*
 * The text controls, tied to the figure, in the Text panel on the left (the
 * Shapes panel's label-left rows since 2026-11-14). They
 * change the selected text (or its selected characters while typing); with
 * no text selected, the look of the next new text box. Sizes are shown in
 * points and kept in page pixels.
 */
import type { FontOption } from '@biofigure-lab/ui/components/text-controls/FontPicker'
import { TextControls, type TextControlsValue } from '@biofigure-lab/ui/components/text-controls/TextControls'

import { Button } from '@biofigure-lab/ui/components/button/Button'
import { useExpandedControls } from '@biofigure-lab/ui/lib/expanded-controls'
import { TextCursorInput } from 'lucide-react'

import type { CanvasState, FigureCanvas } from '../editor/FigureCanvas'
import { FONTS, FONT_WEIGHTS, fontStack } from '../editor/fonts'
import type { TextStyle } from '../editor/text-style'
import { EDIT_TEXT } from './mobile-props'
import { OpacityRow, PropRow, PropRows } from './properties-pane'

const PX_PER_PT = 96 / 72

const FONT_OPTIONS: FontOption[] = FONTS.map((font) => ({ name: font.name, category: font.category, family: fontStack(font) }))

/**
 * `forShapes`: the Text tab of the Shapes panel. It styles the selected
 * shape's text (typed in or not) and the next shape's text. `stacked`: the
 * older layout with sections, labels above the controls.
 */
export function TextStyleControls({ figure, style, forShapes, stacked = false, className }: { figure: FigureCanvas | null; style: TextStyle; forShapes?: boolean; stacked?: boolean; className?: string }) {
  const change = (patch: Partial<TextStyle>) => void (forShapes ? figure?.changeShapeText(patch) : figure?.changeText(patch))
  const value: TextControlsValue = { ...style, size: Math.round((style.size / PX_PER_PT) * 10) / 10 }
  return (
    <TextControls
      className={className}
      rows={!stacked}
      usedColours={() => figure?.usedColours() ?? []}
      value={value}
      fonts={FONT_OPTIONS}
      weights={FONT_WEIGHTS}
      onChange={({ size, ...patch }) => change({ ...patch, ...(size !== undefined && { size: size * PX_PER_PT }) })}
      onPreview={(change) => void figure?.previewText(change)}
      onSymbol={(symbol) => figure?.insertSymbol(symbol)}
    />
  )
}

/**
 * The left panel of the Text tool: the next text box's look, or the selected
 * text's. The panel is the text's properties either way, so selecting a text
 * adds no header (the owner's pick, 2026-11-14), only its opacity below.
 */
export function TextView({ figure, state }: { figure: FigureCanvas | null; state: CanvasState }) {
  const text = state.selection?.kind === 'text' ? state.selection : undefined
  const expanded = useExpandedControls()
  return (
    <aside aria-label="Text" className="flex min-h-0 flex-col overflow-y-auto bg-panel [scrollbar-gutter:stable]">
      {/* Phones: the bar's first item starts typing in the selected text when tapped (EditorScreen), as a double tap does (owner's call, 2026-11-17). */}
      {expanded && text && (
        <PropRows>
          <PropRow label={EDIT_TEXT}>
            <Button variant="secondary" className="h-11 w-full" onClick={() => figure?.editSelectedText()}>
              <TextCursorInput className="size-4" aria-hidden="true" />
              Edit text
            </Button>
          </PropRow>
        </PropRows>
      )}
      <TextStyleControls figure={figure} style={state.selection?.text ?? state.newText} className="pb-1.5" />
      {/* Always there, faded out while no text is selected, so it doesn't jump in and out. */}
      <PropRows className="pt-0">
        <OpacityRow opacity={text?.opacity ?? 1} off={!text} onChange={(opacity) => figure?.change({ opacity })} />
      </PropRows>
    </aside>
  )
}
