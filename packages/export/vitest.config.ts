import { defineConfig } from 'vitest/config'

// Logic runs in Node; the text-to-outlines tests need a DOM and say so with
// `@vitest-environment jsdom`. PNG drawing and PDF writing need a real browser,
// so those parts are tried in the app.
export default defineConfig({
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
})
