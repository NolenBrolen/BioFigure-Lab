import { describe, expect, it } from 'vitest'

import { settingGroups, shapeBarSets } from './mobile-props'

const SHAPE_ROWS = ['Shape', 'Corners', 'Preset', 'Fill', 'Outline', 'Opacity', 'Type text', 'Font', 'Weight', 'Style', 'Font size', 'Colour', 'Highlight', 'Align', 'Line spacing', 'Letter spacing', 'Symbols', 'Long text']

describe('settingGroups', () => {
  it("splits a shape's text into items like a text's, with how shape and text fit together under Layout", () => {
    const groups = settingGroups(SHAPE_ROWS)
    expect(groups.map((group) => group.label)).toEqual(['Shape', 'Layout', 'Preset', 'Fill', 'Outline', 'Add text', 'Font', 'Size', 'Text colour', 'Highlight', 'Spacing', 'Symbols'])
    expect(groups.find((group) => group.label === 'Size')?.rows).toEqual(['Weight', 'Style', 'Font size'])
    expect(groups.find((group) => group.label === 'Spacing')?.rows).toEqual(['Line spacing', 'Letter spacing'])
    expect(groups.find((group) => group.label === 'Layout')?.rows).toEqual(['Corners', 'Opacity', 'Align', 'Long text'])
  })

  it("puts a shape's own items and its text's in two sets with Layout beside them, and leaves other objects in one bar", () => {
    const sets = shapeBarSets(settingGroups(SHAPE_ROWS))
    expect(sets?.shape.map((group) => group.label)).toEqual(['Shape', 'Preset', 'Fill', 'Outline'])
    expect(sets?.text.map((group) => group.label)).toEqual(['Add text', 'Font', 'Size', 'Text colour', 'Highlight', 'Spacing', 'Symbols'])
    expect(sets?.direct.map((group) => group.label)).toEqual(['Layout'])
    expect(shapeBarSets(settingGroups(['Font', 'Font size', 'Colour', 'Align']))).toBeUndefined()
  })
})
