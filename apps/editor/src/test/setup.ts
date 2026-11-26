// Runs before every screen test file.
import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// jsdom has no matchMedia (the theme hook asks it for the system colour scheme).
if (typeof window.matchMedia !== 'function') {
  Object.assign(window, {
    matchMedia: (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }),
  })
}

afterEach(() => {
  cleanup()
})
