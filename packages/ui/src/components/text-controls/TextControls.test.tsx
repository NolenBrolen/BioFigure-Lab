import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { setup } from '../../test/render'
import { TextControls, type TextControlsValue } from './TextControls'

const fonts = [
  { name: 'Inter', category: 'Sans serif', family: 'Inter' },
  { name: 'Source Serif 4', category: 'Serif', family: 'serif' },
  { name: 'JetBrains Mono', category: 'Monospace', family: 'monospace' },
]

const value: TextControlsValue = {
  font: 'Inter',
  weight: 400,
  bold: false,
  size: 12,
  italic: false,
  underline: false,
  strikethrough: false,
  script: 'none',
  colour: '#1f2937',
  highlight: '',
  align: 'left',
  lineSpacing: 1.16,
  letterSpacing: 0,
}

function controls(extra: Partial<TextControlsValue> = {}) {
  const onChange = vi.fn()
  const onSymbol = vi.fn()
  const onPreview = vi.fn()
  const result = setup(<TextControls value={{ ...value, ...extra }} fonts={fonts} weights={[300, 400, 700]} onChange={onChange} onPreview={onPreview} onSymbol={onSymbol} />)
  return { ...result, onChange, onSymbol, onPreview }
}

describe('TextControls', () => {
  it('switches subscript on, and off again when it is already on', async () => {
    const { user, onChange, unmount } = controls()
    await user.click(screen.getByRole('button', { name: 'Subscript' }))
    expect(onChange).toHaveBeenLastCalledWith({ script: 'sub' })
    unmount()
    const on = controls({ script: 'sub' })
    expect(screen.getByRole('button', { name: 'Subscript' })).toHaveAttribute('aria-pressed', 'true')
    await on.user.click(screen.getByRole('button', { name: 'Subscript' }))
    expect(on.onChange).toHaveBeenLastCalledWith({ script: 'none' })
  })

  it('keeps bold apart from the weight', async () => {
    const { user, onChange, unmount } = controls()
    await user.click(screen.getByRole('button', { name: 'Bold' }))
    expect(onChange).toHaveBeenLastCalledWith({ bold: true })
    unmount()
    controls({ weight: 700 })
    expect(screen.getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('finds fonts by name or group when searching in the font list', async () => {
    const { user, onChange } = controls()
    await user.click(screen.getByRole('combobox', { name: 'Font: Inter' }))
    await user.type(await screen.findByRole('combobox', { name: 'Search fonts' }), 'serif')
    expect(screen.queryByRole('option', { name: 'JetBrains Mono' })).toBeNull()
    expect(screen.getByRole('option', { name: 'Inter' })).toBeInTheDocument()
    await user.click(screen.getByRole('option', { name: 'Source Serif 4' }))
    expect(onChange).toHaveBeenLastCalledWith({ font: 'Source Serif 4' })
  })

  it('inserts a symbol without taking the keyboard from the text being typed', async () => {
    const { user, onSymbol } = controls()
    const typing = document.createElement('textarea')
    document.body.append(typing)
    typing.focus()
    await user.click(screen.getByRole('button', { name: 'Insert equilibrium' }))
    expect(onSymbol).toHaveBeenCalledWith('⇌')
    expect(typing).toHaveFocus()
    typing.remove()
  })

  it('previews the font being hovered, and puts it back when the list closes without a pick', async () => {
    const { user, onPreview, onChange } = controls()
    await user.click(screen.getByRole('combobox', { name: 'Font: Inter' }))
    await user.hover(await screen.findByRole('option', { name: 'JetBrains Mono' }))
    expect(onPreview).toHaveBeenLastCalledWith({ font: 'JetBrains Mono' })
    await user.keyboard('{Escape}')
    expect(onPreview).toHaveBeenLastCalledWith(null)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('takes a typed size in points, steps it with the arrow keys and the − and + buttons', async () => {
    const { user, onChange } = controls()
    const size = screen.getByRole('textbox', { name: 'Font size' })
    await user.clear(size)
    await user.type(size, '18{Enter}')
    expect(onChange).toHaveBeenLastCalledWith({ size: 18 })
    await user.click(size)
    await user.keyboard('{ArrowUp}')
    expect(onChange).toHaveBeenLastCalledWith({ size: 19 })
    await user.click(screen.getByRole('button', { name: 'Bigger' }))
    expect(onChange).toHaveBeenLastCalledWith({ size: 13 })
    await user.click(screen.getByRole('button', { name: 'Smaller' }))
    expect(onChange).toHaveBeenLastCalledWith({ size: 11 })
  })

  it('removes the highlight with its own button', async () => {
    const { user, onChange } = controls({ highlight: '#fde68a' })
    await user.click(screen.getByRole('button', { name: 'No highlight' }))
    expect(onChange).toHaveBeenLastCalledWith({ highlight: '' })
  })

  describe('rows (Shapes panel)', () => {
    function rows() {
      const onChange = vi.fn()
      const onSymbol = vi.fn()
      const result = setup(<TextControls rows value={value} fonts={fonts} weights={[300, 400, 700]} onChange={onChange} onSymbol={onSymbol} />)
      return { ...result, onChange, onSymbol }
    }

    it('shows one row of symbols and the rest with More symbols', async () => {
      const { user, onSymbol } = rows()
      expect(screen.queryByRole('button', { name: 'Insert omega' })).not.toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'More symbols' }))
      await user.click(screen.getByRole('button', { name: 'Insert omega' }))
      expect(onSymbol).toHaveBeenCalledWith('ω')
    })

    it('keeps strikethrough and sub/superscript behind More text styles', async () => {
      const { user, onChange } = rows()
      expect(screen.queryByRole('button', { name: 'Strikethrough' })).not.toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'More text styles' }))
      await user.click(await screen.findByRole('menuitemcheckbox', { name: 'Superscript' }))
      expect(onChange).toHaveBeenLastCalledWith({ script: 'super' })
    })

    it('picks a highlight from its swatches, and takes it away again', async () => {
      const { user, onChange } = rows()
      await user.click(screen.getByRole('button', { name: 'Highlight colours' }))
      await user.click((await screen.findAllByRole('button', { name: '#F8F2A0' }))[0]!)
      expect(onChange).toHaveBeenLastCalledWith({ highlight: '#f8f2a0' })
      await user.click(screen.getByRole('button', { name: 'No highlight' }))
      expect(onChange).toHaveBeenLastCalledWith({ highlight: '' })
    })
  })
})
