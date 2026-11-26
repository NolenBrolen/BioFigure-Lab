/*
 * jsdom has no canvas drawing, which Fabric's text needs to measure itself.
 * This stand-in measures every character as 10 px wide and ignores drawing,
 * enough for tests of what text holds (characters, styles, saving), not of
 * how it looks.
 */
const context = new Proxy<Record<string | symbol, unknown>>({}, {
  get(target, key) {
    if (key in target) return target[key]
    if (key === 'measureText') return (text: string) => ({ width: [...text].length * 10 })
    // Fabric sets the text direction on the context's canvas.
    if (key === 'canvas') return { setAttribute: () => undefined }
    if (key === 'getImageData' || key === 'createImageData') return () => ({ data: new Uint8ClampedArray(4) })
    return () => undefined
  },
  set(target, key, value) {
    target[key] = value
    return true
  },
})

HTMLCanvasElement.prototype.getContext = (() => context) as unknown as HTMLCanvasElement['getContext']

// Arrows draw their paths with Path2D, which jsdom lacks; drawing is ignored anyway.
globalThis.Path2D ??= class {} as unknown as typeof Path2D
