/*
 * Icon tile: one icon in the icon library. Click it to place the icon, or drag
 * it onto the canvas.
 *
 * Two looks; the icon library lets you switch between them:
 *   badge – square tile with the name below it (default).
 *   row   – small picture and name on one line.
 */
import type { ComponentProps, ReactNode } from 'react'

import { cn } from '../../lib/cn'

export type IconTileLook = 'badge' | 'row'

export type IconTileProps = Omit<ComponentProps<'button'>, 'children'> & {
  name: string
  /** The icon's picture, e.g. an <img> of its SVG. */
  picture: ReactNode
  look?: IconTileLook
}

export function IconTile({ name, picture, look = 'badge', className, ...props }: IconTileProps) {
  if (look === 'row') {
    return (
      <button type="button" title={`Add ${name}`} className={cn('group flex h-10 w-full min-w-0 items-center gap-2 rounded-md px-1.5 text-left hover:bg-accent', className)} {...props}>
        <span className="grid size-8 shrink-0 place-items-center rounded-sm bg-muted [&>*]:size-6">{picture}</span>
        <span className="min-w-0 flex-1 truncate text-xs">{name}</span>
      </button>
    )
  }

  return (
    <button type="button" title={`Add ${name}`} className={cn('group flex min-w-0 flex-col gap-1 text-left', className)} {...props}>
      <span className="grid aspect-square w-full place-items-center rounded-md bg-muted ring-1 ring-transparent transition-colors duration-(--duration-instant) ring-inset group-hover:bg-accent group-hover:ring-border-strong [&>*]:size-3/5">
        {picture}
      </span>
      <span className="line-clamp-2 text-xs text-muted-foreground group-hover:text-foreground">{name}</span>
    </button>
  )
}
