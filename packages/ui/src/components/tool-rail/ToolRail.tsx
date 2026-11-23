/*
 * ToolRail: the narrow strip of tools on the far left of the editor (Icons,
 * Arrows, Shapes, Text, Graph, Table). Picking a tool fills the panel next to
 * it with that tool's contents. Icons only; the tool's name shows in a
 * tooltip, with its key in brackets when it has one ("Text (T)"). Arrow keys (up/down) move between tools, so Tab jumps over the
 * whole rail at once.
 *
 * To add a tool, pass one more entry in `tools`:
 *
 *   { id: 'graph', label: 'Graph', icon: ChartColumn, panel: <GraphPanel /> }
 *
 * Leave `panel` out while the tool isn't built yet: it then shows a simple
 * "coming soon" placeholder.
 *
 * Built on Base UI's Tabs (vertical), our Tooltip.
 */
import { Tabs as TabsPrimitive } from '@base-ui/react/tabs'
import type { ComponentType, ReactNode } from 'react'

import { cn } from '../../lib/cn'
import { Tooltip } from '../tooltip/Tooltip'

export type Tool = {
  /** Stays the same forever; used to remember the picked tool. */
  id: string
  /** The tool's name, shown in the tooltip and read by screen readers. */
  label: string
  /** A Lucide icon, or any component that takes a className. */
  icon: ComponentType<{ className?: string }>
  /** The key or keys that turn the tool on, like "T" or "R, O"; shown after the name in the tooltip. */
  shortcut?: string
  /** What the left panel shows for this tool. Leave out for a placeholder. */
  panel?: ReactNode
}

export type ToolRailProps = {
  tools: readonly Tool[]
  /** The picked tool's id. Leave out to let the rail keep track itself. */
  value?: string
  /** The tool picked at the start. Defaults to the first one. */
  defaultValue?: string
  onValueChange?: (id: string) => void
  /** The rail's name for screen readers. */
  label?: string
  className?: string
}

export function ToolRail({ tools, value, defaultValue, onValueChange, label = 'Tools', className }: ToolRailProps) {
  return (
    <TabsPrimitive.Root
      orientation="vertical"
      value={value}
      defaultValue={defaultValue ?? tools[0]?.id}
      onValueChange={(next) => onValueChange?.(String(next))}
      className={cn('flex min-h-0 gap-px bg-border', className)}
    >
      <TabsPrimitive.List aria-label={label} className="flex w-(--rail-width) shrink-0 flex-col items-center gap-1 bg-panel py-2">
        {tools.map(({ id, label: name, icon: Icon, shortcut }) => (
          <Tooltip key={id} label={shortcut ? `${name} (${shortcut})` : name} side="right">
            <TabsPrimitive.Tab
              value={id}
              aria-label={name}
              aria-keyshortcuts={shortcut?.replace(/, /g, ' ')}
              className={cn(
                'group grid size-14 place-items-center rounded-lg text-muted-foreground outline-none',
                'transition-colors duration-(--duration-instant) hover:bg-muted hover:text-foreground',
                'focus-visible:ring-2 focus-visible:ring-ring data-active:bg-muted data-active:text-foreground',
              )}
            >
              <span className="grid size-9 place-items-center rounded-md group-data-active:bg-primary group-data-active:text-primary-foreground">
                <Icon className="size-5" />
              </span>
            </TabsPrimitive.Tab>
          </Tooltip>
        ))}
      </TabsPrimitive.List>
      {tools.map((tool) => (
        <TabsPrimitive.Panel key={tool.id} value={tool.id} className="flex min-h-0 min-w-0 flex-1 flex-col bg-panel outline-none">
          {tool.panel ?? <ToolPlaceholder label={tool.label} />}
        </TabsPrimitive.Panel>
      ))}
    </TabsPrimitive.Root>
  )
}

/** Shown for a tool that has no panel yet. */
export function ToolPlaceholder({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-2 p-4">
      <h2 className="section-label">{label}</h2>
      <p className="text-muted-foreground">Coming soon.</p>
    </div>
  )
}
