import { describe, expect, it } from 'vitest'

import { addLines, changeLineCount, lineCount, newLineMemory, wordCount, wrapIntoLines } from './label-lines'

describe('label lines', () => {
  it('counts typed lines and words', () => {
    expect(lineCount('')).toBe(1)
    expect(lineCount('a\nb\nc')).toBe(3)
    expect(wordCount('  DMEM  10% FBS\n100 mL ')).toBe(5)
  })

  it('puts everything on one line when asked for one', () => {
    expect(wrapIntoLines('DMEM\n10% FBS', 1)).toBe('DMEM 10% FBS')
  })

  it('spreads words as evenly as it can', () => {
    expect(wrapIntoLines('DMEM 10% FBS 100 mL', 2)).toBe('DMEM 10%\nFBS 100 mL')
    expect(wrapIntoLines('DMEM 10% FBS', 3)).toBe('DMEM\n10%\nFBS')
  })

  it('never splits a word; spare lines are empty, above and below', () => {
    expect(wrapIntoLines('Ethanol', 3)).toBe('\nEthanol\n')
    expect(wrapIntoLines('', 2)).toBe('')
    expect(wrapIntoLines('one two', 4)).toBe('\none\ntwo\n')
  })
})

describe('adding lines', () => {
  it('keeps the written text and fills new lines with placeholders', () => {
    expect(addLines('DMEM 10% FBS', 3)).toBe('DMEM 10% FBS\nLine 2\nLine 3')
    expect(addLines('A\nB', 3)).toBe('A\nB\nLine 3')
  })

  it('gives an empty text placeholders on every line', () => {
    expect(addLines('', 2)).toBe('Line 1\nLine 2')
  })
})

describe('clicking through line counts', () => {
  it('unwraps text when you go back up, as long as you only click the tiles', () => {
    const memory = newLineMemory()
    const written = 'Hello\nThis\nis\ncool'
    const two = changeLineCount(written, 2, memory)
    expect(two).toBe('Hello This\nis cool')
    expect(changeLineCount(two, 4, memory)).toBe(written)
  })

  it('keeps the placeholders you saw when going back up', () => {
    const memory = newLineMemory()
    let text = changeLineCount('Hello', 4, memory)
    expect(text).toBe('Hello\nLine 2\nLine 3\nLine 4')
    text = changeLineCount(text, 2, memory)
    expect(text).toBe('Hello\nLine 2')
    text = changeLineCount(text, 4, memory)
    expect(text).toBe('Hello\nLine 2\nLine 3\nLine 4')
  })

  it('starts over after the text is edited', () => {
    const memory = newLineMemory()
    const two = changeLineCount('A\nB\nC\nD', 2, memory)
    expect(changeLineCount(`${two} edited`, 4, memory)).toBe('A B\nC D edited\nLine 3\nLine 4')
  })
})
