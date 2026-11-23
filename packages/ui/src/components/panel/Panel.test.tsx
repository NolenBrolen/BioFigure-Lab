import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { setup } from '../../test/render'
import { Panel, PanelSection } from './Panel'

describe('Panel', () => {
  it('closes with its close button, named after the panel', async () => {
    const onClose = vi.fn()
    const { user } = setup(
      <Panel title="Icon library" onClose={onClose}>
        <p>Icons</p>
      </Panel>,
    )
    expect(screen.getByRole('complementary', { name: 'Icon library' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Close icon library' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('folds a section shut and open again', async () => {
    const { user } = setup(
      <Panel title="Properties">
        <PanelSection title="Fill">
          <p>Fill settings</p>
        </PanelSection>
      </Panel>,
    )
    const fill = screen.getByRole('button', { name: 'Fill' })
    expect(fill).toHaveAttribute('aria-expanded', 'true')
    await user.click(fill)
    expect(fill).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Fill settings')).not.toBeInTheDocument()
    await user.click(fill)
    expect(screen.getByText('Fill settings')).toBeVisible()
  })
})
