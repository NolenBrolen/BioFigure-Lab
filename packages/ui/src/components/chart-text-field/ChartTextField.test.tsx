import { act, fireEvent, screen } from '@testing-library/react'
import axe from 'axe-core'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { setup } from '../../test/render'
import { ChartTextField, type ScriptText } from './ChartTextField'

/** The field, holding its own value like a chart would, reporting each change. */
function Field({ start, multiline = false, onChange = () => {}, onDone }: { start: ScriptText; multiline?: boolean; onChange?: (value: ScriptText) => void; onDone?: () => void }) {
  const [value, setValue] = useState(start)
  return (
    <ChartTextField
      label="Y axis title"
      multiline={multiline}
      value={value}
      onDone={onDone}
      onChange={(next) => {
        setValue(next)
        onChange(next)
      }}
    />
  )
}

const box = () => screen.getByRole('textbox', { name: 'Y axis title' })

/** Put the cursor (or a selection) at letter positions in the field, as clicking or Shift+Arrow would. */
function select(start: number, end = start) {
  const root = box()
  root.focus()
  const point = (index: number): [Node, number] => {
    let left = index
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
      if (left <= node.data.length) return [node, left]
      left -= node.data.length
    }
    return [root, root.childNodes.length]
  }
  const range = document.createRange()
  range.setStart(...point(start))
  range.setEnd(...point(end))
  const selection = window.getSelection()!
  selection.removeAllRanges()
  selection.addRange(range)
  fireEvent.keyUp(root)
}

/** Typing as the browser reports it to an editable box. */
function type(text: string) {
  for (const data of text) fireEvent(box(), new InputEvent('beforeinput', { inputType: 'insertText', data, bubbles: true, cancelable: true }))
}

const parts = () => [...box().querySelectorAll<HTMLElement>('[data-script]')].map((part) => `${part.dataset.script}:${part.textContent}`)

async function violations() {
  const result = await axe.run(document.body, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } })
  return result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html).join(', ')}`)
}

describe('ChartTextField', () => {
  it('makes the selected letters subscript with Ctrl+= and superscript with Ctrl+Shift+=, and shows them that way', () => {
    const onChange = vi.fn()
    setup(<Field start={{ text: 'λGC = 2.53' }} onChange={onChange} />)
    select(1, 3)
    fireEvent.keyDown(box(), { key: '=', code: 'Equal', ctrlKey: true })
    expect(onChange).toHaveBeenLastCalledWith({ text: 'λGC = 2.53', runs: [{ start: 1, end: 3, style: { script: 'sub' } }] })
    expect(parts()).toEqual(['none:λ', 'sub:GC', 'none: = 2.53'])
    select(1, 3)
    fireEvent.keyDown(box(), { key: '+', code: 'Equal', ctrlKey: true, shiftKey: true })
    expect(onChange).toHaveBeenLastCalledWith({ text: 'λGC = 2.53', runs: [{ start: 1, end: 3, style: { script: 'super' } }] })
  })

  it('saves letters typed after Ctrl+= as sub-script runs, and Ctrl+Z undoes inside the field', () => {
    const onChange = vi.fn()
    setup(<Field start={{ text: 'CO' }} onChange={onChange} />)
    select(2)
    fireEvent.keyDown(box(), { key: '=', ctrlKey: true })
    type('2')
    expect(onChange).toHaveBeenLastCalledWith({ text: 'CO2', runs: [{ start: 2, end: 3, style: { script: 'sub' } }] })
    fireEvent.keyDown(box(), { key: 'z', ctrlKey: true })
    expect(onChange).toHaveBeenLastCalledWith({ text: 'CO' })
    fireEvent.keyDown(box(), { key: 'z', ctrlKey: true, shiftKey: true })
    expect(onChange).toHaveBeenLastCalledWith({ text: 'CO2', runs: [{ start: 2, end: 3, style: { script: 'sub' } }] })
  })

  it('puts symbols in where the cursor was, one after another, with the popup staying open until Escape', async () => {
    const onChange = vi.fn()
    const { user } = setup(<Field start={{ text: 'c (M)' }} onChange={onChange} />)
    select(3)
    await user.click(screen.getByRole('button', { name: /symbols for y axis title/ }))
    await user.click(await screen.findByRole('button', { name: 'micro' }))
    await user.click(screen.getByRole('button', { name: 'micro' }))
    expect(onChange).toHaveBeenLastCalledWith({ text: 'c (µµM)' })
    expect(screen.getByText('Format and symbols')).toBeVisible()
    await user.keyboard('{Escape}')
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)))
    expect(screen.queryByText('Format and symbols')).toBeNull()
    expect(box()).toHaveFocus()
  })

  it('puts a symbol in after subscript letters just typed, keeping them, in their look', async () => {
    const onChange = vi.fn()
    const { user } = setup(<Field start={{ text: '' }} onChange={onChange} />)
    select(0)
    type('CO')
    fireEvent.keyDown(box(), { key: '=', ctrlKey: true })
    type('2')
    await user.click(screen.getByRole('button', { name: /symbols for y axis title/ }))
    await user.click(await screen.findByRole('button', { name: 'micro' }))
    expect(onChange).toHaveBeenLastCalledWith({ text: 'CO2µ', runs: [{ start: 2, end: 4, style: { script: 'sub' } }] })
  })

  it('after the popup was closed by a click elsewhere, coming back to the field does not pick the old letters again, so a symbol replaces nothing', async () => {
    const onChange = vi.fn()
    const { user } = setup(<Field start={{ text: 'CO2', runs: [{ start: 2, end: 3, style: { script: 'sub' } }] }} onChange={onChange} />)
    select(2, 3)
    await user.click(screen.getByRole('button', { name: /symbols for y axis title/ }))
    await screen.findByText('Format and symbols')
    await user.click(document.body)
    expect(screen.queryByText('Format and symbols')).toBeNull()
    act(() => box().focus())
    await act(() => new Promise((resolve) => requestAnimationFrame(resolve)))
    // The "2" picked before the popup opened is not picked again.
    expect(window.getSelection()!.toString()).toBe('')
    await user.click(screen.getByRole('button', { name: /symbols for y axis title/ }))
    await user.click(await screen.findByRole('button', { name: 'micro' }))
    const saved = onChange.mock.lastCall![0] as ScriptText
    expect(saved.text).toHaveLength(4)
    expect(saved.text.replace('µ', '')).toBe('CO2')
    expect(saved.runs).toContainEqual(expect.objectContaining({ start: saved.text.indexOf('2'), style: { script: 'sub' } }))
  })

  it('switches to subscript from the popup with nothing selected: the popup closes and the next letters typed are subscript', async () => {
    const onChange = vi.fn()
    const { user } = setup(<Field start={{ text: 'CO' }} onChange={onChange} />)
    select(2)
    await user.click(screen.getByRole('button', { name: /symbols for y axis title/ }))
    await user.click(await screen.findByRole('button', { name: 'Subscript' }))
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)))
    expect(screen.queryByText('Format and symbols')).toBeNull()
    expect(box()).toHaveFocus()
    // The cursor shows the mode: small and lowered.
    expect(document.querySelector('[data-mode-caret="sub"]')).not.toBeNull()
    type('2')
    expect(onChange).toHaveBeenLastCalledWith({ text: 'CO2', runs: [{ start: 2, end: 3, style: { script: 'sub' } }] })
    // The same tile again switches back to normal letters.
    await user.click(screen.getByRole('button', { name: /symbols for y axis title/ }))
    await user.click(await screen.findByRole('button', { name: 'Subscript' }))
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)))
    expect(document.querySelector('[data-mode-caret]')).toBeNull()
    type('x')
    expect(onChange).toHaveBeenLastCalledWith({ text: 'CO2x', runs: [{ start: 2, end: 3, style: { script: 'sub' } }] })
  })

  it('takes new lines in the caption with Enter; a one-line field finishes on Enter instead', () => {
    const onChange = vi.fn()
    const onDone = vi.fn()
    const { unmount } = setup(<Field start={{ text: 'Primers' }} multiline onChange={onChange} />)
    select(7)
    fireEvent(box(), new InputEvent('beforeinput', { inputType: 'insertParagraph', bubbles: true, cancelable: true }))
    type('n')
    expect(onChange).toHaveBeenLastCalledWith({ text: 'Primers\nn' })
    unmount()

    setup(<Field start={{ text: 'Name' }} onChange={onChange} onDone={onDone} />)
    select(4)
    onChange.mockClear()
    fireEvent.keyDown(box(), { key: 'Enter' })
    fireEvent(box(), new InputEvent('beforeinput', { inputType: 'insertParagraph', bubbles: true, cancelable: true }))
    expect(onChange).not.toHaveBeenCalled()
    expect(onDone).toHaveBeenCalled()
  })

  it('reaches the Ω button and every tile by keyboard, and has nothing axe objects to', async () => {
    const { user } = setup(<Field start={{ text: '−log10(p)', runs: [{ start: 4, end: 6, style: { script: 'sub' } }] }} />)
    expect(await violations()).toEqual([])
    select(9)
    await user.tab()
    expect(screen.getByRole('button', { name: /symbols for y axis title/ })).toHaveFocus()
    await user.keyboard('{Enter}')
    await screen.findByText('Format and symbols')
    const reached: string[] = []
    for (let i = 0; i < 5; i++) {
      await user.tab()
      reached.push(document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.textContent?.replace('x2', '') ?? '')
    }
    expect(reached).toEqual(['Subscript', 'Superscript', 'alpha', 'beta', 'gamma'])
    const symbol = document.activeElement?.textContent ?? ''
    await user.keyboard('{Enter}')
    expect(box().textContent).toBe(`−log10(p)${symbol}`)
    expect(await violations()).toEqual([])
    // Two axe runs: well over the 5 s default when the whole check runs in parallel.
  }, 20_000)
})
