/*
 * What happens when the text typed in a shape gets long, picked from three
 * picture cards (design B, picked 2026-11-09): the shape grows wider and
 * taller, the text wraps and the shape grows taller, or the shape keeps its
 * size and the text gets smaller. Built on `OptionCards`, so it is a radio
 * group: Tab reaches the picked card, the arrow keys pick another.
 */
import { OptionCards } from '../option-cards/OptionCards'

export type TextFit = 'grow' | 'wrap' | 'shrink'

export type TextFitCardsProps = {
  value: TextFit
  onValueChange: (fit: TextFit) => void
  className?: string
}

/** Arrows in the picked blue, showing which way the shape grows. */
const arrow = 'stroke-primary'

function Picture({ fit }: { fit: TextFit }) {
  if (fit === 'grow') {
    return (
      <svg viewBox="0 0 48 40" className="h-10 w-12" aria-hidden="true">
        <rect x="9" y="6" width="30" height="24" rx="4" className="fill-primary-subtle stroke-current" strokeWidth="1.5" />
        <path d="M15 14.5h18M17 21.5h14" className="stroke-current" strokeWidth="2" strokeLinecap="round" />
        <path d="M6 18H1M3 15.5 0.8 18 3 20.5M42 18h5M45 15.5l2.2 2.5-2.2 2.5M24 33v6M21.5 36.8 24 39l2.5-2.2" className={arrow} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  if (fit === 'wrap') {
    return (
      <svg viewBox="0 0 48 40" className="h-10 w-12" aria-hidden="true">
        <rect x="12" y="2" width="24" height="30" rx="4" className="fill-primary-subtle stroke-current" strokeWidth="1.5" />
        <path d="M17 10h14M17 16h14M17 22h10" className="stroke-current" strokeWidth="2" strokeLinecap="round" />
        <path d="M24 33v6M21.5 36.8 24 39l2.5-2.2" className={arrow} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 48 40" className="h-10 w-12" aria-hidden="true">
      <rect x="10" y="8" width="28" height="24" rx="4" className="fill-primary-subtle stroke-current" strokeWidth="1.5" />
      <path d="M17 15.5h14M17 20h14M17 24.5h10" className="stroke-current" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

const OPTIONS = [
  { value: 'grow', label: 'Grow shape', picture: <Picture fit="grow" /> },
  { value: 'wrap', label: 'Wrap text', picture: <Picture fit="wrap" /> },
  { value: 'shrink', label: 'Shrink text', picture: <Picture fit="shrink" /> },
] as const

export function TextFitCards({ value, onValueChange, className }: TextFitCardsProps) {
  return <OptionCards<TextFit> label="When the text gets long" options={OPTIONS} value={value} onValueChange={onValueChange} className={className} />
}
