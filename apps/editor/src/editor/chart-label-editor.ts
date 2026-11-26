/**
 * Renaming a chart's text in place: a double-click on a group name, the
 * title, an axis title or the line under the chart puts a text box right
 * over it. Enter or clicking away keeps the new text; Escape leaves it as it
 * was. The caption (the line under the chart) takes several lines, so there
 * Enter adds a line and Ctrl+Enter keeps it.
 *
 * The text box is the Text tool's own (a Fabric IText), so typing works as in
 * any text: Ctrl/⌘+= makes the selected letters subscript and Ctrl/⌘+Shift+=
 * superscript (BIO-69), through the same code (text-style.ts). When typing
 * ends, the text goes back into the chart with its sub- and superscripts as
 * style runs (chart-text.ts); other looks typed in (bold, colour) are not kept,
 * since the chart sets those for all its text.
 */
import { IText, Point, util, type Canvas } from 'fabric'

import { textBox, TITLE_WEIGHT, type ChartData, type ChartText, type TextRole } from './chart-model'
import type { ChartTextField, ScriptRun } from './chart-text'
import { measureText, type ChartObject } from './ChartObject'
import { scriptLook } from './text-style'

const FIELD_ROLES: readonly ChartTextField[] = ['title', 'xTitle', 'yTitle', 'caption']
const fieldOf = (role: TextRole): ChartTextField | undefined => FIELD_ROLES.find((field) => field === role.kind)

/**
 * The texts a double-click can edit, and what editing one changes. `styles`
 * gives the text its sub- and superscripts too; without it they stay as they
 * were (and move with the text, see `keepScripts`).
 */
export function renameChartText(chart: ChartData, text: ChartText, value: string, styles?: { runs: ScriptRun[] | undefined }): ChartData | undefined {
  const role = text.role
  if (role.kind === 'group') {
    return { ...chart, groups: chart.groups.map((g, i) => (i !== role.index ? g : styles ? { ...g, name: value, nameStyles: styles.runs } : { ...g, name: value })) }
  }
  // A reference line's label is plain text.
  if (role.kind === 'reference') return { ...chart, referenceLines: chart.referenceLines.map((r, i) => (i === role.index ? { ...r, label: value } : r)) }
  const field = fieldOf(role)
  if (!field) return undefined
  return { ...chart, [field]: value, ...(styles ? { textStyles: { ...chart.textStyles, [field]: styles.runs } } : {}) }
}

/** What the text box starts with: the setting itself, not how it's drawn (the y title without its unit, the caption without the test line). */
function startingText(chart: ChartData, role: TextRole): { value: string; runs: ScriptRun[] | undefined } | undefined {
  if (role.kind === 'group') {
    const group = chart.groups[role.index]
    return group && { value: group.name, runs: group.nameStyles }
  }
  if (role.kind === 'reference') {
    const line = chart.referenceLines[role.index]
    return line && { value: line.label, runs: undefined }
  }
  const field = fieldOf(role)
  return field && { value: chart[field], runs: chart.textStyles?.[field] }
}

const indexOf = (role: TextRole) => ('index' in role ? role.index : undefined)
const sameRole = (a: TextRole, b: TextRole) => a.kind === b.kind && indexOf(a) === indexOf(b)

/** The sub- and superscript runs of a text box, in the Text tool's saved form, merged where they touch. */
export function runsOfBox(box: IText): ScriptRun[] | undefined {
  const runs: ScriptRun[] = []
  for (const { start, end, style } of util.stylesToArray(box.styles, box.text)) {
    const script = (style as { script?: unknown }).script
    if (script !== 'sub' && script !== 'super') continue
    const last = runs.at(-1)
    if (last && last.end === start && last.style.script === script) last.end = end
    else runs.push({ start, end, style: { script } })
  }
  return runs.length ? runs : undefined
}

/** Give a text box the sub- and superscripts of saved runs, sized as the Text tool sizes them. */
export function applyRuns(box: IText, runs: readonly ScriptRun[] | undefined): void {
  const size = box.fontSize
  box.styles = util.stylesFromArray(
    (runs ?? []).map((run) => ({ start: run.start, end: run.end, style: scriptLook(run.style.script, size) })),
    box.text,
  )
  box.initDimensions()
}

/** Typing a chart's text in place, in a text box laid over it. */
export class ChartLabelEditor {
  private editing: { chart: ChartObject; role: TextRole; box: IText; value: string; runs: ScriptRun[] | undefined } | undefined
  private readonly canvas: Canvas
  private readonly onApply: (chart: ChartObject, data: ChartData) => void

  constructor(canvas: Canvas, onApply: (chart: ChartObject, data: ChartData) => void) {
    this.canvas = canvas
    this.onApply = onApply
  }

  /** The chart being typed in. */
  get chart(): ChartObject | undefined {
    return this.editing?.chart
  }

  /** Start typing in one of a chart's texts, with all of it selected. */
  start(chart: ChartObject, text: ChartText): IText | undefined {
    this.finish()
    const start = startingText(chart.chart, text.role)
    if (!start) return undefined
    const caption = text.role.kind === 'caption'
    // Centred on everything drawn for this text (a wrapped title has several lines).
    const boxes = chart.drawing().texts.filter((t) => sameRole(t.role, text.role)).map((t) => textBox(t, measureText))
    const left = Math.min(...boxes.map((b) => b.x))
    const top = Math.min(...boxes.map((b) => b.y))
    const right = Math.max(...boxes.map((b) => b.x + b.width))
    const bottom = Math.max(...boxes.map((b) => b.y + b.height))
    const middle = util.transformPoint(new Point((left + right) / 2 - chart.width / 2, (top + bottom) / 2 - chart.height / 2), chart.calcTransformMatrix())
    const box = new IText(start.value, {
      left: middle.x,
      top: middle.y,
      originX: 'center',
      originY: 'center',
      fontFamily: text.font,
      fontSize: text.size * Math.abs(chart.scaleY || 1),
      fontWeight: text.bold ? TITLE_WEIGHT : 400,
      fill: text.colour,
      backgroundColor: '#ffffff',
      textAlign: caption ? 'left' : 'center',
      angle: chart.getTotalAngle(),
      hasControls: false,
      lockMovementX: true,
      lockMovementY: true,
      lockScalingX: true,
      lockScalingY: true,
      lockRotation: true,
      borderDashArray: [3, 3],
      excludeFromExport: true,
    })
    // Kept out of the layers panel and the text panels, like the text box over a shape.
    Object.assign(box, { shapeTextBox: true })
    applyRuns(box, start.runs)
    // Enter keeps the text (Ctrl+Enter in the caption, where Enter adds a line); Escape leaves it as it was.
    const fabricKeyDown = box.onKeyDown.bind(box)
    box.onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || (event.key === 'Enter' && (!caption || event.ctrlKey || event.metaKey))) {
        event.preventDefault()
        event.stopPropagation()
        return this.finish(event.key === 'Enter')
      }
      fabricKeyDown(event)
    }
    box.on('editing:exited', () => this.finish())
    this.editing = { chart, role: text.role, box, ...start }
    chart.editingText = text.role
    chart.set('dirty', true)
    this.canvas.add(box)
    this.canvas.setActiveObject(box)
    box.enterEditing()
    box.selectAll()
    box._updateTextarea()
    this.canvas.requestRenderAll()
    return box
  }

  /** Stop typing: the text and its sub- and superscripts go into the chart (unless `keep` is false), as one undo step. */
  finish(keep = true): void {
    const editing = this.editing
    if (!editing) return
    this.editing = undefined
    const { chart, role, box, value, runs } = editing
    if (box.isEditing) box.exitEditing()
    chart.editingText = undefined
    chart.set('dirty', true)
    const nextRuns = runsOfBox(box)
    const changed = box.text !== value || JSON.stringify(nextRuns ?? []) !== JSON.stringify(runs ?? [])
    const next = keep && changed ? renameChartText(chart.chart, { role } as ChartText, box.text, { runs: nextRuns }) : undefined
    if (next) this.onApply(chart, next)
    // Fabric is still busy with the text box (it ends typing while handling a click), so it goes once Fabric is done.
    setTimeout(() => {
      const reselect = this.canvas.getActiveObject() === box
      this.canvas.remove(box)
      if (reselect && this.canvas.getObjects().includes(chart)) this.canvas.setActiveObject(chart)
      this.canvas.requestRenderAll()
    })
    this.canvas.requestRenderAll()
  }
}
