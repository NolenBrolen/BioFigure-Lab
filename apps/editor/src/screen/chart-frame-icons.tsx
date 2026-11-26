/*
 * Small pictures for a chart's Frame, Grid and Scale choices (BIO-68), drawn
 * like Lucide icons (24 px box, round ends, stroke in the text colour) so they
 * sit well beside the app's other panel icons.
 */
import type { ReactNode } from 'react'

type IconProps = { className?: string; strokeWidth?: number }

function icon(children: ReactNode) {
  return function ChartIcon({ className, strokeWidth = 2 }: IconProps) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {children}
      </svg>
    )
  }
}

const AXES = <path d="M4 4v16h16" />
/** Three level lines across the plot, drawn solid, dotted or dashed. */
const gridLines = (dash?: string) => <path d="M8.5 6h11.5M8.5 10.5h11.5M8.5 15h11.5" strokeDasharray={dash} />

/** Frame: the left and bottom axis lines. */
export const FrameOpenIcon = icon(AXES)
/** Frame: all four sides. */
export const FrameBoxIcon = icon(<rect x="4" y="4" width="16" height="16" rx="1" />)
/** Frame: no lines, only the tick marks. */
export const FrameNoneIcon = icon(<path d="M2 6h3M2 12h3M2 18h3M8 22v-3M14 22v-3M20 22v-3" />)

export const GridNoneIcon = icon(AXES)
export const GridSolidIcon = icon(<>{AXES}{gridLines()}</>)
export const GridDottedIcon = icon(<>{AXES}{gridLines('0.01 3.8')}</>)
export const GridDashedIcon = icon(<>{AXES}{gridLines('3 2.5')}</>)

/** Scale: ticks evenly spaced along an axis. */
export const ScaleLinearIcon = icon(<path d="M2 19h20M3 19v-10M7.5 19v-10M12 19v-10M16.5 19v-10M21 19v-10" />)
/** Scale: long ticks at each power of ten, short ones bunching up towards the next. */
export const ScaleLogIcon = icon(<><path d="M2 19h20M3 19V5M12 19V5M21 19V5" /><path d="M5.7 19v-6M8.4 19v-6M10 19v-6M11.1 19v-6M14.7 19v-6M17.4 19v-6M19 19v-6M20.1 19v-6" strokeWidth={1.25} /></>)
