// Font registration and family resolution.
//
// Browser/worker path uses the FontFace API. The Node test environment registers
// fonts out-of-band via the napi GlobalFonts API (see vitest.setup.ts), so the
// browser path is guarded behind a DOM/FontFace feature check and becomes a no-op
// when those globals are absent.

import type { AssetRef } from './types'

/**
 * Registers a font family from raw font data so subsequent canvas text rendering
 * can reference it by `family`. Uses the FontFace API where available; resolves
 * without effect in non-DOM environments (tests register fonts separately).
 */
export async function registerFont(family: string, data: ArrayBuffer): Promise<void> {
  const FontFaceCtor = (globalThis as { FontFace?: typeof FontFace }).FontFace
  const fontSet = (globalThis as unknown as { fonts?: FontFaceSet }).fonts

  if (typeof FontFaceCtor === 'undefined' || fontSet == null) return

  const face = new FontFaceCtor(family, data)
  await face.load()
  fontSet.add(face)
}

/**
 * Resolves an AssetRef to the canvas font family name used at render time.
 * Bundled and uploaded fonts are both keyed by their asset id.
 */
export function resolveFamily(ref: AssetRef): string {
  return ref.id
}
