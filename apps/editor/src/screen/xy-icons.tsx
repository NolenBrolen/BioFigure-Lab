/*
 * Small pictures for an XY chart's settings: the four dot shapes (filled or
 * open), filled / open for the bar toggle, and the y = x line on and off.
 * Drawn on a 24 × 24 grid in the text colour, like the Lucide icons around them.
 */
import type { DotShape } from '../editor/chart-model'

type IconProps = { className?: string; strokeWidth?: number; 'aria-hidden'?: 'true' }

/** One dot shape, centred, filled with the text colour or open (outline only). */
function DotPath({ shape, filled }: { shape: DotShape; filled: boolean }) {
  const paint = { fill: filled ? 'currentColor' : 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinejoin: 'round' as const }
  if (shape === 'circle') return <circle cx="12" cy="12" r="6" {...paint} />
  if (shape === 'square') return <rect x="6.5" y="6.5" width="11" height="11" {...paint} />
  if (shape === 'triangle') return <path d="M12 5.5 19 17.5H5Z" {...paint} />
  return <path d="M12 4.5 19.5 12 12 19.5 4.5 12Z" {...paint} />
}

/** An icon component for one shape, for the segmented toggle. */
export const dotShapeIcon = (shape: DotShape, filled: boolean) =>
  function DotShapeIcon({ className }: IconProps) {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <DotPath shape={shape} filled={filled} />
      </svg>
    )
  }

export const FilledDotIcon = dotShapeIcon('circle', true)
export const OpenDotIcon = dotShapeIcon('circle', false)

const AXES = <path d="M4 4v16h16" />

/** y = x off: axes and scattered dots. */
export function IdentityOffIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {AXES}
      {[[9, 15], [12, 12], [15, 13], [18, 8]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="1.3" fill="currentColor" stroke="none" />)}
    </svg>
  )
}

/** y = x on: the same dots along a dashed diagonal. */
export function IdentityOnIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {AXES}
      <path d="M6 18 20 4" strokeDasharray="2.5 2.5" />
      {[[9, 15], [12, 12], [15, 10], [18, 6]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="1.3" fill="currentColor" stroke="none" />)}
    </svg>
  )
}
