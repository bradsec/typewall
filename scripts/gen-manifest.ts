/**
 * scripts/gen-manifest.ts
 *
 * Scans the asset directories at repo root (fonts/, backgrounds/, overlays/,
 * watermarks/, textmasks/) and emits src/assets/manifest.generated.ts, a plain
 * TypeScript module with no Vite-specific APIs so it works under Vitest/Node.
 *
 * URL strategy: assets are served from the repo root directories via symlinks
 * in public/ (created by this script if absent). Vite serves public/ at '/'.
 * URLs are base-relative (no leading slash): fonts/predatorslabbold.ttf, overlays/001.png, etc.
 * For background sub-directories (female/, male/, test/) the URL includes the
 * subdir: backgrounds/female/0001_1024x1024_4color_grayscale.png.
 *
 * public/ is git-ignored; the symlinks are created at gen:manifest time and do
 * not require committing large binary assets.
 */

import { readdirSync, existsSync, lstatSync, symlinkSync, mkdirSync, copyFileSync } from 'fs'
import { join, extname, basename } from 'path'
import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')

// ---------------------------------------------------------------------------
// Symlink setup: public/<dir> -> ../../<dir>  (relative from public/)
// Vite serves the public/ directory at '/', so /fonts/* resolves to public/fonts/*.
// ---------------------------------------------------------------------------
const PUBLIC = join(ROOT, 'public')
if (!existsSync(PUBLIC)) mkdirSync(PUBLIC, { recursive: true })

const ASSET_DIRS = ['fonts', 'backgrounds', 'overlays', 'watermarks', 'textmasks'] as const
type AssetDirName = typeof ASSET_DIRS[number]

for (const dir of ASSET_DIRS) {
  const linkPath = join(PUBLIC, dir)
  const target = join('..', dir)         // relative: public/fonts -> ../fonts
  if (!existsSync(linkPath)) {
    symlinkSync(target, linkPath, 'dir')
  }
}

// Copy the tracked favicon / app-icon set into public/ so Vite serves and emits
// them at the site root. index.html references these by relative path.
const ICON_FILES = [
  'favicon.ico',
  'favicon-16x16.png',
  'favicon-32x32.png',
  'apple-touch-icon.png',
  'android-chrome-192x192.png',
  'android-chrome-512x512.png',
  'site.webmanifest',
]
for (const file of ICON_FILES) {
  copyFileSync(join(ROOT, 'src', 'assets', file), join(PUBLIC, file))
}

// ---------------------------------------------------------------------------
// Asset scanning helpers
// ---------------------------------------------------------------------------

const FONT_EXTS = new Set(['.ttf', '.otf'])
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp'])

interface AssetEntryRaw {
  id: string
  name: string
  url: string
  kind: 'bundled'
}

function nameFromPath(filePath: string): string {
  return basename(filePath).replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9_-]/g, '-')
}

/** Scan a flat directory, return entries for files matching the given extensions. */
function scanFlat(dir: string, exts: Set<string>): AssetEntryRaw[] {
  const fullDir = join(ROOT, dir)
  if (!existsSync(fullDir)) return []
  return readdirSync(fullDir)
    .filter(f => !f.startsWith('.') && exts.has(extname(f).toLowerCase()))
    .sort()
    .map(f => ({
      id: `${dir}/${f}`,
      name: nameFromPath(f),
      url: `${dir}/${f}`,
      kind: 'bundled' as const,
    }))
}

/** Scan a directory that may contain immediate files AND one level of subdirs. */
function scanNested(dir: string, exts: Set<string>): AssetEntryRaw[] {
  const fullDir = join(ROOT, dir)
  if (!existsSync(fullDir)) return []
  const entries: AssetEntryRaw[] = []
  for (const entry of readdirSync(fullDir).sort()) {
    if (entry.startsWith('.')) continue
    const entryPath = join(fullDir, entry)
    const stat = lstatSync(entryPath)
    if (stat.isDirectory()) {
      const sub = entry
      for (const f of readdirSync(entryPath).sort()) {
        if (f.startsWith('.') || !exts.has(extname(f).toLowerCase())) continue
        entries.push({
          id: `${dir}/${sub}/${f}`,
          name: nameFromPath(f),
          url: `${dir}/${sub}/${f}`,
          kind: 'bundled',
        })
      }
    } else if (stat.isFile() && exts.has(extname(entry).toLowerCase())) {
      entries.push({
        id: `${dir}/${entry}`,
        name: nameFromPath(entry),
        url: `${dir}/${entry}`,
        kind: 'bundled',
      })
    }
  }
  return entries
}

const fonts = scanFlat('fonts', FONT_EXTS)
const backgrounds = scanNested('backgrounds', IMAGE_EXTS)
const overlays = scanFlat('overlays', IMAGE_EXTS)
const watermarks = scanFlat('watermarks', IMAGE_EXTS)
const textmasks = scanFlat('textmasks', IMAGE_EXTS)

// ---------------------------------------------------------------------------
// Emit manifest.generated.ts
// ---------------------------------------------------------------------------

function renderArray(name: string, items: AssetEntryRaw[]): string {
  const lines = items.map(e =>
    `  { id: ${JSON.stringify(e.id)}, name: ${JSON.stringify(e.name)}, url: ${JSON.stringify(e.url)}, kind: 'bundled' },`
  )
  return `export const ${name}: AssetEntry[] = [\n${lines.join('\n')}\n]`
}

const OUT = join(ROOT, 'src', 'assets', 'manifest.generated.ts')

const content = `// AUTO-GENERATED by scripts/gen-manifest.ts — do not edit by hand.
// Re-run: npm run gen:manifest

import type { AssetEntry } from './manifest'

${renderArray('fonts', fonts)}

${renderArray('backgrounds', backgrounds)}

${renderArray('overlays', overlays)}

${renderArray('watermarks', watermarks)}

${renderArray('textmasks', textmasks)}
`

writeFileSync(OUT, content, 'utf8')
console.log(`[gen-manifest] wrote ${OUT}`)
console.log(`  fonts: ${fonts.length}, backgrounds: ${backgrounds.length}, overlays: ${overlays.length}, watermarks: ${watermarks.length}, textmasks: ${textmasks.length}`)
