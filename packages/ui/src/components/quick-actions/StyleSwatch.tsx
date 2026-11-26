import { cn } from '../../lib/cn'

/**
 * Style: a shape preset swatch with no fill, drawn the way the Shapes panel
 * draws its presets (rounded square, 2 px outline, "Aa" in small semibold), so
 * the button reads as "pick a preset". It takes the bar's text colour.
 */
export function StyleSwatch({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn('grid shrink-0 place-items-center rounded-md border-2 border-current text-xs leading-none font-semibold tracking-tight', className)}>
      Aa
    </span>
  )
}
