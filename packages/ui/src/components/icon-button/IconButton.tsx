/*
 * Icon button: a square button with only an icon, for toolbars (Undo, Redo,
 * drawing tools). It always has a label: screen readers read it, and it
 * shows as a tooltip together with the keyboard shortcut.
 *
 * Always outlined, like keys on a keyboard. When switched on (the active
 * drawing tool) it gets a soft blue tint.
 *
 * Built on Base UI's Button and our Tooltip.
 */
import { Button as ButtonPrimitive } from '@base-ui/react/button'
import { cva } from 'class-variance-authority'
import type { LucideIcon } from 'lucide-react'

import { cn } from '../../lib/cn'
import { Tooltip } from '../tooltip/Tooltip'

/** The icon button's styles. The search field's filter button uses them too, so the two always match. */
export const iconButtonVariants = cva(
  [
    'relative inline-flex shrink-0 items-center justify-center rounded-md border select-none',
    'transition-[background-color,color,border-color,box-shadow] duration-(--duration-instant)',
    // Disabled icon buttons stay hoverable, so their tooltip can still say what they do.
    'data-disabled:opacity-40',
  ],
  {
    variants: {
      pressed: {
        false: 'border-border-strong bg-panel text-foreground shadow-[0_1px_0_var(--border)] not-data-disabled:hover:bg-muted',
        true: 'border-primary/25 bg-primary-subtle text-primary-subtle-foreground not-data-disabled:hover:bg-primary-subtle-hover',
      },
      size: {
        sm: 'size-6 [&_svg]:size-3.5',
        md: 'size-(--control-height) [&_svg]:size-4',
      },
    },
    defaultVariants: { pressed: false, size: 'md' },
  },
)

export type IconButtonProps = Omit<ButtonPrimitive.Props, 'className' | 'children'> & {
  icon: LucideIcon
  /** What the button does, e.g. "Undo". Read by screen readers and shown as the tooltip. */
  label: string
  /** Keyboard shortcut for the tooltip, written like "Mod+Z". */
  shortcut?: string
  /** For buttons that switch something on and off, such as the active drawing tool. */
  pressed?: boolean
  size?: 'sm' | 'md'
  tooltipSide?: 'top' | 'bottom' | 'left' | 'right'
  className?: string
}

export function IconButton({
  icon: Icon,
  label,
  shortcut,
  pressed,
  size = 'md',
  tooltipSide = 'bottom',
  className,
  type = 'button',
  disabled,
  ...props
}: IconButtonProps) {
  return (
    <Tooltip label={label} shortcut={shortcut} side={tooltipSide}>
      <ButtonPrimitive
        type={type}
        aria-label={label}
        aria-pressed={pressed}
        disabled={disabled}
        focusableWhenDisabled={disabled}
        className={cn(iconButtonVariants({ pressed: pressed ?? false, size }), className)}
        {...props}
      >
        <Icon strokeWidth={1.75} aria-hidden="true" />
      </ButtonPrimitive>
    </Tooltip>
  )
}
