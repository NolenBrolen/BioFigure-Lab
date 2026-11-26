import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { PageBrightness, usePageBrightness } from './PageBrightness'

const KEY = 'biofigure-lab:page-brightness'

function Harness() {
  const [value, setValue] = usePageBrightness()
  return <PageBrightness value={value} onValueChange={setValue} />
}

const pageDim = () => document.documentElement.style.getPropertyValue('--page-dim')
const pill = () => screen.getByRole('button', { name: /^Page brightness/ })
const openCard = async () => {
  fireEvent.click(pill())
  return screen.findByRole('slider', { name: 'Brightness' })
}

describe('page brightness in dark mode', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.style.removeProperty('--page-dim')
  })
  afterEach(cleanup)

  it('starts at 85% and dims the page by that much', () => {
    render(<Harness />)
    expect(pill()).toHaveAccessibleName('Page brightness, 85%')
    expect(pageDim()).toBe('0.85')
  })

  it('opens a card that explains it and changes the page with the arrow keys', async () => {
    render(<Harness />)
    const slider = await openCard()
    expect(screen.getByText(/everything you export stay pure white/)).toBeInTheDocument()
    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    expect(pill()).toHaveAccessibleName('Page brightness, 90%')
    expect(pageDim()).toBe('0.9')
  })

  it('remembers the choice in this browser', async () => {
    render(<Harness />)
    fireEvent.keyDown(await openCard(), { key: 'ArrowLeft' })
    cleanup()
    render(<Harness />)
    expect(pill()).toHaveAccessibleName('Page brightness, 80%')
    expect(pageDim()).toBe('0.8')
  })

  it('goes back to 85% from the card', async () => {
    localStorage.setItem(KEY, '60')
    render(<Harness />)
    await openCard()
    const reset = screen.getByRole('button', { name: /Back to 85%/ })
    fireEvent.click(reset)
    expect(pill()).toHaveAccessibleName('Page brightness, 85%')
    expect(reset).toBeDisabled()
  })

  it('falls back to 85% when the saved value is out of range', () => {
    localStorage.setItem(KEY, '5')
    render(<Harness />)
    expect(pill()).toHaveAccessibleName('Page brightness, 85%')
  })
})
