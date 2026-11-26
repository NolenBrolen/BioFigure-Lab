import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { setup } from '../../test/render'
import { TooltipProvider } from '../tooltip/Tooltip'
import { ChartDataEditor, type ChartDataEditorProps } from './ChartDataEditor'
import { GraphPanel } from './GraphPanel'

describe('GraphPanel', () => {
  it('picks a chart and error bars with clicks and arrow keys', async () => {
    const onPick = vi.fn()
    const onErrorBarsChange = vi.fn()
    const { user } = setup(<GraphPanel picked="bar" onPick={onPick} errorBars="sd" onErrorBarsChange={onErrorBarsChange} />)
    expect(screen.getByRole('radio', { name: /Bar/ })).toBeChecked()
    await user.click(screen.getByRole('radio', { name: /Scatter/ }))
    expect(onPick).toHaveBeenLastCalledWith('scatter')
    screen.getByRole('radio', { name: 'SD' }).focus()
    await user.keyboard('{ArrowRight}')
    expect(onErrorBarsChange).toHaveBeenLastCalledWith('sem')
  })
})

const editor = (props: Partial<ChartDataEditorProps> = {}) => (
  <ChartDataEditor
    groups={[
      { name: 'Control', values: [1, 2] },
      { name: 'Drug', values: [3, null] },
    ]}
    colours={['#0072B2', '#E69F00']}
    view="table"
    onViewChange={vi.fn()}
    onValue={vi.fn()}
    onRename={vi.fn()}
    onPaste={vi.fn()}
    onAddGroup={vi.fn()}
    onRemoveGroup={vi.fn()}
    onMoveGroup={vi.fn()}
    onAddRow={vi.fn()}
    {...props}
  />
)

describe('ChartDataEditor', () => {
  it('sends typed values and names as they are typed', async () => {
    const onValue = vi.fn()
    const onRename = vi.fn()
    const { user } = setup(editor({ onValue, onRename }))
    const cell = screen.getByRole('textbox', { name: 'Drug, row 2' })
    await user.type(cell, '4.5')
    expect(onValue).toHaveBeenLastCalledWith(1, 1, '4.5')
    expect(cell).toHaveValue('4.5')
    await user.type(screen.getByRole('textbox', { name: 'Group 1 name' }), 's')
    expect(onRename).toHaveBeenLastCalledWith(0, 'Controls')
  })

  it('hands a pasted block from a spreadsheet to the chart, at the cell pasted into', () => {
    const onPaste = vi.fn()
    const onValue = vi.fn()
    setup(editor({ onPaste, onValue }))
    fireEvent.paste(screen.getByRole('textbox', { name: 'Control, row 2' }), { clipboardData: { getData: () => '5\t6\n7\t8' } })
    expect(onPaste).toHaveBeenCalledWith('5\t6\n7\t8', { group: 0, row: 1 })
    expect(onValue).not.toHaveBeenCalled()
  })

  it('switches between the table and the group cards', async () => {
    const onViewChange = vi.fn()
    const { user, rerender } = setup(editor({ onViewChange }))
    await user.click(screen.getByRole('tab', { name: 'Groups' }))
    expect(onViewChange).toHaveBeenCalledWith('groups')
    rerender(editor({ view: 'groups' }))
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Drug, value 1' })).toHaveValue('3')
  })

  it('moves a group with Alt+arrow keys in its name, as dragging its grip does', async () => {
    const onMoveGroup = vi.fn()
    const { user } = setup(editor({ onMoveGroup }))
    await user.click(screen.getByRole('textbox', { name: 'Group 1 name' }))
    await user.keyboard('{Alt>}{ArrowRight}{/Alt}')
    // Lands in the gap after the second group.
    expect(onMoveGroup).toHaveBeenCalledWith(0, 2)
  })

  it('minimises to its header bar and opens again', async () => {
    const onCollapsedChange = vi.fn()
    const { user, rerender } = setup(editor({ onCollapsedChange }))
    await user.click(screen.getByRole('button', { name: 'Minimise the data' }))
    expect(onCollapsedChange).toHaveBeenCalledWith(true)
    rerender(editor({ collapsed: true, onCollapsedChange }))
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show the data' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('closes with × in place of minimising when the app gives onClose', async () => {
    const onClose = vi.fn()
    const { user } = setup(editor({ onClose, onCollapsedChange: vi.fn() }))
    expect(screen.queryByRole('button', { name: 'Minimise the data' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Close the data' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('Enter moves down a column', async () => {
    const { user } = setup(editor())
    await user.click(screen.getByRole('textbox', { name: 'Control, row 1' }))
    await user.keyboard('{Enter}')
    expect(screen.getByRole('textbox', { name: 'Control, row 2' })).toHaveFocus()
  })

  it('has a full screen button only when asked, and Escape inside leaves full screen', async () => {
    const onFullScreenChange = vi.fn()
    const { user, rerender } = setup(editor())
    expect(screen.queryByRole('button', { name: 'Full screen' })).not.toBeInTheDocument()

    rerender(<TooltipProvider delay={0}>{editor({ onFullScreenChange })}</TooltipProvider>)
    await user.click(screen.getByRole('button', { name: 'Full screen' }))
    expect(onFullScreenChange).toHaveBeenLastCalledWith(true)

    rerender(<TooltipProvider delay={0}>{editor({ onFullScreenChange, fullScreen: true })}</TooltipProvider>)
    expect(screen.getByRole('button', { name: 'Exit full screen' })).toBeInTheDocument()
    screen.getByRole('textbox', { name: 'Drug, row 2' }).focus()
    await user.keyboard('{Escape}')
    expect(onFullScreenChange).toHaveBeenLastCalledWith(false)
  })

  it('shows the preview only in full screen, and keeps the full screen button while minimised', async () => {
    const onFullScreenChange = vi.fn()
    const preview = <div role="img" aria-label="Chart preview" />
    const { user, rerender } = setup(editor({ onFullScreenChange, preview }))
    expect(screen.queryByRole('img', { name: 'Chart preview' })).not.toBeInTheDocument()

    rerender(<TooltipProvider delay={0}>{editor({ onFullScreenChange, preview, fullScreen: true })}</TooltipProvider>)
    expect(screen.getByRole('img', { name: 'Chart preview' })).toBeInTheDocument()

    rerender(<TooltipProvider delay={0}>{editor({ onFullScreenChange, preview, collapsed: true, onCollapsedChange: vi.fn() })}</TooltipProvider>)
    await user.click(screen.getByRole('button', { name: 'Full screen' }))
    expect(onFullScreenChange).toHaveBeenLastCalledWith(true)
    expect(screen.queryByRole('img', { name: 'Chart preview' })).not.toBeInTheDocument()
  })

  it('adds a column from the tile after the last group', async () => {
    const onAddGroup = vi.fn()
    const { user } = setup(editor({ onAddGroup }))
    expect(screen.getByText('New column')).toBeInTheDocument()
    const add = screen.getByRole('button', { name: 'Add column' })
    // A plus above the words, as one label.
    expect(add.firstElementChild).toHaveTextContent('New column')
    expect(add.firstElementChild?.querySelector('svg')).not.toBeNull()
    await user.click(add)
    expect(onAddGroup).toHaveBeenCalledOnce()
  })

  it('draws only the rows in view of a long data set, and more of them when scrolled', async () => {
    const groups = Array.from({ length: 8 }, (_, g) => ({ name: `G${g}`, values: Array.from({ length: 200 }, (_, r) => r + g / 10) }))
    const { container } = setup(editor({ groups, colours: ['#0072B2'] }))
    expect(screen.getAllByRole('textbox').length).toBeLessThan(8 * 200 * 0.3)
    expect(screen.getByRole('textbox', { name: 'G1, row 3' })).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'G1, row 180' })).not.toBeInTheDocument()

    // jsdom has no layout: say how far the box is scrolled (the table body sits 5000 px above its top) and how tall it is.
    const box = container.querySelector<HTMLElement>('[data-scroll]')!
    Object.defineProperty(box, 'clientHeight', { value: 400, configurable: true })
    container.querySelector('tbody')!.getBoundingClientRect = () => ({ top: -5000, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: -5000, toJSON: () => ({}) })
    fireEvent.scroll(box)
    const far = await screen.findByRole('textbox', { name: 'G1, row 180' })
    expect(screen.queryByRole('textbox', { name: 'G1, row 3' })).not.toBeInTheDocument()
    far.focus()
    expect(far).toHaveFocus()
  })

  it('resizes the corner preview card by its top-left corner, within its limits, and resets on double-click', () => {
    // jsdom has no layout: the card is 480 px wide and the data card 1000 px.
    const rect = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const width = this.getAttribute('aria-label') === 'Chart preview card' ? 480 : this.classList.contains('relative') && this.classList.contains('flex-1') ? 1000 : 0
      return { width, height: 0, top: 0, left: 0, right: width, bottom: 0, x: 0, y: 0, toJSON: () => ({}) }
    })
    try {
      const { container } = setup(editor({ onFullScreenChange: vi.fn(), fullScreen: true, preview: <div role="img" aria-label="Chart preview" /> }))
      const card = screen.getByRole('group', { name: 'Chart preview card' })
      const grip = container.querySelector<HTMLElement>('[data-resize-grip]')!
      expect(card.style.width).toBe('var(--data-preview-width, 360px)')

      fireEvent.pointerDown(grip, { clientX: 500, pointerId: 1 })
      fireEvent.pointerMove(grip, { clientX: 400, pointerId: 1 })
      expect(card.style.width).toBe('580px') // dragged 100 px to the left
      fireEvent.pointerMove(grip, { clientX: -2000, pointerId: 1 })
      expect(card.style.width).toBe('800px') // at most 80% of the data card
      fireEvent.pointerMove(grip, { clientX: 3000, pointerId: 1 })
      expect(card.style.width).toBe('240px') // at least 240 px
      fireEvent.pointerUp(grip, { pointerId: 1 })
      fireEvent.pointerMove(grip, { clientX: 0, pointerId: 1 })
      expect(card.style.width).toBe('240px') // no longer dragging

      fireEvent.doubleClick(grip)
      expect(card.style.width).toBe('var(--data-preview-width, 360px)')
    } finally {
      rect.mockRestore()
    }
  })

  it('moves the preview card by dragging it and settles it into the nearest corner, the resize mark facing the middle', () => {
    // jsdom has no layout: the data card is 1000 x 600, the preview card 360 x 200 in its bottom-right corner.
    const rect = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const isCard = this.getAttribute('aria-label') === 'Chart preview card'
      const isBody = this.classList.contains('relative') && this.classList.contains('flex-1')
      const [left, top, width, height] = isCard ? [628, 388, 360, 200] : isBody ? [0, 0, 1000, 600] : [0, 0, 0, 0]
      return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }
    })
    try {
      const { container } = setup(editor({ onFullScreenChange: vi.fn(), fullScreen: true, preview: <div role="img" aria-label="Chart preview" /> }))
      const card = screen.getByRole('group', { name: 'Chart preview card' })
      const grip = () => container.querySelector<HTMLElement>('[data-resize-grip]')!
      expect(card.dataset.corner).toBe('bottom-right')
      expect(grip().dataset.grip).toBe('top-left')

      fireEvent.pointerDown(card, { clientX: 800, clientY: 480, pointerId: 1 })
      fireEvent.pointerMove(card, { clientX: 100, clientY: 80, pointerId: 1 })
      expect(card.style.transform).toBe('translate(-700px, -400px)') // follows the pointer
      expect(card.style.transition).toBe('none')
      fireEvent.pointerUp(card, { pointerId: 1 })
      expect(card.dataset.corner).toBe('top-left')
      expect(grip().dataset.grip).toBe('bottom-right')

      // From the top-left, dragging the mark to the right makes the card larger.
      fireEvent.pointerDown(grip(), { clientX: 300, pointerId: 2 })
      fireEvent.pointerMove(grip(), { clientX: 350, pointerId: 2 })
      expect(card.style.width).toBe('410px')
    } finally {
      rect.mockRestore()
    }
  })
})
