/*
 * Panel: a docked side panel, such as the icon library on the left or the
 * properties on the right. Every panel has the same top: title, then close
 * (X) on the outer right, then an optional search row. That keeps search,
 * filter and close in the same place and size in every panel.
 *
 * Two looks: `docked` (flat, sections split by thin lines; the right panel)
 * and `rail` (a strip of section icons down the side and small uppercase
 * headings; the left panel). Picked "for now", to check in the real app.
 *
 * Panel sections fold open and shut (properties: Fill, Line, Text...).
 *
 * Built on Base UI's Collapsible and our IconButton.
 */
import { Collapsible } from '@base-ui/react/collapsible'
import { ChevronDown, ChevronRight, X, type LucideIcon } from 'lucide-react'
import { createContext, useContext, type ReactNode } from 'react'

import { cn } from '../../lib/cn'
import { IconButton } from '../icon-button/IconButton'

export type PanelVariant = 'docked' | 'rail'

// Sections take their look from the panel around them.
const VariantContext = createContext<PanelVariant>('docked')

export type PanelRailItem = { value: string; icon: LucideIcon; label: string }

export type PanelProps = {
  title: string
  /** Shows the close (X) button on the outer right. */
  onClose?: () => void
  /** A row under the title, usually the SearchField. */
  search?: ReactNode
  /** Something above the sections, such as Tabs. */
  header?: ReactNode
  variant?: PanelVariant
  /** Rail look only: one icon per section or view, down the side. */
  railItems?: PanelRailItem[]
  /** Which rail item is switched on. */
  railValue?: string
  onRailValueChange?: (value: string) => void
  children: ReactNode
  className?: string
}

export function Panel({
  title,
  onClose,
  search,
  header,
  variant = 'docked',
  railItems,
  railValue,
  onRailValueChange,
  children,
  className,
}: PanelProps) {
  const rail = variant === 'rail' && railItems && railItems.length > 0
  return (
    <VariantContext.Provider value={variant}>
      <aside aria-label={title} className={cn('flex min-h-0 overflow-hidden bg-panel text-sm text-foreground', className)}>
        {rail && (
          <nav
            aria-label={`${title} sections`}
            className="flex w-10 shrink-0 flex-col items-center gap-1 border-r bg-canvas py-2"
          >
            {railItems.map((item) => (
              <IconButton
                key={item.value}
                icon={item.icon}
                label={item.label}
                size="sm"
                pressed={item.value === railValue}
                tooltipSide="right"
                onClick={() => onRailValueChange?.(item.value)}
              />
            ))}
          </nav>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className={cn('flex h-10 shrink-0 items-center gap-2 pr-1.5 pl-3', variant === 'docked' && 'border-b')}>
            <h2 className="flex-1 truncate font-semibold">{title}</h2>
            {onClose && <IconButton icon={X} label={`Close ${title.toLowerCase()}`} size="sm" onClick={onClose} />}
          </div>
          {search && <div className="shrink-0 px-3 py-2">{search}</div>}
          {header}
          <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]">{children}</div>
        </div>
      </aside>
    </VariantContext.Provider>
  )
}

export type PanelSectionProps = {
  title: string
  defaultOpen?: boolean
  /** Small controls on the right of the title, such as an add (+) button. */
  actions?: ReactNode
  children: ReactNode
}

/** A part of a panel that folds open and shut. */
export function PanelSection({ title, defaultOpen = true, actions, children }: PanelSectionProps) {
  const variant = useContext(VariantContext)
  const rail = variant === 'rail'
  return (
    <Collapsible.Root defaultOpen={defaultOpen} className={cn(!rail && 'border-b')}>
      <div className={cn('group flex h-8 items-center gap-1 pr-1.5', rail ? 'mx-3 mt-2 border-b' : 'pl-1.5')}>
        <Collapsible.Trigger className="flex h-full flex-1 items-center gap-1 rounded-md text-left">
          {rail ? (
            <>
              <span className="flex-1 text-2xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</span>
              <ChevronDown
                aria-hidden="true"
                className="size-3.5 text-muted-foreground transition-transform duration-(--duration-fast) group-has-[[data-panel-open]]:rotate-180"
              />
            </>
          ) : (
            <>
              <ChevronRight
                aria-hidden="true"
                className="size-3.5 text-muted-foreground transition-transform duration-(--duration-fast) group-has-[[data-panel-open]]:rotate-90"
              />
              <span className="section-label flex-1">{title}</span>
            </>
          )}
        </Collapsible.Trigger>
        {actions}
      </div>
      <Collapsible.Panel className="flex flex-col gap-2 px-3 pt-1 pb-3">{children}</Collapsible.Panel>
    </Collapsible.Root>
  )
}
