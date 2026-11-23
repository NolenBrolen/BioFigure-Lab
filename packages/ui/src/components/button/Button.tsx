/*
 * Button: a text button, optionally with an icon. `primary` is for the one
 * main action on screen (Export), `secondary` for the others, `ghost` for
 * quiet actions in toolbars, `danger` for actions that delete things.
 * Buttons are tinted and outlined rather than filled, so they stay calm next
 * to the figure.
 *
 * Built on Base UI's Button. Structure based on shadcn/ui (MIT, see
 * THIRD_PARTY_NOTICES.md).
 */
import { Button as ButtonPrimitive } from '@base-ui/react/button'
import { cva } from 'class-variance-authority'

import { cn } from '../../lib/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

const buttonVariants = cva(
  [
    'inline-flex shrink-0 items-center justify-center rounded-md font-medium whitespace-nowrap select-none',
    'transition-[background-color,color,box-shadow,translate] duration-(--duration-instant)',
    'active:translate-y-px data-disabled:pointer-events-none data-disabled:opacity-50',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        primary: 'bg-primary-subtle text-primary-subtle-foreground ring-1 ring-primary/25 ring-inset hover:bg-primary-subtle-hover',
        secondary: 'text-foreground ring-1 ring-border-strong ring-inset hover:bg-accent',
        ghost: 'text-muted-foreground hover:bg-accent hover:text-foreground',
        danger: 'text-destructive-text ring-1 ring-destructive/40 ring-inset hover:bg-destructive/10',
      },
      size: {
        sm: 'h-6 gap-1 px-2 text-xs [&_svg]:size-3.5',
        md: 'h-(--control-height) gap-1.5 px-3 text-sm [&_svg]:size-4',
        lg: 'h-9 gap-2 px-4 text-base [&_svg]:size-4',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
)

export type ButtonProps = Omit<ButtonPrimitive.Props, 'className'> & {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
}

export function Button({ variant = 'secondary', size = 'md', className, type = 'button', ...props }: ButtonProps) {
  return <ButtonPrimitive type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
}
