/*
 * Skeleton: a grey placeholder with the same size and shape as the content
 * that is still loading (an icon tile, a line of text, a thumbnail). Because
 * it takes up exactly the same space, nothing shifts when the content
 * arrives. Screen readers skip it; put `aria-busy` and a "Loading" text on
 * the area around it instead.
 *
 * A light band sweeps across it from left to right while loading. With
 * "reduce motion" switched on in the operating system, it stays still.
 */
import { cva } from 'class-variance-authority'

import { cn } from '../../lib/cn'

const skeletonVariants = cva(
  [
    'block shrink-0 bg-skeleton bg-size-[200%_100%] motion-safe:animate-shimmer',
    'bg-[linear-gradient(90deg,var(--skeleton)_30%,var(--skeleton-highlight)_50%,var(--skeleton)_70%)]',
  ],
  {
    variants: {
      shape: {
        block: 'rounded-md',
        text: 'h-3 rounded-sm',
        circle: 'aspect-square rounded-full',
      },
    },
    defaultVariants: { shape: 'block' },
  },
)

export type SkeletonProps = {
  /** `block` for tiles and thumbnails, `text` for a line of text, `circle` for avatars and dots. */
  shape?: 'block' | 'text' | 'circle'
  /** Give it the size of the real content, e.g. `aspect-square` or `w-3/4`. */
  className?: string
}

export function Skeleton({ shape = 'block', className }: SkeletonProps) {
  return <span aria-hidden="true" className={cn(skeletonVariants({ shape }), className)} />
}
