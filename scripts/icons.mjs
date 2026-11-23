#!/usr/bin/env node
/*
 * `npm run icons`: downloads the BioFigure Lab icon library into icons/.
 *
 * The icon library is not part of the source code. It is a separate zip file
 * attached to each GitHub release, under its own licence (ICON-LICENSE.md).
 * Running this again replaces icons/ with the newest library.
 *
 * BIOFIGURE_ICONS_URL can point at another copy of the zip (a mirror you are
 * allowed to use, or a local file:// path for testing).
 */
/* global process, console, fetch, URL */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { unzipSync } from 'fflate'

const PACK_URL = process.env.BIOFIGURE_ICONS_URL ?? 'https://github.com/NolenBrolen/BioFigure-Lab/releases/latest/download/biofigure-lab-icons.zip'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const target = join(root, 'icons')
const staging = join(root, 'icons.download')

function fail(message) {
  console.error(`\n${message}`)
  process.exit(1)
}

// In the project's own working copy the library is part of the repository: never overwrite it.
try {
  const tracked = execFileSync('git', ['ls-files', '--', 'icons'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  if (tracked.trim()) fail('icons/ is part of this repository, so it is not replaced. Nothing was downloaded.')
} catch {
  // Not a git checkout (e.g. a downloaded source zip): carry on.
}

async function download(url) {
  if (url.startsWith('file:')) return new Uint8Array(readFileSync(fileURLToPath(url)))
  const response = await fetch(url)
  if (!response.ok) fail(`Download failed (${response.status} ${response.statusText}) from ${url}`)
  return new Uint8Array(await response.arrayBuffer())
}

console.log(`Downloading the icon library from ${new URL(PACK_URL).host || 'a local file'} ...`)
let zip
try {
  zip = await download(PACK_URL)
} catch (error) {
  fail(`Download failed: ${error instanceof Error ? error.message : String(error)}\nCheck your internet connection and try again.`)
}
console.log(`Downloaded ${(zip.length / 1024 / 1024).toFixed(1)} MB. Unpacking ...`)

let entries
try {
  entries = unzipSync(zip)
} catch {
  fail('The download is not a valid zip file. Try again later.')
}

// Only plain icon files inside icons/: no other folders, no paths that climb out.
const ALLOWED = /\.(svg|json|md)$/i
const files = Object.entries(entries).filter(([path]) => !path.endsWith('/'))
for (const [path] of files) {
  const clean = normalize(path)
  if (!path.startsWith('icons/') || clean.split(sep).includes('..') || !ALLOWED.test(path)) {
    fail(`The download contains an unexpected file (${path}). Nothing was changed.`)
  }
}
const svgCount = files.filter(([path]) => path.toLowerCase().endsWith('.svg')).length
if (svgCount === 0) fail('The download contains no icons. Nothing was changed.')

// Unpack next to the old library first, then swap, so a failed unpack leaves icons/ as it was.
rmSync(staging, { recursive: true, force: true })
for (const [path, data] of files) {
  const out = join(staging, path.slice('icons/'.length))
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, data)
}
if (existsSync(target)) rmSync(target, { recursive: true, force: true })
renameSync(staging, target)

console.log(`Done: ${svgCount} icon files in icons/. Restart the editor (npm run dev -w apps/editor) to see them.`)
console.log('The icons are under the BioFigure Lab Icon Library Licence: see ICON-LICENSE.md.')
