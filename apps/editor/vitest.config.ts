import { defineConfig } from 'vitest/config'

// The editor's logic (undo history, shortcuts, units, new shapes) runs in Node.
// Fabric.js itself needs a real browser canvas, so that part is tried in the app.
// Screen tests (*.test.tsx) of plain buttons and dialogs run in jsdom, a simulated browser.
export default defineConfig({
  test: {
    projects: [
      { extends: true, test: { name: 'logic', include: ['src/**/*.test.ts'], environment: 'node' } },
      {
        extends: true,
        test: { name: 'screens', include: ['src/**/*.test.tsx'], environment: 'jsdom', setupFiles: ['./src/test/setup.ts'] },
      },
    ],
  },
})
