import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { setup } from '../../test/render'
import { GRAPH_TYPES, GraphList, GraphTypePicker } from './GraphTypePicker'

describe('GraphTypePicker', () => {
  it('shows the three common graphs and picks one with a click or arrow keys', async () => {
    const onChange = vi.fn()
    const { user } = setup(<GraphTypePicker value="bar" onChange={onChange} />)
    expect(screen.getAllByRole('radio').map((r) => r.textContent)).toEqual(['Bar', 'Line', 'Scatter'])
    await user.click(screen.getByRole('radio', { name: /Scatter/ }))
    expect(onChange).toHaveBeenLastCalledWith('scatter')
    screen.getByRole('radio', { name: /Bar/ }).focus()
    await user.keyboard('{ArrowRight}')
    expect(onChange).toHaveBeenLastCalledWith('line')
  })

  it('gives a graph picked from More the third place', () => {
    setup(<GraphTypePicker value="violin" onChange={vi.fn()} />)
    expect(screen.getAllByRole('radio').map((r) => r.textContent)).toEqual(['Bar', 'Line', 'Violin'])
    expect(screen.getByRole('radio', { name: /Violin/ })).toBeChecked()
  })

  it('opens every graph under family tabs, picks one and closes', async () => {
    const onChange = vi.fn()
    const { user } = setup(<GraphTypePicker value="bar" onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: 'More graphs' }))
    const popup = await screen.findByRole('dialog')
    await user.click(within(popup).getByRole('tab', { name: 'Box' }))
    expect(within(popup).getAllByRole('radio').map((r) => r.textContent)).toEqual(['Floating bars', 'Box', 'Violin', 'Float, wide', 'Box, wide', 'Violin, wide'])
    await user.click(within(popup).getByRole('radio', { name: 'Violin' }))
    expect(onChange).toHaveBeenLastCalledWith('violin')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('searches every family at once, whichever tab is open', async () => {
    const { user } = setup(<GraphTypePicker value="bar" onChange={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'More graphs' }))
    const popup = await screen.findByRole('dialog')
    await user.type(within(popup).getByRole('searchbox', { name: 'Search graphs' }), 'violin')
    expect(within(popup).getAllByRole('radio').map((r) => r.textContent)).toEqual(['Violin + dots', 'Violin', 'Violin, wide'])
    await user.clear(within(popup).getByRole('searchbox', { name: 'Search graphs' }))
    await user.type(within(popup).getByRole('searchbox', { name: 'Search graphs' }), 'zzz')
    expect(within(popup).getByText('No graph matches that search.')).toBeInTheDocument()
  })

  it('has six graphs in Individual and Box, and seven in Mean with Bar + line last', async () => {
    const { user } = setup(<GraphTypePicker value="bar" onChange={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'More graphs' }))
    const popup = await screen.findByRole('dialog')
    for (const tab of ['Individual', 'Box']) {
      await user.click(within(popup).getByRole('tab', { name: tab }))
      expect(within(popup).getAllByRole('radio'), tab).toHaveLength(6)
    }
    await user.click(within(popup).getByRole('tab', { name: 'Mean' }))
    expect(within(popup).getAllByRole('radio').map((r) => r.textContent)).toEqual(['Bar', 'Point', 'Line', 'Bar, wide', 'Point, wide', 'Slope', 'Bar + line'])
  })

  it('the full list shows every graph under its family name, and a click picks one', async () => {
    const onPick = vi.fn()
    const { user } = setup(<GraphList onPick={onPick} />)
    expect(screen.getAllByRole('radio')).toHaveLength(GRAPH_TYPES.length)
    expect(screen.getAllByRole('heading').length).toBeGreaterThanOrEqual(3)
    await user.click(within(screen.getByRole('radiogroup', { name: /Mean/ })).getByRole('radio', { name: /Slope/ }))
    expect(onPick).toHaveBeenCalledWith('slope')
  })
})
