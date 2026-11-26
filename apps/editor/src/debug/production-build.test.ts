/*
 * The debug panel is for development only. This builds the app the way it
 * ships and checks that neither the panel nor Leva ended up in it.
 */
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { build } from 'vite'
import { expect, it } from 'vitest'

const root = fileURLToPath(new URL('../..', import.meta.url))

it('leaves the debug panel out of the production build', { timeout: 120_000 }, async () => {
  const outDir = await mkdtemp(join(tmpdir(), 'biofigure-build-'))
  // Vitest sets NODE_ENV to "test", which would make the build a development one.
  const nodeEnv = process.env.NODE_ENV
  process.env.NODE_ENV = 'production'
  try {
    await build({ root, mode: 'production', logLevel: 'silent', build: { outDir, emptyOutDir: true } })
    const files = (await readdir(outDir, { recursive: true })).filter((file) => file.endsWith('.js'))
    expect(files.length).toBeGreaterThan(0)
    for (const file of files) {
      const code = await readFile(join(outDir, file), 'utf8')
      expect(code, file).not.toContain('Open debug panel')
      expect(code, file).not.toContain('biofigure-lab:debug-cleared')
      expect(code, file).not.toContain('__figureBuilder')
    }
  } finally {
    process.env.NODE_ENV = nodeEnv
    await rm(outDir, { recursive: true, force: true })
  }
})
