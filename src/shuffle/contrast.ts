import type { BackgroundConfig } from '../engine/types'

// WCAG-style contrast helpers used by shuffle to avoid picking text colors that
// disappear against the background. Pure functions, no DOM.

export interface Rgb {
  r: number
  g: number
  b: number
}

// Parse #rgb or #rrggbb (with or without leading #). Unknown formats fall back
// to mid-grey so a malformed color never throws inside the shuffle hot path.
export function hexToRgb(hex: string): Rgb {
  let h = hex.trim().replace(/^#/, '')
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) return { r: 128, g: 128, b: 128 }
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

function linearize(channel: number): number {
  const s = channel / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

// WCAG 2.x relative luminance in [0, 1].
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex)
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)
}

// WCAG contrast ratio in [1, 21].
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const hi = Math.max(la, lb)
  const lo = Math.min(la, lb)
  return (hi + 0.05) / (lo + 0.05)
}

// Moderate threshold: roughly WCAG large-text level. Blocks clearly unreadable
// pairs while preserving most of the palette's variety.
export const MIN_CONTRAST_RATIO = 3

export function readablePalette(
  palette: string[],
  bg: string,
  min = MIN_CONTRAST_RATIO,
): string[] {
  return palette.filter((c) => contrastRatio(c, bg) >= min)
}

// Palette color with the highest contrast against bg. Fallback when no color
// clears the threshold. Assumes a non-empty palette.
export function bestContrast(palette: string[], bg: string): string {
  return palette.reduce((best, c) =>
    contrastRatio(c, bg) > contrastRatio(best, bg) ? c : best,
  )
}

/**
 * The single color shuffle should contrast text against, or undefined when no
 * meaningful background color exists (transparent, or an image whose average
 * color has not been computed yet). undefined disables contrast filtering.
 */
export function effectiveBackgroundColor(
  bg: BackgroundConfig,
  imageAvgColor?: string,
): string | undefined {
  if (bg.transparent) return undefined
  if (bg.image.enabled && bg.image.assetRef) return imageAvgColor
  return bg.color
}
