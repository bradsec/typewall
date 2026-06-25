// src/assets/manifest.ts
//
// Defines the AssetEntry type and re-exports the generated manifest.
// The generated file (manifest.generated.ts) is produced by:
//   npm run gen:manifest
// It contains no Vite-specific APIs, so it works under Vitest/Node.

export interface AssetEntry {
  id: string
  name: string
  url: string
  kind: 'bundled'
}

export interface Manifest {
  fonts: AssetEntry[]
  backgrounds: AssetEntry[]
  overlays: AssetEntry[]
  watermarks: AssetEntry[]
  textmasks: AssetEntry[]
}

import { fonts, backgrounds, overlays, watermarks, textmasks } from './manifest.generated'

export const manifest: Manifest = { fonts, backgrounds, overlays, watermarks, textmasks }
