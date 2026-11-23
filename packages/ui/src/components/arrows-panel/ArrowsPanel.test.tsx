import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { setup } from '../../test/render'
import { ShapesPanel } from '../shapes-panel/ShapesPanel'
import { ArrowsPanel, type ArrowsPanelProps } from './ArrowsPanel'

const arrows = (props: Partial<ArrowsPanelProps> = {}) => (
  <ArrowsPanel route="straight" line="solid" onRouteChange={vi.fn()} onLineChange={vi.fn()} onPick={vi.fn()} {...props} />
)

describe('ArrowsPanel', () => {
  it('names the picture-only switches for screen readers', () => {
    setup(arrows({ line: 'dashed' }))
    expect(screen.getByRole('radiogroup', { name: 'Path' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Straight' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Dashed' })).toBeChecked()
  })

  it('switches the path with a click and with the arrow keys', async () => {
    const onRouteChange = vi.fn()
    const { user } = setup(arrows({ onRouteChange }))
    await user.click(screen.getByRole('radio', { name: 'Elbow' }))
    expect(onRouteChange).toHaveBeenLastCalledWith('elbow')
    await user.click(screen.getByRole('radio', { name: 'U-shape' }))
    expect(onRouteChange).toHaveBeenLastCalledWith('u-shape')
    screen.getByRole('radio', { name: 'Straight' }).focus()
    await user.keyboard('{ArrowRight}')
    expect(onRouteChange).toHaveBeenLastCalledWith('curved')
  })

  it('picks an arrow end and shows which one is picked', async () => {
    const onPick = vi.fn()
    const { user } = setup(arrows({ onPick, picked: 'binding' }))
    await user.click(screen.getByRole('button', { name: 'Inhibition' }))
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: 'inhibition', end: 'inhibition' }))
    expect(screen.getByRole('button', { name: 'Binding' })).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('ShapesPanel', () => {
  it('picks a shape', async () => {
    const onPick = vi.fn()
    const { user } = setup(<ShapesPanel onPick={onPick} picked="star" />)
    await user.click(screen.getByRole('button', { name: 'Cell' }))
    expect(onPick).toHaveBeenCalledWith('cell')
    expect(screen.getByRole('button', { name: 'Star' })).toHaveAttribute('aria-pressed', 'true')
  })
})
