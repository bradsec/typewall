/**
 * Port of the original Python CLI's clean_text and calculate_line_length.
 * Divergences from brief snippet are noted inline.
 */

/**
 * Strips non-alphanumeric characters, lowercases, and truncates to 30 chars.
 * Mirrors the original Python CLI's clean_text.
 */
export function cleanFilename(text: string): string {
  return text.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 30)
}

/**
 * Calculates appropriate line length (in words) based on canvas dimensions and text.
 * Mirrors the original Python CLI's calculate_line_length.
 *
 * Divergence from brief snippet:
 *   Brief used `Math.max(5, Math.round(20 * aspect))` for tall canvas.
 *   Reference uses `5 + Math.trunc(15 * aspect)` (i.e. min + int((max - min) * ratio)).
 *   Reference does not apply a lower bound of 1 on the final result.
 *   Reference does not apply Math.floor(width / avgWordLen) as an additional constraint
 *   beyond the reference's own int(canvas_width / average_word_length).
 *   This implementation follows the reference behavior.
 */
export function calcLineLength(width: number, height: number, text: string): number {
  if (height === 0) return 20

  const aspectRatio = width / height

  const minLineLength = 5
  const medLineLength = 15
  const maxLineLength = 20

  const words = text.split(/\s+/).filter(Boolean)
  const wordCount = words.length
  const totalWordLength = words.reduce((sum, w) => sum + w.length, 0)
  const avgWordLength = wordCount > 0 ? totalWordLength / wordCount : 0

  let lineLength: number
  if (aspectRatio > 1) {
    lineLength = maxLineLength
  } else if (aspectRatio < 1) {
    lineLength = minLineLength + Math.trunc((maxLineLength - minLineLength) * aspectRatio)
  } else {
    lineLength = medLineLength
  }

  if (wordCount > 0 && avgWordLength > 0) {
    lineLength = Math.min(lineLength, Math.trunc(width / avgWordLength))
  }

  return lineLength
}
