import { TooltipProvider } from '@biofigure-lab/ui/components/tooltip/Tooltip'
import { ToastProvider } from '@biofigure-lab/ui/components/toast/Toast'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { FigureStore } from '../editor/storage'
import { StartScreen } from '../screen/StartScreen'

// The public release builds the editor with noSite: no sign-in and no feedback anywhere.
vi.mock('./site', async () => ({ site: (await import('./no-site')).noSite }))

describe('the editor without the live site', () => {
  it('has no Sign in or Feedback button on the start screen', async () => {
    const store = { list: () => Promise.resolve([]), subscribe: () => () => undefined } as unknown as FigureStore
    render(
      <ToastProvider>
        <TooltipProvider delay={0}>
          <StartScreen store={store} ready={Promise.resolve()} onOpen={() => undefined} />
        </TooltipProvider>
      </ToastProvider>,
    )
    expect(await screen.findByText('No figures yet')).toBeInTheDocument()
    expect(screen.getByText('Saved in this browser as you work. No account needed.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sign in' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Feedback' })).not.toBeInTheDocument()
  })
})
