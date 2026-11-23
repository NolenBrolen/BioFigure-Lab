/*
 * Tabs: switch between views of one place, such as Design / Arrange in the
 * properties panel or the file formats in Export. Only one view shows at a
 * time; arrow keys move between tabs.
 *
 * Two looks: `underline` (the default: plain text tabs, the open one
 * underlined in blue) and `segmented` (a grey track with the open tab as a
 * raised white chip), for places where tabs read better as one control.
 *
 * Built on Base UI's Tabs.
 */
import { Tabs as TabsPrimitive } from '@base-ui/react/tabs'
import { cva } from 'class-variance-authority'
import type { ReactNode } from 'react'

import { cn } from '../../lib/cn'

const listVariants = cva('relative flex', {
  variants: {
    variant: {
      underline: 'h-9 gap-4 border-b px-3',
      segmented: 'h-(--control-height) gap-0.5 rounded-md bg-muted p-0.5',
    },
  },
})

const tabVariants = cva(
  [
    'relative inline-flex items-center justify-center gap-1.5 text-sm whitespace-nowrap select-none',
    'transition-colors duration-(--duration-instant) data-disabled:opacity-50 [&_svg]:size-4',
  ],
  {
    variants: {
      variant: {
        underline:
          'text-muted-foreground hover:text-foreground data-active:font-medium data-active:text-foreground after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full data-active:after:bg-primary',
        segmented:
          'flex-1 rounded-[5px] px-2.5 text-muted-foreground hover:text-foreground data-active:bg-panel data-active:text-foreground data-active:shadow-sm',
      },
    },
  },
)

export type TabsVariant = 'underline' | 'segmented'

export type TabItem = { value: string; label: ReactNode; disabled?: boolean }

export type TabsProps = {
  tabs: TabItem[]
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  /** The tabs' name for screen readers. */
  label: string
  /** One child per tab, in the same order: use `TabsPanel`. */
  children?: ReactNode
  variant?: TabsVariant
  className?: string
}

export function Tabs({ tabs, value, defaultValue, onValueChange, label, children, variant = 'underline', className }: TabsProps) {
  return (
    <TabsPrimitive.Root
      value={value}
      defaultValue={defaultValue ?? tabs[0]?.value}
      onValueChange={(next) => onValueChange?.(String(next))}
      className={cn('flex min-h-0 flex-col', className)}
    >
      <TabsPrimitive.List aria-label={label} className={listVariants({ variant })}>
        {tabs.map((tab) => (
          <TabsPrimitive.Tab key={tab.value} value={tab.value} disabled={tab.disabled} className={tabVariants({ variant })}>
            {tab.label}
          </TabsPrimitive.Tab>
        ))}
      </TabsPrimitive.List>
      {children}
    </TabsPrimitive.Root>
  )
}

/** The content shown when its tab is open. */
export function TabsPanel({ value, children, className }: { value: string; children: ReactNode; className?: string }) {
  return (
    <TabsPrimitive.Panel value={value} className={cn('min-h-0 outline-none', className)}>
      {children}
    </TabsPrimitive.Panel>
  )
}
