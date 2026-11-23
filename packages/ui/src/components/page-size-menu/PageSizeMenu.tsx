/*
 * Page size menu: a small rounded button above the canvas that shows the
 * figure's size (a tiny page picture, "Double column", "174 × 120 mm"). It
 * opens a list of the journal column sizes, each with its picture and size,
 * plus "Custom size…" at the bottom. The current size has a tick.
 *
 * Built on Base UI's Menu (radio items, so screen readers hear which size is
 * picked). Popup styles match the other menus.
 */
import { Menu } from '@base-ui/react/menu'
import { Check, ChevronDown, Ruler } from 'lucide-react'

import { cn } from '../../lib/cn'
import { PageSizeIcon } from '../page-size-icon/PageSizeIcon'

export type PageSizeOption<Value extends string> = {
  value: Value
  label: string
  /** In mm. */
  width: number
  height: number
}

export type PageSizeMenuProps<Value extends string> = {
  options: readonly PageSizeOption<Value>[]
  /** The page's size now, in mm. A size that matches no option shows as "Custom". */
  page: { width: number; height: number }
  onPick: (value: Value) => void
  /** "Custom size…" was picked: ask for a width and height. */
  onCustom: () => void
  className?: string
}

const mm = (size: { width: number; height: number }) => `${size.width} × ${size.height} mm`

const ITEM = 'flex cursor-default items-center gap-2 rounded-sm px-2 outline-none data-highlighted:bg-accent'

export function PageSizeMenu<Value extends string>({ options, page, onPick, onCustom, className }: PageSizeMenuProps<Value>) {
  const current = options.find((option) => option.width === page.width && option.height === page.height)
  return (
    <Menu.Root>
      {/* Named by what it shows, with "Page size:" for screen readers, so voice control can say the words on it. */}
      <Menu.Trigger
        className={cn(
          'flex h-6 shrink-0 items-center gap-1.5 rounded-full border bg-panel pr-2 pl-1.5 text-xs text-foreground shadow-xs',
          'transition-colors duration-(--duration-instant) hover:bg-accent data-popup-open:bg-accent',
          'outline-none focus-visible:ring-2 focus-visible:ring-ring',
          className,
        )}
      >
        <PageSizeIcon width={page.width} height={page.height} className="h-4 w-auto" />
        <span className="sr-only">Page size:</span> {current?.label ?? 'Custom'}
        <span className="sr-only">,</span> <span className="text-muted-foreground tabular-nums">{mm(page)}</span>
        <ChevronDown className="size-3 text-muted-foreground" aria-hidden="true" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="start" sideOffset={4} className="z-50 outline-none">
          <Menu.Popup
            className={cn(
              'min-w-60 rounded-md border bg-popover p-1 text-sm text-popover-foreground shadow-md outline-none select-none',
              'origin-(--transform-origin) transition-[opacity,scale] duration-(--duration-fast) ease-enter',
              'data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0',
            )}
          >
            <Menu.RadioGroup aria-label="Page size" value={current?.value ?? null} onValueChange={(value: Value) => onPick(value)}>
              {options.map((option) => (
                <Menu.RadioItem key={option.value} value={option.value} className={cn(ITEM, 'h-10')}>
                  <span className="size-3.5 shrink-0">
                    <Menu.RadioItemIndicator>
                      <Check className="size-3.5" aria-hidden="true" />
                    </Menu.RadioItemIndicator>
                  </span>
                  <PageSizeIcon width={option.width} height={option.height} className="h-7 w-auto shrink-0" />
                  <span className="flex-1">{option.label}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{mm(option)}</span>
                </Menu.RadioItem>
              ))}
            </Menu.RadioGroup>
            <Menu.Separator className="-mx-1 my-1 h-px bg-border" />
            <Menu.Item onClick={onCustom} className={cn(ITEM, 'h-8')}>
              <Ruler className="size-3.5 text-muted-foreground" aria-hidden="true" />
              Custom size…
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
