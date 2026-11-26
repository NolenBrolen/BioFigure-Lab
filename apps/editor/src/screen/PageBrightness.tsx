/**
 * Page brightness in dark mode: a pill beside the page size menu. It dims
 * how the white page shows on screen so it doesn't glare in a dark room. Only the screen changes: the figure, its colours and every
 * export stay pure white. Shown only in dark mode; the choice is remembered
 * in this browser.
 */
import { Popover } from '@biofigure-lab/ui/components/popover/Popover'
import { Slider } from '@biofigure-lab/ui/components/slider/Slider'
import { cn } from '@biofigure-lab/ui/lib/cn'
import { RotateCcw, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'

const KEY = 'biofigure-lab:page-brightness'
/** Percent. Matches --page-dim in the design tokens. */
export const DEFAULT_PAGE_BRIGHTNESS = 85
export const MIN_PAGE_BRIGHTNESS = 50

function savedBrightness(): number {
  try {
    const value = Number(localStorage.getItem(KEY))
    return value >= MIN_PAGE_BRIGHTNESS && value <= 100 ? value : DEFAULT_PAGE_BRIGHTNESS
  } catch {
    return DEFAULT_PAGE_BRIGHTNESS
  }
}

/** The page brightness in percent, applied to the page through --page-dim and remembered. */
export function usePageBrightness(): [number, (value: number) => void] {
  const [brightness, setBrightness] = useState(savedBrightness)

  // On <html>, so the page in an earlier-version preview dims the same way.
  useEffect(() => {
    document.documentElement.style.setProperty('--page-dim', `${brightness / 100}`)
  }, [brightness])

  const change = (value: number) => {
    setBrightness(value)
    try {
      localStorage.setItem(KEY, `${value}`)
    } catch {
      // Storage blocked: the choice lasts until the page is reloaded.
    }
  }
  return [brightness, change]
}

/**
 * A pill beside the page size menu showing the brightness ("☀ 85%"). A click
 * opens a card with a slider, what it does in plain words, and a way back to
 * the default. (Design A of five drafts, picked 2026-11-25.)
 */
export function PageBrightness({ value, onValueChange }: { value: number; onValueChange: (value: number) => void }) {
  return (
    <Popover
      title="Page brightness"
      align="end"
      className="w-72"
      trigger={
        <button
          type="button"
          aria-label={`Page brightness, ${value}%`}
          className={cn(
            'flex h-6 shrink-0 items-center gap-1.5 rounded-full border bg-panel pr-2.5 pl-2 text-xs text-foreground shadow-xs',
            'transition-colors duration-(--duration-instant) hover:bg-accent data-popup-open:bg-accent',
            'outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
        >
          <Sun className="size-3.5 text-warning" aria-hidden="true" />
          <span className="tabular-nums">{value}%</span>
        </button>
      }
    >
      <div className="flex flex-col gap-3">
        <Slider label="Brightness" hideLabel min={MIN_PAGE_BRIGHTNESS} max={100} step={5} unit="%" value={value} onValueChange={onValueChange} />
        <p className="text-xs text-muted-foreground">
          Dims the white page on screen so it&apos;s easier on your eyes in dark mode. Only your screen changes: the figure and everything you export stay pure
          white.
        </p>
        {/* Always there, so the card never changes size; it fades out at the default. */}
        <button
          type="button"
          disabled={value === DEFAULT_PAGE_BRIGHTNESS}
          onClick={() => onValueChange(DEFAULT_PAGE_BRIGHTNESS)}
          className="flex items-center gap-1.5 self-start rounded-sm text-xs text-primary-subtle-foreground outline-none not-disabled:hover:underline focus-visible:ring-2 focus-visible:ring-ring disabled:text-muted-foreground disabled:opacity-60"
        >
          <RotateCcw className="size-3" aria-hidden="true" /> Back to {DEFAULT_PAGE_BRIGHTNESS}%
        </button>
      </div>
    </Popover>
  )
}
