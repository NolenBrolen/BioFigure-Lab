/*
 * The Shapes tool's icon in the tool rail: a circle behind a rounded square
 * (option F, the owner's pick of 2026-11-14), simpler than Lucide's three
 * shapes. Drawn on Lucide's 24 px grid with its 2 px round line, so it sits
 * with the other rail icons.
 */
import { useId } from 'react'

import { cn } from '../../lib/cn'

export function ShapesToolIcon({ className }: { className?: string }) {
  // The circle is cut away behind the square; each copy of the icon needs its own mask id.
  const mask = useId()
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={cn('size-6', className)}>
      <mask id={mask}>
        <rect width="24" height="24" fill="#fff" stroke="none" />
        <rect x="8" y="8" width="16" height="16" rx="3" fill="#000" stroke="none" />
      </mask>
      <circle cx="9" cy="9" r="6" mask={`url(#${mask})`} />
      <rect x="10" y="10" width="11" height="11" rx="2" />
    </svg>
  )
}
