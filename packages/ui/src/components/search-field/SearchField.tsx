/*
 * Search field with its filter button directly to the right, as used at the
 * top of panels (the icon library first). Every panel uses this one
 * component, so search and filter sit in the same place and size everywhere.
 * The field looks like a text field, the filter button like an icon button.
 *
 * It is a bit taller than other fields (36 px), so the main search of a panel
 * stands out and is easy to hit; the filter button matches its height.
 *
 * Typing shows a clear (×) button; Escape also clears. The clear button's
 * space is always reserved, so nothing shifts when it appears.
 */
import { Button as ButtonPrimitive } from '@base-ui/react/button'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { useId, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'

import { cn } from '../../lib/cn'
import { iconButtonVariants } from '../icon-button/IconButton'
import { inputBoxClass } from '../text-field/TextField'
import { Tooltip } from '../tooltip/Tooltip'

export type SearchFieldProps = {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  /** The field's name for screen readers. */
  label?: string
  /** Called when the filter button is clicked. Leave out to hide the button. */
  onFilterClick?: () => void
  /** How many filters are switched on. Shown as a small count on the button. */
  filterCount?: number
  filterLabel?: string
  className?: string
}

export function SearchField({
  value: valueProp,
  defaultValue = '',
  onValueChange,
  placeholder = 'Search',
  label = 'Search',
  onFilterClick,
  filterCount = 0,
  filterLabel = 'Filter',
  className,
}: SearchFieldProps) {
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const [ownValue, setOwnValue] = useState(defaultValue)
  const value = valueProp ?? ownValue

  const setValue = (next: string) => {
    if (valueProp === undefined) setOwnValue(next)
    onValueChange?.(next)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape' && value) {
      // Clear the search instead of letting Escape close whatever panel we're in.
      event.preventDefault()
      event.stopPropagation()
      setValue('')
    }
  }

  const clear = () => {
    setValue('')
    input.current?.focus()
  }

  // Clicking the icon or padding puts the cursor in the field.
  const focusInput = (event: MouseEvent) => {
    if (event.target instanceof HTMLInputElement || (event.target as Element).closest('button')) return
    event.preventDefault()
    input.current?.focus()
  }

  const filterName = filterCount > 0 ? `${filterLabel}, ${filterCount} on` : filterLabel

  return (
    <div className={cn('flex min-w-0 items-center gap-1.5', className)}>
      <div onMouseDown={focusInput} className={cn(inputBoxClass, 'h-9 flex-1 px-2.5')}>
        <Search className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
        <input
          ref={input}
          id={id}
          type="search"
          value={value}
          placeholder={placeholder}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={onKeyDown}
          className="h-full w-full min-w-0 bg-transparent text-foreground outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:appearance-none"
        />
        <button
          type="button"
          aria-label="Clear search"
          aria-hidden={!value}
          tabIndex={-1}
          onClick={clear}
          className={cn(
            'grid size-5 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground',
            !value && 'invisible',
          )}
        >
          <X className="size-3.5" strokeWidth={2} aria-hidden="true" />
        </button>
      </div>

      {onFilterClick && (
        <Tooltip label={filterName}>
          {/* Styled like a switched-on icon button while filters are on. */}
          <ButtonPrimitive type="button" onClick={onFilterClick} className={cn(iconButtonVariants({ pressed: filterCount > 0 }), 'size-9')}>
            <SlidersHorizontal strokeWidth={1.75} aria-hidden="true" />
            <span className="sr-only">{filterName}</span>
            {filterCount > 0 && (
              <span
                aria-hidden="true"
                className="absolute -top-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-2xs font-semibold text-primary-foreground tabular-nums ring-2 ring-panel"
              >
                {filterCount}
              </span>
            )}
          </ButtonPrimitive>
        </Tooltip>
      )}
    </div>
  )
}
