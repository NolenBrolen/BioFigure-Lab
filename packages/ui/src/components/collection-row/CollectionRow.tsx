import type { ComponentProps, ReactNode } from 'react'
import { cn } from '../../lib/cn'

/** A selectable collection with a single representative picture. */
export function CollectionRow({ name, picture, selected, className, ...props }: Omit<ComponentProps<'button'>, 'children'> & { name: string; picture: ReactNode; selected: boolean }) {
  return <button type="button" aria-pressed={selected} className={cn('flex h-14 w-full items-center gap-3 rounded-md border px-2 text-left text-xs font-medium transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary', selected ? 'border-primary bg-primary-subtle text-primary-subtle-foreground' : 'border-border', className)} {...props}>
    <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center [&>*]:size-full">{picture}</span><span className="min-w-0 truncate">{name}</span>
  </button>
}
