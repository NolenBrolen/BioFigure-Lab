// Runs before every component test file.
import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// jsdom has no pointer capture, which sliders use while dragging. Real browsers do.
if (!('setPointerCapture' in Element.prototype)) {
  Object.assign(Element.prototype, { setPointerCapture() {}, releasePointerCapture() {}, hasPointerCapture: () => false })
}

// Remove what each test rendered, so tests don't see each other's output.
afterEach(() => {
  cleanup()
})
