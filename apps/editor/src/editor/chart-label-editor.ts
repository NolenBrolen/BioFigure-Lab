/**
 * Renaming a chart's text in place: a double-click on a group name, the
 * title, an axis title or the line under the chart puts a text box right
 * over it. Enter or clicking away keeps the new text; Escape leaves it as it
 * was. The caption (the line under the chart) takes several lines, so there
 * Enter adds a line and Ctrl+Enter keeps it.
 */
import type { Canvas } from 'fabric'

import type { ChartData, ChartText } from './chart-model'
import type { ChartObject } from './ChartObject'

/** The texts a double-click can edit, and what editing one changes. */
export function renameChartText(chart: ChartData, text: ChartText, value: string): ChartData | undefined {
  const role = text.role
  if (role.kind === 'group') return { ...chart, groups: chart.groups.map((g, i) => (i === role.index ? { ...g, name: value } : g)) }
  if (role.kind === 'title') return { ...chart, title: value }
  if (role.kind === 'yTitle') return { ...chart, yTitle: value }
  if (role.kind === 'xTitle') return { ...chart, xTitle: value }
  if (role.kind === 'caption') return { ...chart, caption: value }
  return undefined
}

/** What the text box starts with: the setting itself, not how it's drawn (the y title without its unit, the caption without the test line). */
function startingText(chart: ChartData, text: ChartText): string | undefined {
  const role = text.role
  if (role.kind === 'group') return chart.groups[role.index]?.name
  if (role.kind === 'title') return chart.title
  if (role.kind === 'yTitle') return chart.yTitle
  if (role.kind === 'xTitle') return chart.xTitle
  if (role.kind === 'caption') return chart.caption
  return undefined
}

export function editChartText(canvas: Canvas, object: ChartObject, text: ChartText, apply: (chart: ChartData) => void): void {
  const value = startingText(object.chart, text)
  const host = canvas.wrapperEl as HTMLElement | undefined
  if (value === undefined || !host) return
  const caption = text.role.kind === 'caption'
  const box = document.createElement(caption ? 'textarea' : 'input')
  const zoom = canvas.getZoom()
  const centre = object.toScreen({ x: caption ? object.chart.width / 2 : text.x, y: text.y - text.size * 0.35 })
  const width = Math.max(caption ? object.chart.width : 90, 60) * zoom
  box.value = value
  box.setAttribute('aria-label', caption ? 'Text under the chart' : 'Chart label')
  Object.assign(box.style, {
    position: 'absolute',
    left: `${centre.x - width / 2}px`,
    top: `${centre.y - text.size * zoom * (caption ? 0.9 : 0.8)}px`,
    width: `${width}px`,
    height: caption ? `${text.size * zoom * 4}px` : `${text.size * zoom * 1.6}px`,
    font: `${text.size * zoom}px ${text.font}`,
    textAlign: caption ? 'left' : 'center',
    color: '#000',
    background: '#fff',
    border: '1.5px solid #2563eb',
    borderRadius: '3px',
    padding: '0 2px',
    outline: 'none',
    zIndex: '10',
    resize: 'none',
  })
  let done = false
  const finish = (keep: boolean) => {
    if (done) return
    done = true
    if (keep && box.value !== value) {
      const next = renameChartText(object.chart, text, box.value)
      if (next) apply(next)
    }
    box.remove()
  }
  ;(box as HTMLElement).addEventListener('keydown', (event) => {
    event.stopPropagation()
    if (event.key === 'Escape') finish(false)
    else if (event.key === 'Enter' && (!caption || event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      finish(true)
    }
  })
  box.addEventListener('blur', () => finish(true))
  host.append(box)
  box.focus()
  box.select()
}
