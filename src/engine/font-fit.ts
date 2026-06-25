import { measureWidth } from './text-render'

export interface LineSize {
  text: string
  fontPx: number
}

interface Opts {
  lines: string[]
  fontFamily: string
  // Per-line font families (mix-fonts). When set, line i is measured with
  // perLineFonts[i % length]; otherwise every line uses fontFamily. Measuring
  // with the real per-line font keeps mixed wide fonts inside availW.
  perLineFonts?: string[]
  baseFontPx: number
  availW: number
  availH: number
  lineSpacingPct: number
  blockText: boolean
  canvasH: number
  // Tracking applied at render (px = letterSpacingPct * fontPx). Measured into
  // every width here so the fitted size accounts for the extra inter-glyph
  // space; otherwise tracked text overflows availW. Optional, default 0.
  letterSpacingPct?: number
}

export function fitText(
  ctx: CanvasRenderingContext2D,
  o: Opts,
): { lines: LineSize[]; maxFontPx: number } {
  const familyFor = (i: number): string =>
    o.perLineFonts && o.perLineFonts.length > 0
      ? o.perLineFonts[i % o.perLineFonts.length]
      : o.fontFamily

  const lsPct = o.letterSpacingPct ?? 0
  const widthAt = (t: string, px: number, family: string): number => {
    ctx.font = `${px}px ${family}`
    return measureWidth(ctx, t, Math.round(lsPct * px))
  }

  // Measure each line at baseFontPx in its own font; find widest
  const baseWidths = o.lines.map((l, i) => widthAt(l, o.baseFontPx, familyFor(i)))
  const widestIdx = baseWidths.indexOf(Math.max(...baseWidths))
  const widestW = baseWidths[widestIdx] || 1
  const widestFamily = familyFor(widestIdx)

  // Scale maxFontPx so widest line fits availW
  let maxFontPx = Math.max(1, Math.floor(o.baseFontPx * (o.availW / widestW)))

  // Shrink while total height exceeds availH
  while (maxFontPx > 1 && maxFontPx * (1 + o.lineSpacingPct) * o.lines.length > o.availH) {
    maxFontPx--
  }

  // Defensive width clamp: the proportional estimate above assumes text width
  // scales linearly with font px, which breaks when the canvas backend caps
  // measureText at very large font sizes. Re-measure at the chosen size and
  // correct so the widest line never exceeds availW. Bounded iteration.
  for (let i = 0; i < 4; i++) {
    const w = widthAt(o.lines[widestIdx], maxFontPx, widestFamily) || 1
    if (w <= o.availW) break
    maxFontPx = Math.max(1, Math.floor(maxFontPx * (o.availW / w)))
  }

  // Measure the widest line at final maxFontPx for block_text scaling
  const widestAtMax = widthAt(o.lines[widestIdx], maxFontPx, widestFamily) || 1

  // Assign per-line font sizes
  const lines: LineSize[] = o.lines.map((t, i) => {
    if (!o.blockText) return { text: t, fontPx: maxFontPx }
    const w = widthAt(t, maxFontPx, familyFor(i)) || 1
    return { text: t, fontPx: Math.max(1, Math.round(maxFontPx * (widestAtMax / w))) }
  })

  return { lines, maxFontPx }
}
