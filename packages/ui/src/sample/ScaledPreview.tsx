import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Shows a full-size screen (1440 x 900 by default) shrunk to fit the width
 * it's given. The space is reserved up front, so nothing jumps when the
 * scale is worked out. The shrunk copy is for looking only, so it can't be
 * clicked or tabbed into.
 */
export function ScaledPreview({ width = 1440, height = 900, children }: { width?: number; height?: number; children: ReactNode }) {
  const frame = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0)

  useLayoutEffect(() => {
    const element = frame.current
    if (!element) return
    const update = () => setScale(element.clientWidth / width)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [width])

  return (
    <div ref={frame} className="relative w-full overflow-hidden" style={{ aspectRatio: `${width} / ${height}` }}>
      <div
        inert
        className="absolute top-0 left-0 origin-top-left"
        style={{ width, height, transform: `scale(${scale})`, visibility: scale ? 'visible' : 'hidden' }}
      >
        {children}
      </div>
    </div>
  )
}
