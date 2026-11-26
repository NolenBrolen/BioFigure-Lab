/*
 * Quick actions: the small toolbar that floats just above a selected object
 * on the canvas, with the few actions people use most for that kind of
 * object (fill, line colour, duplicate, lock, delete, more).
 *
 * Open buttons with no box around them; a soft grey highlight shows on hover
 * and keyboard focus. Groups are split by space, not lines. Each button names
 * itself in a tooltip; `showLabels` puts the names under the icons instead,
 * for when the list grows. Arrow keys move between the buttons.
 *
 * Colour actions show a swatch and open the browser's colour picker. A
 * button can open a small widget instead of acting at once (Frame, Style,
 * Row): a popover on the side away from the object, holding the choices.
 *
 * Built on Base UI's Toolbar and our Tooltip.
 */
import { Toolbar as ToolbarPrimitive } from '@base-ui/react/toolbar'
import { useRef, useState, type ComponentType, type CSSProperties, type ReactNode, type Ref } from 'react'

import { cn } from '../../lib/cn'
import { Popover } from '../popover/Popover'
import { Tooltip } from '../tooltip/Tooltip'

type BaseAction = {
  /** Stable id, also the React key. */
  id: string
  label: string
  /** Written like "Mod+D" ("Mod" is Ctrl, or ⌘ on a Mac). */
  shortcut?: string
  disabled?: boolean
}

/** A Lucide icon, or our own picture taking the same size class (e.g. the Style swatch). */
export type QuickIcon = ComponentType<{ className?: string; strokeWidth?: number; 'aria-hidden'?: 'true' }>

export type QuickButtonAction = BaseAction & {
  icon: QuickIcon
  /** Red, for actions that remove things. */
  danger?: boolean
  /** Shown as switched on (e.g. Lock while locked). */
  pressed?: boolean
  /** Gets the button, e.g. to open a menu next to it. */
  onClick?: (button: HTMLElement) => void
  /** Opens a widget from the button instead; `close` shuts it, e.g. after a one-off pick. */
  widget?: QuickWidget
}

export type QuickWidget = {
  /** The widget's title bar, and its name for screen readers. */
  title: string
  content: (close: () => void) => ReactNode
  /** Sizes the widget, e.g. "w-60". */
  className?: string
}

export type QuickColourAction = BaseAction & {
  /** The current colour as #rrggbb; empty shows a "none" swatch. */
  colour?: string
  /** `fill` shows a filled dot, `line` a ring. */
  swatch: 'fill' | 'line'
  onColour: (colour: string) => void
}

export type QuickAction = QuickButtonAction | QuickColourAction

export type QuickActionGroup = { id: string; actions: QuickAction[] }

export type QuickActionsProps = {
  /** The toolbar's name for screen readers. */
  label: string
  groups: QuickActionGroup[]
  /** Names under the icons instead of only in tooltips. */
  showLabels?: boolean
  /** `sm` is a smaller bar, e.g. right over a few highlighted words. */
  size?: 'sm' | 'md'
  /** Clicks don't take the keyboard focus, e.g. so characters selected in text being typed stay selected. */
  keepFocus?: boolean
  /** Which side the tooltips open on; the side away from the object. */
  tooltipSide?: 'top' | 'bottom'
  className?: string
  style?: CSSProperties
  ref?: Ref<HTMLDivElement>
}

export function QuickActions({ label, groups, showLabels = false, size = 'md', keepFocus = false, tooltipSide = 'top', className, style, ref }: QuickActionsProps) {
  return (
    <ToolbarPrimitive.Root
      ref={ref}
      aria-label={label}
      style={style}
      onMouseDown={keepFocus ? (event) => event.preventDefault() : undefined}
      className={cn('relative flex w-max items-center rounded-xl border bg-panel text-foreground shadow-md', size === 'sm' ? 'gap-1.5 rounded-lg p-1' : 'gap-3', showLabels ? 'p-2' : size === 'md' && 'p-1.5', className)}
    >
      {groups.map((group) => (
        <ToolbarPrimitive.Group key={group.id} className={cn('flex items-center', size === 'sm' ? 'gap-0.5' : 'gap-1')}>
          {group.actions.map((action) => (
            <QuickButton key={action.id} action={action} showLabels={showLabels} small={size === 'sm'} tooltipSide={tooltipSide} />
          ))}
        </ToolbarPrimitive.Group>
      ))}
    </ToolbarPrimitive.Root>
  )
}

function QuickButton({ action, showLabels, small, tooltipSide }: { action: QuickAction; showLabels: boolean; small: boolean; tooltipSide: 'top' | 'bottom' }) {
  const picker = useRef<HTMLInputElement>(null)
  const [widgetOpen, setWidgetOpen] = useState(false)
  const isColour = 'swatch' in action
  const danger = !isColour && action.danger
  const widget = isColour ? undefined : action.widget
  const button = (
    <ToolbarPrimitive.Button
      aria-label={showLabels ? undefined : action.label}
      aria-pressed={!isColour && action.pressed !== undefined ? action.pressed : undefined}
      disabled={action.disabled}
      onClick={(event) => (isColour ? picker.current?.click() : action.onClick?.(event.currentTarget))}
      className={cn(
        'flex flex-col items-center justify-center rounded-md select-none',
        'transition-colors duration-(--duration-instant) not-data-disabled:hover:bg-muted',
        'data-disabled:opacity-40',
        showLabels ? 'h-16 min-w-18 gap-1.5 px-2' : small ? 'size-7' : 'size-10',
        danger && 'text-destructive-text',
        !isColour && action.pressed && 'bg-primary-subtle text-primary-subtle-foreground not-data-disabled:hover:bg-primary-subtle-hover',
        widgetOpen && 'bg-muted',
      )}
    >
      {isColour ? <Swatch action={action} size={showLabels ? 'size-6' : small ? 'size-4' : 'size-5'} /> : <action.icon className={showLabels ? 'size-6' : small ? 'size-4' : 'size-5'} strokeWidth={1.75} aria-hidden="true" />}
      {showLabels && <span className={cn('text-xs whitespace-nowrap', !danger && 'text-muted-foreground')}>{action.label}</span>}
    </ToolbarPrimitive.Button>
  )
  if (widget) {
    // The widget opens on the side away from the object, as the tooltips do.
    return (
      <Popover title={widget.title} trigger={button} side={tooltipSide} align="center" open={widgetOpen} onOpenChange={setWidgetOpen} className={widget.className}>
        {widget.content(() => setWidgetOpen(false))}
      </Popover>
    )
  }
  return (
    <>
      {showLabels ? button : <Tooltip label={action.label} shortcut={action.shortcut} side={tooltipSide}>{button}</Tooltip>}
      {isColour && (
        <input
          ref={picker}
          type="color"
          tabIndex={-1}
          aria-hidden="true"
          className="pointer-events-none absolute size-0 opacity-0"
          value={action.colour || '#000000'}
          onChange={(event) => action.onColour(event.target.value)}
        />
      )}
    </>
  )
}

function Swatch({ action, size }: { action: QuickColourAction; size: string }) {
  const none = !action.colour
  return (
    <span
      aria-hidden="true"
      // The thin outline keeps a dark swatch visible on a dark toolbar.
      className={cn(size, 'rounded-full outline-1 outline-border-strong', action.swatch === 'fill' && 'border border-black/15', none && 'border border-dashed border-muted-foreground bg-transparent')}
      style={none ? undefined : action.swatch === 'line' ? { border: `3px solid ${action.colour}` } : { background: action.colour }}
    />
  )
}
