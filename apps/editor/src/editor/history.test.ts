import { describe, expect, it } from 'vitest'

import { History, HistoryBudget } from './history'

describe('History', () => {
  it('undoes and redoes steps in order', () => {
    const history = new History('a')
    history.push('b', undefined, 0)
    history.push('c', undefined, 1000)
    expect(history.undo()).toBe('b')
    expect(history.undo()).toBe('a')
    expect(history.canUndo).toBe(false)
    expect(history.undo()).toBeUndefined()
    expect(history.redo()).toBe('b')
    expect(history.redo()).toBe('c')
    expect(history.canRedo).toBe(false)
  })

  it('drops the redo steps after a new change', () => {
    const history = new History('a')
    history.push('b')
    history.undo()
    history.push('c')
    expect(history.canRedo).toBe(false)
    expect(history.undo()).toBe('a')
  })

  it('skips a state that is the same as the current one', () => {
    const history = new History('a')
    history.push('a')
    expect(history.canUndo).toBe(false)
  })

  it('merges quick changes to the same property into one step', () => {
    const history = new History('a')
    history.push('opacity 90', 'opacity', 0)
    history.push('opacity 80', 'opacity', 100)
    history.push('opacity 70', 'opacity', 200)
    expect(history.undo()).toBe('a')
  })

  it('keeps changes apart when they are slow or to different properties', () => {
    const history = new History('a')
    history.push('b', 'opacity', 0)
    history.push('c', 'opacity', 5000)
    history.push('d', 'fill', 5100)
    expect(history.undo()).toBe('c')
    expect(history.undo()).toBe('b')
  })

  it('does not merge into a step that was undone and redone', () => {
    const history = new History('a')
    history.push('b', 'opacity', 0)
    history.undo()
    history.redo()
    history.push('c', 'opacity', 100)
    expect(history.undo()).toBe('b')
  })

  it('forgets the oldest steps past the limit', () => {
    const history = new History('0', 3)
    for (const state of ['1', '2', '3', '4']) history.push(state)
    expect(history.undo()).toBe('3')
    expect(history.undo()).toBe('2')
    expect(history.canUndo).toBe(false)
  })

  it('keeps all histories within a shared memory budget, dropping from the biggest first', () => {
    // Steps of 10 characters; room for 50 in all.
    const budget = new HistoryBudget(50)
    const big = new History('0'.repeat(10), 200, 800, budget)
    const small = new History('a'.repeat(10), 200, 800, budget)
    small.push('b'.repeat(10))
    for (const n of [1, 2, 3, 4]) big.push(String(n).repeat(10))
    expect(big.size + small.size).toBeLessThanOrEqual(50)
    // The small history (another slide) keeps its step; the big one lost its oldest ones.
    expect(small.undo()).toBe('a'.repeat(10))
    expect(big.undo()).toBe('3'.repeat(10))
    expect(big.undo()).toBe('2'.repeat(10))
    expect(big.canUndo).toBe(false)
  })

  it('always keeps one step to undo, even when a single step is over the budget', () => {
    const history = new History('a'.repeat(100), 200, 800, new HistoryBudget(10))
    history.push('b'.repeat(100))
    history.push('c'.repeat(100))
    expect(history.undo()).toBe('b'.repeat(100))
    expect(history.canUndo).toBe(false)
  })
})
