import { describe, expect, it } from 'vitest'

import { toolAfterSelectionEnds, toolForPanel } from './tools'

describe('tool when a selection ends', () => {
  it('turns the arrow tool back on when an arrow selected in the Arrows panel is let go, so its anchors show again', () => {
    expect(toolAfterSelectionEnds('select', 'arrows')).toBe('arrow')
  })

  it('leaves the tool alone in other panels, and a drawing tool that is already on', () => {
    expect(toolAfterSelectionEnds('select', 'icons')).toBe('select')
    expect(toolAfterSelectionEnds('select', 'shapes')).toBe('select')
    expect(toolAfterSelectionEnds('arrow', 'arrows')).toBe('arrow')
    expect(toolAfterSelectionEnds('line', 'arrows')).toBe('line')
  })
})

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
