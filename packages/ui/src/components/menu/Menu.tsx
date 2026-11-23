/*
 * Context menu: the actions that appear when you right-click something on
 * the canvas, like Duplicate, Bring to front or Delete. A light card with one
 * row per action: icon, name and keyboard shortcut. Lines split the actions
 * into groups, and a group can have a small heading (Arrange, Align). A group
 * can also show as a row of icons only, for sets like the six align buttons.
 * Actions that remove things are red. Arrow keys move through
 * the rows, Enter runs one, Escape closes the menu.
 *
 * `DropdownMenu` shows the same card from a button instead (a "More" button),
 * below it.
 *
 * Built on Base UI's ContextMenu and Menu. Popup styles based on shadcn/ui (MIT, see
 * THIRD_PARTY_NOTICES.md).
 */
import { ContextMenu as MenuPrimitive } from '@base-ui/react/context-menu'
import { Menu as DropdownPrimitive } from '@base-ui/react/menu'
import type { LucideIcon } from 'lucide-react'
import { Fragment, type ReactElement } from 'react'

import { cn } from '../../lib/cn'
import { formatShortcut } from '../../lib/shortcut'

export type MenuAction = {
  label: string
  icon?: LucideIcon
  /** Written like "Mod+D" ("Mod" is Ctrl, or ⌘ on a Mac). */
  shortcut?: string
  /** Red, for actions that remove things. */
  danger?: boolean
  disabled?: boolean
  /** For a style that is on or off, like Strikethrough: shown pressed while on. Icon items only. */
  checked?: boolean
  onClick?: () => void
}

export type MenuSection = {
  /** Names the group for screen readers, and is its heading when `showLabel` is on. */
  label: string
  showLabel?: boolean
  /**
   * `icons`: one row of icon-only buttons; `tiles`: a grid of bigger icon-only
   * tiles, four to a row. Their names show as tooltips for the mouse and are
   * read out by screen readers.
   */
  layout?: 'list' | 'icons' | 'tiles'
  actions: MenuAction[]
}

export type ContextMenuProps = {
  sections: MenuSection[]
  /** The area that opens the menu on right-click. */
  children: ReactElement
  onOpenChange?: (open: boolean) => void
}

export function ContextMenu({ sections, children, onOpenChange }: ContextMenuProps) {
  return (
    <MenuPrimitive.Root onOpenChange={onOpenChange}>
      <MenuPrimitive.Trigger render={children} />
      <MenuPrimitive.Portal>
        <MenuPrimitive.Positioner className="z-50 outline-none">
          <MenuPopup sections={sections} />
        </MenuPrimitive.Positioner>
      </MenuPrimitive.Portal>
    </MenuPrimitive.Root>
  )
}

export type DropdownMenuProps = {
  sections: MenuSection[]
  /** The button that opens the menu. */
  trigger: ReactElement
  /** Which side of the button the menu opens on. */
  side?: 'top' | 'bottom' | 'left' | 'right'
  align?: 'start' | 'center' | 'end'
}

export function DropdownMenu({ sections, trigger, side = 'bottom', align = 'start' }: DropdownMenuProps) {
  return (
    <DropdownPrimitive.Root>
      <DropdownPrimitive.Trigger render={trigger} />
      <DropdownPrimitive.Portal>
        <DropdownPrimitive.Positioner side={side} align={align} sideOffset={6} className="z-50 outline-none">
          <MenuPopup sections={sections} />
        </DropdownPrimitive.Positioner>
      </DropdownPrimitive.Portal>
    </DropdownPrimitive.Root>
  )
}

/** The card itself, the same for both menus. */
function MenuPopup({ sections }: { sections: MenuSection[] }) {
  return (
    <MenuPrimitive.Popup
      className={cn(
        'min-w-48 rounded-md border bg-popover p-1 text-sm text-popover-foreground shadow-md outline-none select-none',
        'origin-(--transform-origin) transition-[opacity,scale] duration-(--duration-fast) ease-enter',
        'data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0',
      )}
    >
      {sections.map((section, index) => (
        <Fragment key={section.label}>
          {index > 0 && <MenuPrimitive.Separator className="my-1 h-px bg-border" />}
          <MenuPrimitive.Group aria-label={section.showLabel ? undefined : section.label}>
            {section.showLabel && <MenuPrimitive.GroupLabel className="section-label px-2 pt-2 pb-1">{section.label}</MenuPrimitive.GroupLabel>}
            {section.layout === 'icons' ? (
              <div className="flex justify-between gap-0.5 px-1 pb-0.5">
                {section.actions.map((action) => (
                  <IconItem key={action.label} action={action} />
                ))}
              </div>
            ) : section.layout === 'tiles' ? (
              <div className="grid grid-cols-4 gap-1 p-1">
                {section.actions.map((action) => (
                  <IconItem key={action.label} action={action} tile />
                ))}
              </div>
            ) : (
              section.actions.map((action) => <MenuItem key={action.label} action={action} />)
            )}
          </MenuPrimitive.Group>
        </Fragment>
      ))}
    </MenuPrimitive.Popup>
  )
}

function MenuItem({ action }: { action: MenuAction }) {
  const Icon = action.icon
  return (
    <MenuPrimitive.Item
      disabled={action.disabled}
      onClick={action.onClick}
      className={cn(
        'flex h-7 cursor-default items-center gap-2 rounded-sm px-2 outline-none',
        'data-disabled:opacity-50 data-highlighted:bg-accent',
        action.danger && 'text-destructive-text data-highlighted:bg-destructive/10',
      )}
    >
      {Icon && <Icon className={cn('size-4', !action.danger && 'text-muted-foreground')} strokeWidth={1.75} aria-hidden="true" />}
      <span className="flex-1">{action.label}</span>
      {action.shortcut && <kbd className="ml-4 font-sans text-xs text-muted-foreground">{formatShortcut(action.shortcut)}</kbd>}
    </MenuPrimitive.Item>
  )
}

function IconItem({ action, tile }: { action: MenuAction; tile?: boolean }) {
  const Icon = action.icon
  const className = cn(
    'grid cursor-default place-items-center rounded-sm text-muted-foreground outline-none data-disabled:opacity-50 data-highlighted:bg-accent data-highlighted:text-foreground',
    'data-checked:border-primary/25 data-checked:bg-primary-subtle data-checked:text-primary-subtle-foreground',
    tile ? 'size-10 border' : 'size-7',
  )
  const icon = Icon && <Icon className={tile ? 'size-5' : 'size-4'} strokeWidth={1.75} aria-hidden="true" />
  if (action.checked !== undefined) {
    return (
      <MenuPrimitive.CheckboxItem aria-label={action.label} title={action.label} disabled={action.disabled} checked={action.checked} onCheckedChange={() => action.onClick?.()} className={className}>
        {icon}
      </MenuPrimitive.CheckboxItem>
    )
  }
  return (
    <MenuPrimitive.Item aria-label={action.label} title={action.label} disabled={action.disabled} onClick={action.onClick} className={className}>
      {icon}
    </MenuPrimitive.Item>
  )
}
