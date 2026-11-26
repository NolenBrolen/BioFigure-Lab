import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { setup } from '../../test/render'
import { TextArea } from './TextArea'

describe('TextArea', () => {
  it('is a multi-line box named by its label and reports what is typed', async () => {
    const onValueChange = vi.fn()
    const { user } = setup(<TextArea label="Tell us more" onValueChange={onValueChange} />)
    const box = screen.getByRole('textbox', { name: 'Tell us more' })
    await user.type(box, 'Hi')
    expect(onValueChange).toHaveBeenLastCalledWith('Hi')
  })

  it('shows its error and marks the box as invalid', () => {
    setup(<TextArea label="Tell us more" error="Add a few words." description="Help line" />)
    const box = screen.getByRole('textbox', { name: 'Tell us more' })
    expect(box).toBeInvalid()
    expect(screen.getByText('Add a few words.')).toBeInTheDocument()
    expect(screen.queryByText('Help line')).not.toBeInTheDocument()
  })
})
