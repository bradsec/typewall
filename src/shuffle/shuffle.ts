import type { RenderConfig, Alignment } from '../engine/types'
import { defaultConfig } from '../engine/types'
import { Rng } from '../engine/rng'
import type { VibeBias, Toggle } from './presets'
import { readablePalette, bestContrast } from './contrast'
import {
  ALIGNMENTS,
  LINE_SPACING_PCT_MIN,
  LINE_SPACING_PCT_MAX,
  OVERFLOW_MIN,
  OVERFLOW_MAX,
  SCALE_EMPHASIS_MIN,
  SCALE_EMPHASIS_MAX,
  SHADOW_OFFSET_MIN,
  SHADOW_OFFSET_MAX,
  OUTLINE_RATIO_MIN,
  OUTLINE_RATIO_MAX,
  LAYOUT_MAX_LINES,
  SHORT_TEXT_WORDS,
  MEME_CAPTION_SCALE_MIN,
  MEME_CAPTION_SCALE_MAX,
} from './constraints'

export type ShuffleDimension = 'layout' | 'fonts' | 'scale' | 'effects' | 'color'
export type Locks = Record<ShuffleDimension, boolean>

export interface ShuffleOpts {
  palette: string[]
  fontRefs: import('../engine/types').AssetRef[]
  fontMix: boolean
  bias?: VibeBias
  // Background color to keep the text color readable against. When set, the
  // color roll is biased toward palette entries that clear MIN_CONTRAST_RATIO.
  // Omit (or pass undefined) to disable contrast filtering, e.g. for a
  // transparent background or an image whose average color is unknown.
  backgroundColor?: string
}

// Reference base font size for scale emphasis (mirrors defaultConfig). Using a
// fixed reference keeps shuffle non-compounding and deterministic.
const BASE_FONT_SIZE_REFERENCE = defaultConfig().text.baseFontSize

// Resolve a toggle against the RNG: 'any' rolls a coin, else forced.
function rollToggle(t: Toggle | undefined, rng: Rng): boolean {
  if (t === 'on') return true
  if (t === 'off') return false
  return rng.bool()
}

// Pick a text color from the palette, biased toward readability when a
// background color is known. With no background, behaves as a plain uniform
// pick. When some palette entries clear the contrast threshold, roll among
// those; otherwise fall back to the single highest-contrast color so the text
// stays visible even on a hostile palette.
function pickReadableColor(rng: Rng, palette: string[], bg: string | undefined): string {
  if (!bg) return rng.pick(palette)
  const readable = readablePalette(palette, bg)
  if (readable.length > 0) return rng.pick(readable)
  return bestContrast(palette, bg)
}

// Deep-clone a RenderConfig without any DOM or canvas dependency.
function cloneConfig(cfg: RenderConfig): RenderConfig {
  return JSON.parse(JSON.stringify(cfg)) as RenderConfig
}

/**
 * Return a new RenderConfig with unlocked dimensions re-rolled from seed.
 * Locked dimensions are copied verbatim from config.
 * Deterministic: same (config, locks, seed, opts) always produces the same result.
 * All randomness flows through Rng — no Math.random usage.
 */
export function shuffle(
  config: RenderConfig,
  locks: Locks,
  seed: number,
  opts: ShuffleOpts,
): RenderConfig {
  const rng = new Rng(seed)
  const result = cloneConfig(config)
  const bias = opts.bias
  const palette = bias?.palette?.length ? bias.palette : opts.palette

  // Meme remix is intentionally narrow: it re-rolls word placement / line breaks
  // (layout) and the caption size (scale), preserving the traditional look
  // (white text, black outline, fixed font/style). It does not touch color,
  // effects, fonts, or the overlay/bars style. Captions honor
  // result.text.targetLines and meme.captionScale via the meme layout.
  if (config.text.meme?.enabled) {
    if (!locks.layout) {
      result.text.targetLines = rng.int(1, 3)
    }
    if (!locks.scale && result.text.meme) {
      // Resize captions so even a single word varies in size between remixes.
      result.text.meme = {
        ...result.text.meme,
        captionScale: rng.range(MEME_CAPTION_SCALE_MIN, MEME_CAPTION_SCALE_MAX),
      }
    }
    result.seed = seed
    return result
  }

  if (!locks.layout) {
    const alignSet = bias?.alignments?.length ? bias.alignments : ALIGNMENTS
    result.text.alignment = rng.pick(alignSet) as Alignment
    result.text.blockText = rollToggle(bias?.blockText, rng)
    const [lsp0, lsp1] = bias?.lineSpacing ?? [LINE_SPACING_PCT_MIN, LINE_SPACING_PCT_MAX]
    result.text.lineSpacingPct = rng.range(lsp0, lsp1)
    result.text.randomLineSlant = rollToggle(bias?.slant, rng)

    if (bias?.letterSpacing) {
      result.text.letterSpacingPct = rng.range(bias.letterSpacing[0], bias.letterSpacing[1])
    }

    // Randomize the line-break layout: balance words across 1..N lines.
    // For short text (<= SHORT_TEXT_WORDS) allow up to one word per line so a
    // tall, each-word-stacked arrangement is one of the possible outcomes.
    const wordCount = config.text.content.trim().split(/\s+/).filter(Boolean).length
    const maxLines = bias?.maxLines ?? LAYOUT_MAX_LINES
    const cap = wordCount <= SHORT_TEXT_WORDS ? wordCount : maxLines
    result.text.targetLines = wordCount > 0 ? rng.int(1, Math.max(1, cap)) : undefined
  }

  if (!locks.fonts) {
    let pool = opts.fontRefs
    if (bias?.fontIds?.length) {
      const allowed = new Set(bias.fontIds)
      const filtered = opts.fontRefs.filter((f) => allowed.has(f.id))
      if (filtered.length > 0) pool = filtered
    }
    if (pool.length > 0) {
      result.fontRef = rng.pick(pool)
    }
    if (opts.fontMix && pool.length > 0) {
      // Assign a per-line font, cycled across lines by the pipeline. Length is a
      // small pool; exact line count does not matter since the pipeline cycles.
      const lineCount = result.text.perLineFonts?.length || 4
      result.text.perLineFonts = Array.from({ length: lineCount }, () =>
        rng.pick(pool).id,
      )
    } else {
      // Mix off: drop any stale per-line fonts so the single fontRef applies.
      result.text.perLineFonts = undefined
    }
  }

  if (!locks.scale) {
    // Emphasis applies to a stable reference, not the incoming (possibly
    // already-shuffled) value. Multiplying the current value compounds across
    // repeated shuffles and blows the font size past the canvas bounds.
    const [se0, se1] = bias?.scaleEmphasis ?? [SCALE_EMPHASIS_MIN, SCALE_EMPHASIS_MAX]
    const emphasis = rng.range(se0, se1)
    result.text.baseFontSize = Math.round(BASE_FONT_SIZE_REFERENCE * emphasis)
  }

  if (!locks.effects) {
    const [ov0, ov1] = bias?.sprayOverflow ?? [OVERFLOW_MIN, OVERFLOW_MAX]
    result.text.sprayPaint.overflow = rng.int(ov0, ov1)

    // Shadow: toggle, vary offset direction/magnitude, recolor from the palette.
    result.text.shadow.enabled = rollToggle(bias?.shadow, rng)
    result.text.shadow.offsetX = rng.range(SHADOW_OFFSET_MIN, SHADOW_OFFSET_MAX)
    result.text.shadow.offsetY = rng.range(SHADOW_OFFSET_MIN, SHADOW_OFFSET_MAX)
    if (palette.length > 0) result.text.shadow.color = rng.pick(palette)

    // Outline: toggle, vary thickness, recolor from the palette.
    result.text.outline.enabled = rollToggle(bias?.outline, rng)
    const [or0, or1] = bias?.outlineRatio ?? [OUTLINE_RATIO_MIN, OUTLINE_RATIO_MAX]
    result.text.outline.ratio = rng.range(or0, or1)
    if (palette.length > 0) result.text.outline.color = rng.pick(palette)
  }

  if (!locks.color) {
    if (palette.length > 0) {
      result.text.color = pickReadableColor(rng, palette, opts.backgroundColor)
    }
  }

  result.seed = seed
  return result
}
