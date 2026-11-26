import { screen } from '@testing-library/react'
import { MoveRight, Shell, Type } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'

import { setup } from '../../test/render'
import { ToolRail, type Tool } from './ToolRail'

const tools: Tool[] = [
  { id: 'icons', label: 'Icons', icon: Shell, panel: <p>Icon library</p> },
  { id: 'arrows', label: 'Arrows', icon: MoveRight },
  { id: 'text', label: 'Text', icon: Type, shortcut: 'T' },
]

describe('ToolRail', () => {
  it('picks the first tool and shows its panel at the start', () => {
    setup(<ToolRail tools={tools} />)
    expect(screen.getByRole('tab', { name: 'Icons' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Icon library')).toBeVisible()
  })

  it('shows a placeholder for a tool without a panel, and reports the pick', async () => {
    const onValueChange = vi.fn()
    const { user } = setup(<ToolRail tools={tools} onValueChange={onValueChange} />)
    await user.click(screen.getByRole('tab', { name: 'Arrows' }))
    expect(onValueChange).toHaveBeenCalledWith('arrows')
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Arrows')
    expect(screen.getByText('Coming soon.')).toBeVisible()
  })

  it('is one Tab stop, with up and down arrows moving between tools', async () => {
    const { user } = setup(<ToolRail tools={tools} />)
    await user.tab()
    expect(screen.getByRole('tab', { name: 'Icons' })).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('tab', { name: 'Arrows' })).toHaveFocus()
    await user.keyboard('{ArrowUp}')
    expect(screen.getByRole('tab', { name: 'Icons' })).toHaveFocus()
  })

  it('keeps a keepMounted panel on the page while another tool is open, so it keeps what was typed in it (BIO-90)', async () => {
    const kept: Tool[] = [{ ...tools[0]!, panel: <input aria-label="Search icons" />, keepMounted: true }, ...tools.slice(1)]
    const { user } = setup(<ToolRail tools={kept} />)
    await user.type(screen.getByRole('textbox', { name: 'Search icons' }), 'mouse')
    await user.click(screen.getByRole('tab', { name: 'Arrows' }))
    expect(screen.getByRole('textbox', { name: 'Search icons', hidden: true })).not.toBeVisible()
    await user.click(screen.getByRole('tab', { name: 'Icons' }))
    expect(screen.getByRole('textbox', { name: 'Search icons' })).toHaveValue('mouse')
  })

  it('names the rail and its tools for screen readers', () => {
    setup(<ToolRail tools={tools} />)
    const rail = screen.getByRole('tablist', { name: 'Tools' })
    expect(rail).toHaveAttribute('aria-orientation', 'vertical')
  })

  it('shows the tool name in a tooltip on hover', async () => {
    const { user } = setup(<ToolRail tools={tools} />)
    await user.hover(screen.getByRole('tab', { name: 'Arrows' }))
    expect(await screen.findByText('Arrows', { selector: 'span' })).toBeVisible()
  })

  it("adds the tool's key in brackets to its tooltip", async () => {
    const { user } = setup(<ToolRail tools={tools} />)
    await user.hover(screen.getByRole('tab', { name: 'Text' }))
    expect(await screen.findByText('Text (T)', { selector: 'span' })).toBeVisible()
    expect(screen.getByRole('tab', { name: 'Text' })).toHaveAttribute('aria-keyshortcuts', 'T')
  })
})
