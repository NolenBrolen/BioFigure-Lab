import { defineConfig } from 'vitest/config'

// The editor's logic (undo history, shortcuts, units, new shapes) runs in Node.
// Fabric.js itself needs a real browser canvas, so that part is tried in the app.
export default defineConfig({
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
})
