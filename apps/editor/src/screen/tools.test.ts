import { describe, expect, it } from 'vitest'

import { toolForPanel } from './tools'

describe('tool kept when a panel opens', () => {
  it('turns off the arrow tool in the Icons panel, so clicking an icon grabs it instead of drawing an arrow', () => {
    expect(toolForPanel('arrow', 'icons')).toBe('select')
    expect(toolForPanel('text', 'shapes')).toBe('select')
    expect(toolForPanel('chart', 'table')).toBe('select')
  })

  it('keeps a tool while its own panel is open, and Select everywhere', () => {
    expect(toolForPanel('arrow', 'arrows')).toBe('arrow')
    expect(toolForPanel('line', 'arrows')).toBe('line')
    expect(toolForPanel('rectangle', 'shapes')).toBe('rectangle')
    expect(toolForPanel('chart', 'graph')).toBe('chart')
    expect(toolForPanel('select', 'icons')).toBe('select')
  })
})
