// constraints.ts: safe ranges for each shuffle dimension.
// All values chosen so rendered output stays legible:
// - alignment: three standard values, no unusual modes
// - lineSpacingPct: [0.0, 0.15] — zero is tight but readable; above 0.15 fragments lines visually
// - overflow: [5, 25] — below 5 the spray edge disappears; above 25 bleeds heavily off canvas
// - scaleEmphasis: [0.8, 1.4] — never shrinks below 80% (still readable) or above 140% (overflow)
// - shadow/outline: booleans only, not randomized magnitudes (keeps structure predictable)
// - slant: on/off only (engine expects -3..3 deg; toggling random_line_slant controls that)

import type { Alignment } from '../engine/types'

export const ALIGNMENTS: Alignment[] = ['left', 'center', 'right']

export const LINE_SPACING_PCT_MIN = 0.0
export const LINE_SPACING_PCT_MAX = 0.15

export const OVERFLOW_MIN = 5
export const OVERFLOW_MAX = 25

export const SCALE_EMPHASIS_MIN = 0.8
export const SCALE_EMPHASIS_MAX = 1.4

// Shadow offset per axis (normalized; multiplied by canvas dims at render).
// Default is +-0.003; this range keeps the drop legible without detaching the
// shadow from the glyphs. Sign is included so direction varies.
export const SHADOW_OFFSET_MIN = -0.006
export const SHADOW_OFFSET_MAX = 0.006

// Outline thickness ratio (normalized). Default 0.015. Below ~0.008 the stroke
// disappears; above ~0.04 it swallows thin glyphs.
export const OUTLINE_RATIO_MIN = 0.008
export const OUTLINE_RATIO_MAX = 0.04

// Max lines the layout shuffle will break longer text into. Above ~5 lines a
// long phrase fragments and loses impact.
export const LAYOUT_MAX_LINES = 5

// At or below this word count, the layout shuffle may stack every word on its
// own line (tall arrangement), so the line cap rises to the word count.
export const SHORT_TEXT_WORDS = 6

// Meme caption size factor range for Remix. Below 1 the caption (and its bar)
// shrinks so a single word does not always fill the height cap.
export const MEME_CAPTION_SCALE_MIN = 0.45
export const MEME_CAPTION_SCALE_MAX = 1.0
