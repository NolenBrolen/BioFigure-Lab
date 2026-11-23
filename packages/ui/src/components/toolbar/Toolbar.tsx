/*
 * Toolbar: a row of controls, such as the top bar (back, figure name, Undo,
 * Export) or the drawing tools. Arrow keys move between its buttons, so Tab
 * jumps over the whole toolbar at once.
 *
 * Two looks, both as in the editor sample: `bar`, a plain strip edge to edge
 * (the top bar), and `floating`, a small card with a shadow over the canvas
 * (the drawing tools). Put buttons in as ToolbarIconButton or
 * ToolbarTextButton, split groups with ToolbarSeparator, and use
 * ToolbarSpacer to push the rest (Export) to the right.
 *
 * Built on Base UI's Toolbar, our IconButton and Button.
 */
import { Toolbar as ToolbarPrimitive } from '@base-ui/react/toolbar'
import { cva } from 'class-variance-authority'
import type { ReactNode } from 'react'

import { cn } from '../../lib/cn'
import { Button, type ButtonProps } from '../button/Button'
import { IconButton, type IconButtonProps } from '../icon-button/IconButton'

const toolbarVariants = cva('flex items-center gap-1 text-sm text-foreground', {
  variants: {
    variant: {
      bar: 'h-(--topbar-height) bg-panel px-2',
      floating: 'w-fit rounded-lg border bg-panel p-1 shadow-md',
    },
  },
})

export type ToolbarProps = {
  /** The toolbar's name for screen readers. */
  label: string
  variant?: 'bar' | 'floating'
  children: ReactNode
  className?: string
}

export function Toolbar({ label, variant = 'bar', children, className }: ToolbarProps) {
  return (
    <ToolbarPrimitive.Root aria-label={label} className={cn(toolbarVariants({ variant }), className)}>
      {children}
    </ToolbarPrimitive.Root>
  )
}

/** An icon button that takes part in the toolbar's arrow-key moves. */
export function ToolbarIconButton(props: IconButtonProps) {
  return <IconButton {...props} render={<ToolbarPrimitive.Button />} />
}

/** A text button (Export, the figure name) that takes part in the toolbar's arrow-key moves. */
export function ToolbarTextButton(props: ButtonProps) {
  return <Button {...props} render={<ToolbarPrimitive.Button />} />
}

/** A short vertical line between groups of buttons. */
export function ToolbarSeparator() {
  return <ToolbarPrimitive.Separator className="mx-1 h-5 w-px shrink-0 bg-border" />
}

/** Pushes what comes after it to the right end. */
export function ToolbarSpacer() {
  return <div className="flex-1" />
}
