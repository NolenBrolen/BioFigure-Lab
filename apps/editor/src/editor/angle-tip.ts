/**
 * The small dark pill that shows an object's angle just below and right of
 * the pointer while it is being rotated (design A, picked 2026-11-16). It is
 * an HTML element over the canvas, so it stays level and sharp and can reach
 * past the page's edge.
 */

/** The angle as shown: whole degrees from 0 to 359. */
export const angleText = (degrees: number) => `${((Math.round(degrees) % 360) + 360) % 360}°`

/** How far the pill sits from the pointer, in screen pixels. */
const OFFSET = { x: 14, y: 16 }

export class AngleTip {
  private readonly element: HTMLDivElement

  constructor(host: HTMLElement) {
    this.element = document.createElement('div')
    this.element.setAttribute('role', 'status')
    Object.assign(this.element.style, {
      position: 'absolute',
      zIndex: '5',
      pointerEvents: 'none',
      whiteSpace: 'nowrap',
      font: '500 12px/1 Inter, system-ui, sans-serif',
      fontVariantNumeric: 'tabular-nums',
      background: '#141821',
      color: '#ffffff',
      padding: '5px 8px',
      borderRadius: '6px',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.18)',
      display: 'none',
    })
    host.append(this.element)
  }

  /** Show `degrees` beside the pointer at (`x`, `y`), in pixels from the canvas's top-left corner. */
  show(degrees: number, x: number, y: number): void {
    Object.assign(this.element.style, { left: `${x + OFFSET.x}px`, top: `${y + OFFSET.y}px`, display: 'block' })
    this.element.textContent = angleText(degrees)
  }

  hide(): void {
    this.element.style.display = 'none'
  }

  dispose(): void {
    this.element.remove()
  }
}
