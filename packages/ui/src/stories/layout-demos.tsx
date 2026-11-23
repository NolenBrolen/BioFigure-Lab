/*
 * Storybook helper: the editor's real uses of Tabs, Panel and Toolbar, shared
 * by their stories.
 */
import {
  Check,
  ChevronLeft,
  Circle,
  Clock,
  Layers,
  Minus,
  MousePointer2,
  MoveUpRight,
  Plus,
  Redo2,
  Square,
  Star,
  Type,
  Undo2,
} from 'lucide-react'
import { useState } from 'react'

import { IconButton } from '../components/icon-button/IconButton'
import { Panel, PanelSection } from '../components/panel/Panel'
import { SearchField } from '../components/search-field/SearchField'
import { Select } from '../components/select/Select'
import { Skeleton } from '../components/skeleton/Skeleton'
import { Slider } from '../components/slider/Slider'
import { Tabs, TabsPanel, type TabsVariant } from '../components/tabs/Tabs'
import { Toggle } from '../components/toggle/Toggle'
import { Toolbar, ToolbarIconButton, ToolbarSeparator, ToolbarSpacer, ToolbarTextButton } from '../components/toolbar/Toolbar'
import { MockSwatch } from '../sample/mock-controls'

const noop = () => {}

export function PropertiesTabs({ variant }: { variant?: TabsVariant }) {
  return (
    <Tabs
      label="Properties"
      variant={variant}
      className={variant === 'segmented' ? 'px-3 pt-2' : undefined}
      tabs={[
        { value: 'design', label: 'Design' },
        { value: 'arrange', label: 'Arrange' },
      ]}
    >
      <TabsPanel value="design" className="p-3 text-xs text-muted-foreground">
        Fill, line and text settings.
      </TabsPanel>
      <TabsPanel value="arrange" className="p-3 text-xs text-muted-foreground">
        Position, size and alignment.
      </TabsPanel>
    </Tabs>
  )
}

export function IconLibraryPanel({ className = 'h-[420px] w-(--panel-left-width) border' }: { className?: string }) {
  const [view, setView] = useState('all')
  return (
    <Panel
      title="Icon library"
      variant="rail"
      onClose={noop}
      search={<SearchField label="Search icons" placeholder="Search icons" onFilterClick={noop} />}
      railItems={[
        { value: 'all', icon: Layers, label: 'All icons' },
        { value: 'favourites', icon: Star, label: 'Favourites' },
        { value: 'recent', icon: Clock, label: 'Recently used' },
      ]}
      railValue={view}
      onRailValueChange={setView}
      className={className}
    >
      {['Cells', 'Organelles', 'Molecules'].map((name) => (
        <PanelSection key={name} title={name}>
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="aspect-square w-full" />
            ))}
          </div>
        </PanelSection>
      ))}
    </Panel>
  )
}

export function PropertiesPanel({ className = 'h-[520px] w-(--panel-right-width) border' }: { className?: string }) {
  return (
    <Panel title="Macrophage" onClose={noop} header={<PropertiesTabs />} className={className}>
      <PanelSection title="Fill" actions={<IconButton icon={Plus} label="Add fill" size="sm" />}>
        <div className="flex gap-1.5">
          <MockSwatch colour="#f4a6a6" label="Pink" />
          <MockSwatch colour="#7aa7e8" label="Blue" />
          <MockSwatch colour="#9bd39b" label="Green" />
        </div>
        <Slider label="Opacity" defaultValue={100} min={0} max={100} step={1} />
      </PanelSection>
      <PanelSection title="Line">
        <Slider label="Width" defaultValue={1.5} min={0} max={10} step={0.5} />
        <Select
          label="Style"
          options={[
            { value: 'solid', label: 'Solid' },
            { value: 'dashed', label: 'Dashed' },
          ]}
          defaultValue="solid"
        />
      </PanelSection>
      <PanelSection title="Text" defaultOpen={false}>
        <Toggle label="Bold" />
      </PanelSection>
    </Panel>
  )
}

export function TopBar() {
  return (
    <Toolbar label="Figure" className="border-b">
      <ToolbarIconButton icon={ChevronLeft} label="Back to your figures" />
      <ToolbarSeparator />
      <ToolbarTextButton variant="ghost" className="font-medium">
        Phagocytosis sequence
      </ToolbarTextButton>
      <span role="status" className="flex items-center gap-1 text-xs text-muted-foreground">
        <Check className="size-3.5" strokeWidth={2} aria-hidden="true" />
        Saved
      </span>
      <ToolbarSpacer />
      <ToolbarIconButton icon={Undo2} label="Undo" shortcut="Mod+Z" />
      <ToolbarIconButton icon={Redo2} label="Redo" shortcut="Mod+Shift+Z" disabled />
      <ToolbarSeparator />
      <ToolbarTextButton variant="primary">Export</ToolbarTextButton>
    </Toolbar>
  )
}

export function DrawingTools() {
  return (
    <Toolbar label="Tools" variant="floating">
      <ToolbarIconButton icon={MousePointer2} label="Select" shortcut="V" tooltipSide="top" pressed />
      <ToolbarIconButton icon={Square} label="Rectangle" shortcut="R" tooltipSide="top" />
      <ToolbarIconButton icon={Circle} label="Ellipse" shortcut="O" tooltipSide="top" />
      <ToolbarIconButton icon={Minus} label="Line" shortcut="L" tooltipSide="top" />
      <ToolbarIconButton icon={MoveUpRight} label="Arrow" shortcut="A" tooltipSide="top" />
      <ToolbarIconButton icon={Type} label="Text" shortcut="T" tooltipSide="top" />
    </Toolbar>
  )
}
