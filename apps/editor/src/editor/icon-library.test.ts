import { describe, expect, it } from 'vitest'

import { allLibraryIcons, browseIcons, inStyle, isDarkLineArt, keepsColour, letterVersions, libraryIcons, loadIconSvg, signVersions, styleVersion, mainColour, needsLightBacking, modeColour, placementSize, recolourPart, tintColour, type LibraryIcon } from './icon-library'

const icon = (name: string, category: string, keywords: string[] = []): LibraryIcon => ({
  id: name,
  name,
  category,
  keywords,
})

// The icon library is a separate download (`npm run icons`). Tests that check the
// installed library's own files run only when it is there.
const installed = libraryIcons.length > 0

const icons = [
  icon('Macrophage', 'cells', ['immune cell', 'phagocyte']),
  icon('Red blood cell', 'cells', ['erythrocyte']),
  icon('Virus', 'microbes', ['pathogen']),
]

describe('icon library', () => {
  // Reads every SVG file (about a thousand), so it gets more time than usual.
  it.runIf(installed)('loads each icon once with its metadata', { timeout: 30_000 }, async () => {
    expect(libraryIcons.length).toBeGreaterThan(0)
    expect(new Set(allLibraryIcons.map(({ id }) => id)).size).toBe(allLibraryIcons.length)
    const svgs = await Promise.all(allLibraryIcons.map(({ id }) => loadIconSvg(id)))
    allLibraryIcons.forEach(({ id, name }, i) => {
      expect(name, id).not.toBe('')
      expect(svgs[i], id).toContain('viewBox="0 0 128 128"')
    })
  })

  it('finds icons by name, keyword or category, grouped by category', () => {
    expect(browseIcons(icons, '').map((group) => group.category)).toEqual(['cells', 'microbes'])
    expect(browseIcons(icons, 'phago')[0]?.icons.map((i) => i.name)).toEqual(['Macrophage'])
    expect(browseIcons(icons, 'microbes')[0]?.icons.map((i) => i.name)).toEqual(['Virus'])
    expect(browseIcons(icons, 'nothing like this')).toEqual([])
  })

  it('recolours filled and outlined parts but leaves empty fills empty', () => {
    expect(recolourPart({ fill: '#334155' }, '#ff0000')).toEqual({ fill: '#ff0000' })
    expect(recolourPart({ fill: 'none', stroke: '#334155' }, '#ff0000')).toEqual({ stroke: '#ff0000' })
    expect(recolourPart({ fill: '', stroke: null }, '#ff0000')).toEqual({})
  })
})

describe('icon colour', () => {
  it('is the middle shade, so a few light details do not decide it', () => {
    expect(mainColour(['#111111', '#222222', '#333333', '#ffc0cb'])).toBe('#222222')
    expect(mainColour(['#334155'])).toBe('#334155')
    expect(mainColour(['url(#g)'])).toBeUndefined()
  })

  it('tints every shade of a multi-tone icon, keeping it lighter or darker than the main colour', () => {
    const from = '#222222'
    // The main colour becomes exactly the new colour.
    expect(tintColour(from, from, '#ff0000')).toBe('#ff0000')
    // Darker and lighter shades stay darker and lighter, in the new hue, and in range.
    const lightness = (hex: string) => parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16) + parseInt(hex.slice(5, 7), 16)
    const darker = tintColour('#111111', from, '#ff0000')
    const lighter = tintColour('#ffc0cb', from, '#ff0000')
    expect(lightness(darker)).toBeLessThan(lightness('#ff0000'))
    expect(lightness(lighter)).toBeGreaterThan(lightness('#ff0000'))
    expect(lighter.slice(1, 3)).toBe('ff')
    // See-through colours stay see-through; colours it can't read are kept.
    expect(tintColour('rgba(34, 34, 34, 0.5)', from, '#ff0000')).toBe('rgba(255, 0, 0, 0.5)')
    expect(tintColour('url(#g)', from, '#ff0000')).toBe('url(#g)')
  })

  it('recolours a part by tinting when the main colour is known', () => {
    expect(recolourPart({ fill: '#222222', stroke: 'none' }, '#0000ff', '#222222')).toEqual({ fill: '#0000ff' })
  })
})

describe('colour modes', () => {
  it('greyscale keeps how bright each colour is', () => {
    expect(modeColour('#ff0000', 'rgb')).toBe('#ff0000')
    expect(modeColour('#ffffff', 'grey')).toBe('#ffffff')
    // Green looks brighter than blue, so it turns a lighter grey.
    expect(modeColour('#00ff00', 'grey') > modeColour('#0000ff', 'grey')).toBe(true)
    expect(modeColour('rgba(255, 0, 0, 0.5)', 'grey')).toMatch(/^rgba\(\d+, \d+, \d+, 0\.5\)$/)
    expect(modeColour('url(#g)', 'grey')).toBe('url(#g)')
  })
})

describe('dark mode previews', () => {
  it('flips dark one-colour line icons but leaves light and multi-tone icons alone', () => {
    expect(isDarkLineArt('<svg><circle fill="none" stroke="#334155"/><circle fill="#334155"/></svg>')).toBe(true)
    expect(isDarkLineArt('<svg><path fill="none" stroke="#8fc6cc"/></svg>')).toBe(false)
    expect(isDarkLineArt('<svg><circle fill="#C9C3E6"/><circle fill="#6c528f"/></svg>')).toBe(false)
  })

  it.runIf(installed)('leaves every multi-level library icon in its own colours', async () => {
    const levelled = libraryIcons.filter((icon) => /-(glyph|simple|detailed|structural)-/.test(icon.id))
    expect(levelled.length).toBeGreaterThan(0)
    const svgs = await Promise.all(levelled.map((icon) => loadIconSvg(icon.id)))
    expect(levelled.filter((_, i) => isDarkLineArt(svgs[i] ?? '')).map((icon) => icon.id)).toEqual([])
  })

  it('pairs each molecule with its version with letters, and nothing else', () => {
    const ids = ['small-molecules/caffeine-skeletal', 'small-molecules/caffeine-skeletal-letters', 'cells/t-cell-glyph-flat']
    const pair = { without: 'small-molecules/caffeine-skeletal', with: 'small-molecules/caffeine-skeletal-letters' }
    expect(letterVersions('small-molecules/caffeine-skeletal', ids)).toEqual({ letters: false, ...pair })
    expect(letterVersions('small-molecules/caffeine-skeletal-letters', ids)).toEqual({ letters: true, ...pair })
    expect(letterVersions('cells/t-cell-glyph-flat', ids)).toBeUndefined()
  })

  it.runIf(installed)('gives every molecule in the installed library both versions', () => {
    const molecules = libraryIcons.filter((icon) => icon.category === 'small molecules')
    expect(molecules.every((icon) => letterVersions(icon.id) !== undefined)).toBe(true)
  })

  it('pairs each ion channel with its version without charge signs, and nothing else', () => {
    const ids = ['membranes/ion-channel-cation-textbook', 'membranes/ion-channel-cation-unsigned-textbook', 'cells/t-cell-glyph-flat']
    const pair = { with: 'membranes/ion-channel-cation-textbook', without: 'membranes/ion-channel-cation-unsigned-textbook' }
    expect(signVersions('membranes/ion-channel-cation-textbook', ids)).toEqual({ signs: true, ...pair })
    expect(signVersions('membranes/ion-channel-cation-unsigned-textbook', ids)).toEqual({ signs: false, ...pair })
    expect(signVersions('cells/t-cell-glyph-flat', ids)).toBeUndefined()
    // A pencil version keeps its style suffix last.
    const pencilIds = ['membranes/ion-channel-anion-tube-pencil-shaded', 'membranes/ion-channel-anion-unsigned-tube-pencil-shaded']
    const pencilPair = { with: pencilIds[0], without: pencilIds[1] }
    expect(signVersions(pencilIds[0] ?? '', pencilIds)).toEqual({ signs: true, ...pencilPair })
    expect(signVersions(pencilIds[1] ?? '', pencilIds)).toEqual({ signs: false, ...pencilPair })
  })

  it.runIf(installed)('gives every ion channel in the installed library both versions', () => {
    const channels = libraryIcons.filter((icon) => icon.id.startsWith('membranes/ion-channel-'))
    expect(channels.length).toBeGreaterThan(0)
    expect(channels.every((icon) => signVersions(icon.id) !== undefined)).toBe(true)
    expect(signVersions('membranes/ion-channel-cation-textbook')?.without).toBe('membranes/ion-channel-cation-unsigned-textbook')
    expect(signVersions('small-molecules/caffeine-skeletal')).toBeUndefined()
  })

  it.runIf(installed)('puts chemistry structures on a white backing instead of flipping them', async () => {
    const molecules = libraryIcons.filter((icon) => icon.category === 'small molecules')
    expect(molecules.length).toBeGreaterThan(0)
    expect(molecules.every(needsLightBacking)).toBe(true)
    const svgs = await Promise.all(molecules.map((icon) => loadIconSvg(icon.id)))
    expect(molecules.filter((_, i) => isDarkLineArt(svgs[i] ?? '')).map((icon) => icon.id)).toEqual([])
    expect(libraryIcons.filter((icon) => icon.category !== 'small molecules').some(needsLightBacking)).toBe(false)
  })
})

describe('pencil styles in the library', () => {
  const lib = (id: string): LibraryIcon => ({ id, name: id, category: 'cells', keywords: [] })
  const all = [
    lib('cells/t-cell-flat'),
    lib('cells/t-cell-outlined'),
    lib('cells/t-cell-shaded'),
    lib('cells/t-cell-flat-pencil-graphite'),
    lib('cells/another-cell'),
    lib('cells/another-cell-pencil-graphite'),
    lib('cells/virus'),
  ]
  const find = (id: string) => all.find((icon) => icon.id === id)
  const clean = all.filter((icon) => !icon.id.includes('-pencil-'))

  it('shows each icon in the picked style, once per pencil drawing, and keeps icons without one clean', () => {
    expect(inStyle(clean, 'clean', find).map((icon) => icon.id)).toEqual(clean.map((icon) => icon.id))
    // Flat, outlined and shaded share one pencil drawing; the virus has none.
    expect(inStyle(clean, 'graphite', find).map((icon) => icon.id)).toEqual(['cells/t-cell-flat-pencil-graphite', 'cells/another-cell-pencil-graphite', 'cells/virus'])
  })

  it.runIf(installed)('finds every version of a real library icon, and its letters twin in the same style', () => {
    expect(styleVersion('cells/t-cell-simple-outlined', 'shaded')).toBe('cells/t-cell-simple-flat-pencil-shaded')
    expect(styleVersion('cells/t-cell-simple-flat-pencil-shaded', 'clean')).toBe('cells/t-cell-simple-flat')
    expect(letterVersions('small-molecules/caffeine-skeletal-pencil-scribble')).toEqual({
      letters: false,
      without: 'small-molecules/caffeine-skeletal-pencil-scribble',
      with: 'small-molecules/caffeine-skeletal-letters-pencil-scribble',
    })
    // Every pencil icon belongs to a clean icon in the library.
    const ids = new Set(allLibraryIcons.map((icon) => icon.id))
    const orphans = allLibraryIcons.filter((icon) => icon.id.includes('-pencil-') && !ids.has(icon.id.replace(/-pencil-\w+$/, '')))
    expect(orphans.map((icon) => icon.id)).toEqual([])
  })

  it('keeps the paper of pencil drawings and the dark outline of Scribble when recolouring', () => {
    expect(keepsColour('#ffffff', 'cells/x-pencil-graphite')).toBe(true)
    expect(keepsColour('#262628', 'cells/x-pencil-scribble')).toBe(true)
    expect(keepsColour('rgb(38, 38, 40)', 'cells/x-pencil-scribble')).toBe(true)
    expect(keepsColour('#262628', 'cells/x-pencil-graphite')).toBe(false)
    expect(keepsColour('#ffffff', 'cells/x')).toBe(false)
  })
})

describe('placement size', () => {
  it('animals keep the reference size and other icons come in 20% smaller', () => {
    const animal = placementSize({ category: 'animals' })
    expect(placementSize({ category: 'cells' }) / animal).toBeCloseTo(0.8, 1)
    expect(placementSize({ category: 'lab-equipment' })).toBe(placementSize({ category: 'cells' }))
  })
})
