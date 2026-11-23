import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'

import { TooltipProvider } from '../components/tooltip/Tooltip'

/** Renders a component the way the app will (inside the tooltip provider) and sets up a pretend user. */
export function setup(ui: ReactElement) {
  const user = userEvent.setup()
  const result = render(<TooltipProvider delay={0}>{ui}</TooltipProvider>)
  return { user, ...result }
}
