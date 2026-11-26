import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { setup } from '../../test/render'
import { TemplateCards, type TemplateCard } from './TemplateCards'

const options: TemplateCard[] = [
  { value: 'culture', label: 'Cell culture', detail: 'Steps and a chart', picture: <img alt="" /> },
  { value: 'pathway', label: 'Pathway', picture: <img alt="" /> },
]

describe('TemplateCards', () => {
  it('is a named radio group whose cards are read by name and detail', () => {
    setup(<TemplateCards label="Templates" options={options} value="culture" />)
    expect(screen.getByRole('radiogroup', { name: 'Templates' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Cell culture, Steps and a chart' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Pathway' })).toHaveAttribute('aria-checked', 'false')
  })

  it('reports the card that is clicked', async () => {
    const onValueChange = vi.fn()
    const { user } = setup(<TemplateCards label="Templates" options={options} value="culture" onValueChange={onValueChange} />)
    await user.click(screen.getByText('Pathway'))
    expect(onValueChange).toHaveBeenLastCalledWith('pathway')
  })

  it('moves and picks with the arrow keys after Tab reaches the picked card', async () => {
    const onValueChange = vi.fn()
    const { user } = setup(<TemplateCards label="Templates" options={options} value="culture" onValueChange={onValueChange} />)
    await user.tab()
    expect(screen.getByRole('radio', { name: /Cell culture/ })).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(onValueChange).toHaveBeenLastCalledWith('pathway')
  })
})
