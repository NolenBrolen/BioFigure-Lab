/*
 * Small line pictures for the heatmap's settings, drawn on a 24 × 24 grid in
 * Lucide's style (round ends and joins), so they sit with the Lucide icons
 * around them.
 */
import type { ReactNode } from 'react'

type IconProps = { className?: string; strokeWidth?: number; 'aria-hidden'?: 'true' }

function Icon({ className, strokeWidth = 1.75, children }: IconProps & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  )
}

/** As typed: a 2 × 2 grid of cells, each holding a short stroke for its number. */
export const TypedValuesIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M12 3v18M3 12h18" />
    <path d="M7.5 6.5v2M15.5 7.5h2M6.5 16.5h2M16.5 15.5v2" />
  </Icon>
)

/** Pearson: dots along a straight rising line. */
export const PearsonIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 20 20 4" />
    <circle cx="7" cy="15" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="10.5" cy="10" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="14" cy="12.5" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="17.5" cy="8" r="1.3" fill="currentColor" stroke="none" />
  </Icon>
)

/** Spearman: a rising staircase of ranks. */
export const SpearmanIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 20h4v-4h4v-4h4V8h4V4" />
  </Icon>
)

const ON_OFF = { className: 'size-4', strokeWidth: 2.25 }
/** A line through an icon: the thing it shows is off. */
const Slash = () => <path d="M3 21 21 3" />

/** Symmetric: arrows reaching equally far either side of a centre line; off, unequally. */
export const SymmetricIcon = () => (
  <Icon {...ON_OFF}>
    <path d="M12 5v14M3 12h18M6 9l-3 3 3 3M18 9l3 3-3 3" />
  </Icon>
)
export const LopsidedIcon = () => (
  <Icon {...ON_OFF}>
    <path d="M8 5v14M5 12h16M18 9l3 3-3 3M7 10l-2 2 2 2" />
  </Icon>
)

/** Row and column names: a label tag, or one struck through. */
export const NamesIcon = () => (
  <Icon {...ON_OFF}>
    <path d="M4 7h10l5 5-5 5H4z" />
  </Icon>
)
export const NamesOffIcon = () => (
  <Icon {...ON_OFF}>
    <path d="M10 7h4l5 5-2.5 2.5M12 17H4V9" />
    <Slash />
  </Icon>
)
