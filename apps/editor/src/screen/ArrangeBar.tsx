/*
 * The align group in the top bar, shown while something is selected (design
 * A2, picked 2026-11-12, like Photoshop's options bar): left, centre, right,
 * top, middle, bottom, distribute across and down, then a ⋯ button whose menu
 * shows the same eight as tiles. Size is in the side panel; layer order is in
 * the right-click menu and its shortcuts.
 */
import { IconButton } from '@biofigure-lab/ui/components/icon-button/IconButton'
import { DropdownMenu } from '@biofigure-lab/ui/components/menu/Menu'
import { MoreHorizontal } from 'lucide-react'
import { Fragment } from 'react'

import { alignBarActions, type Commands } from '../editor/canvas-actions'
import type { SelectionInfo } from '../editor/FigureCanvas'

export function ArrangeBar({ selection, commands }: { selection: SelectionInfo; commands: Commands }) {
  const actions = alignBarActions(selection, commands)
  return (
    <div role="group" aria-label="Align" className="flex items-center gap-1">
      {/* Three groups with a divider between: along the page, up and down, then the two distribute buttons. */}
      {[actions.slice(0, 3), actions.slice(3, 6), actions.slice(6)].map((group, index) => (
        <Fragment key={index}>
          {index > 0 && <div aria-hidden="true" className="mx-1 h-5 w-px shrink-0 bg-border" />}
          {group.map(({ label, icon, disabled, onClick }) => icon && <IconButton key={label} icon={icon} label={label} disabled={disabled} onClick={onClick} />)}
        </Fragment>
      ))}
      <div className="mx-1 h-5 w-px shrink-0 bg-border" />
      <DropdownMenu sections={[{ label: 'Align', showLabel: true, layout: 'tiles', actions }]} trigger={<IconButton icon={MoreHorizontal} label="All align options" />} />
    </div>
  )
}
