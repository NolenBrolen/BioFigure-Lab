/*
 * Draw tile: one pickable arrow or shape in the Arrows and Shapes panels. A
 * square with the picture in the middle and the name centred under it,
 * inside the square. Picked tiles get a blue ring (their tool is on).
 */
import type { ComponentProps, ReactNode } from 'react'

import { cn } from '../../lib/cn'

export type DrawTileProps = Omit<ComponentProps<'button'>, 'children'> & {
  name: string
  picture: ReactNode
  picked?: boolean
}

export function DrawTile({ name, picture, picked = false, className, ...props }: DrawTileProps) {
  return (
    <button
      type="button"
      aria-pressed={picked}
      className={cn(
        'group flex aspect-square min-w-0 flex-col items-center justify-center gap-1.5 rounded-lg bg-muted p-2 text-foreground ring-1 ring-transparent transition-colors duration-(--duration-instant) ring-inset hover:bg-accent hover:ring-border-strong',
        picked && 'bg-accent ring-2 ring-primary hover:ring-primary',
        className,
      )}
      {...props}
    >
      <span className="flex w-3/5 flex-1 items-center justify-center [&>svg]:w-full">{picture}</span>
      <span className="w-full truncate text-center text-xs text-muted-foreground group-hover:text-foreground">{name}</span>
    </button>
  )
}
