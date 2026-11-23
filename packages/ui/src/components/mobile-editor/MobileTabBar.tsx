/*
 * MobileTabBar: the editor's tools along the bottom of a phone screen (the
 * desktop tool rail turned sideways, design A picked 2026-11-17). Each tab
 * shows its icon over its name; the open one gets a soft blue pill. Tapping
 * the open tab again closes its panel, so `value` can be none.
 */
import type { ComponentType } from 'react'

import { cn } from '../../lib/cn'

export type MobileTab = {
  id: string
  label: string
  icon: ComponentType<{ className?: string }>
}

export type MobileTabBarProps = {
  tabs: readonly MobileTab[]
  /** The tab whose panel is open, if any. */
  value?: string
  onPick: (id: string) => void
  label?: string
  className?: string
}

export function MobileTabBar({ tabs, value, onPick, label = 'Tools', className }: MobileTabBarProps) {
  return (
    <nav aria-label={label} className={cn('flex h-(--mobile-bar-height) shrink-0 items-stretch border-t bg-panel pb-[env(safe-area-inset-bottom,0px)]', className)}>
      {tabs.map(({ id, label: name, icon: Icon }) => {
        const on = id === value
        return (
          <button
            key={id}
            type="button"
            aria-pressed={on}
            onClick={() => onPick(id)}
            className={cn(
              'flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium outline-none',
              'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
              on ? 'text-primary-subtle-foreground' : 'text-muted-foreground',
            )}
          >
            <span className={cn('grid h-7 w-11 place-items-center rounded-full transition-colors duration-(--duration-instant)', on && 'bg-primary-subtle')}>
              <Icon className="size-5" />
            </span>
            <span className="max-w-full truncate">{name}</span>
          </button>
        )
      })}
    </nav>
  )
}
