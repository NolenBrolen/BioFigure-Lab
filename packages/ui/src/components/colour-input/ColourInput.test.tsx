import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { setup } from '../../test/render'
import { ColourInput, readHex } from './ColourInput'

function renderInput(props: Partial<Parameters<typeof ColourInput>[0]> = {}) {
  const onChange = vi.fn()
  const view = setup(<ColourInput label="Fill" look="fill" value="#dbeafe" onChange={onChange} noneLabel="No fill" {...props} />)
  return { ...view, onChange }
}

describe('ColourInput', () => {
  it('shows the hex code without # and applies a typed one on Enter', async () => {
    const { user, onChange } = renderInput()
    const field = screen.getByRole('textbox', { name: 'Fill' })
    expect(field).toHaveValue('DBEAFE')
    await user.clear(field)
    await user.type(field, 'f00{Enter}')
    expect(onChange).toHaveBeenCalledWith('#ff0000')
  })

  it('puts the old code back when the typed one is not a colour', async () => {
    const { user, onChange } = renderInput()
    const field = screen.getByRole('textbox', { name: 'Fill' })
    await user.clear(field)
    await user.type(field, 'blue{Enter}')
    expect(onChange).not.toHaveBeenCalled()
    expect(field).toHaveValue('DBEAFE')
  })

  it('opens swatches from its button and applies a picked one, staying open', async () => {
    const { user, onChange } = renderInput({ used: () => ['#2563eb'] })
    await user.click(screen.getByRole('button', { name: 'Fill colours' }))
    const menu = await screen.findByRole('dialog', { name: 'Fill' })
    expect(screen.getByRole('group', { name: 'In this figure' })).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: '#009E73' })[0]!)
    expect(onChange).toHaveBeenCalledWith('#009e73')
    expect(menu).toBeInTheDocument()
  })

  it('takes the colour away with the none button', async () => {
    const { user, onChange } = renderInput()
    await user.click(screen.getByRole('button', { name: 'Fill colours' }))
    await user.click(await screen.findByRole('button', { name: 'No fill' }))
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('reads short and long hex codes', () => {
    expect(readHex('#ABC')).toBe('#aabbcc')
    expect(readHex(' 1f2937 ')).toBe('#1f2937')
    expect(readHex('12345')).toBeUndefined()
  })
})
