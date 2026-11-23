import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Two groups of tests: plain logic and token checks run in Node; component
// tests (*.test.tsx) run in jsdom, a simulated browser.
export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      {
        extends: true,
        test: { name: 'logic', include: ['src/**/*.test.ts'], environment: 'node' },
      },
      {
        extends: true,
        test: {
          name: 'components',
          include: ['src/**/*.test.tsx'],
          environment: 'jsdom',
          setupFiles: ['./src/test/setup.ts'],
        },
      },
    ],
  },
})
