import { screen } from '@testing-library/react'
import { LayoutGrid, List } from 'lucide-react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { setup } from '../../test/render'
import { SegmentedToggle } from './SegmentedToggle'

const options = [
  { value: 'tiles', icon: LayoutGrid, label: 'Show as tiles' },
  { value: 'list', icon: List, label: 'Show as list' },
] as const

function ViewSwitch({ onChange }: { onChange?: (value: string) => void }) {
  const [view, setView] = useState<'tiles' | 'list'>('tiles')
  return (
    <SegmentedToggle
      label="View"
      options={options}
      value={view}
      onValueChange={(next) => {
        setView(next)
        onChange?.(next)
      }}
    />
  )
}

describe('SegmentedToggle', () => {
  it('is one named group whose options say which one is chosen', () => {
    setup(<ViewSwitch />)
    expect(screen.getByRole('group', { name: 'View' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show as tiles' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Show as list' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('picks an option when clicked', async () => {
    const onChange = vi.fn()
    const { user } = setup(<ViewSwitch onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: 'Show as list' }))
    expect(onChange).toHaveBeenCalledWith('list')
    expect(screen.getByRole('button', { name: 'Show as list' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Show as tiles' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('switches to the other option when the chosen one or the track is clicked', async () => {
    const onChange = vi.fn()
    const { user } = setup(<ViewSwitch onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: 'Show as tiles' }))
    expect(onChange).toHaveBeenLastCalledWith('list')
    expect(screen.getByRole('button', { name: 'Show as list' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('group', { name: 'View' }))
    expect(onChange).toHaveBeenLastCalledWith('tiles')
    expect(screen.getByRole('button', { name: 'Show as tiles' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('can be used with the keyboard: arrow to an option, Enter to pick it', async () => {
    const { user } = setup(<ViewSwitch />)
    await user.tab()
    expect(screen.getByRole('button', { name: 'Show as tiles' })).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('button', { name: 'Show as list' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('button', { name: 'Show as list' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows the option label as a tooltip', async () => {
    const { user } = setup(<ViewSwitch />)
    await user.hover(screen.getByRole('button', { name: 'Show as list' }))
    expect(await screen.findByText('Show as list')).toBeInTheDocument()
  })

  it('can write the labels on the options instead', async () => {
    const onChange = vi.fn()
    const { user } = setup(<SegmentedToggle label="View" showLabels options={options} value="tiles" onValueChange={onChange} />)
    expect(screen.getByRole('button', { name: 'Show as list' })).toHaveTextContent('Show as list')
    await user.click(screen.getByText('Show as list'))
    expect(onChange).toHaveBeenCalledWith('list')
  })

  it('shows pictures instead of icons, each option still named by its label', async () => {
    const onChange = vi.fn()
    const { user } = setup(
      <SegmentedToggle
        label="Icon style"
        value="clean"
        onValueChange={onChange}
        options={[
          { value: 'clean', label: 'Clean', picture: <img src="clean.svg" alt="" /> },
          { value: 'pencil', label: 'Pencil', picture: <img src="pencil.svg" alt="" /> },
        ]}
      />,
    )
    expect(screen.getByRole('group', { name: 'Icon style' }).querySelectorAll('img')).toHaveLength(2)
    await user.click(screen.getByRole('button', { name: 'Pencil' }))
    expect(onChange).toHaveBeenCalledWith('pencil')
  })
})
