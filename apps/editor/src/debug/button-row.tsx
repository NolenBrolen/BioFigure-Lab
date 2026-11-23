/*
 * A Leva control that puts several buttons side by side in one row, to keep
 * the debug panel short. Leva's own `buttonGroup` shows its buttons as plain
 * text; these look like Leva's normal blue buttons.
 *
 *   'Canvas': buttonRow({ Fill: (get) => ..., Empty: () => ... })
 */
import { Components, createPlugin, styled, useInputContext, useStoreContext } from 'leva/plugin'

type Get = (path: string) => unknown
type Buttons = Record<string, (get: Get) => void>

// The same look as Leva's own button, sharing the row's width.
const RowButton = styled('button', {
  $reset: '',
  flex: 1,
  minWidth: 0,
  fontWeight: '$button',
  height: '$rowHeight',
  borderStyle: 'none',
  borderRadius: '$sm',
  color: '$highlight3',
  backgroundColor: '$accent2',
  cursor: 'pointer',
  $hover: '$accent3',
  $active: '$accent3 $accent1',
  $focus: '',
})

function ButtonRow() {
  const { value } = useInputContext<{ value: Buttons }>()
  const store = useStoreContext()
  return (
    <Components.Row>
      <div style={{ display: 'flex', gap: 'var(--leva-space-colGap, 3px)' }}>
        {Object.entries(value).map(([label, onClick]) => (
          <RowButton key={label} type="button" onClick={() => onClick(store.get)}>
            {label}
          </RowButton>
        ))}
      </div>
    </Components.Row>
  )
}

export const buttonRow = createPlugin({
  normalize: (buttons: Buttons) => ({ value: buttons }),
  component: ButtonRow,
})
