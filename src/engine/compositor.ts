import type { Alignment } from './types'
import { createSurface, type Surface } from './surface'

function makeCanvas(w: number, h: number): Surface {
  return createSurface(w, h)
}

function ctx2d(c: Surface): CanvasRenderingContext2D {
  const ctx = (c as HTMLCanvasElement).getContext('2d')
  if (!ctx) throw new Error('2D context unavailable')
  return ctx as unknown as CanvasRenderingContext2D
}

export interface CompositeOptions {
  lineSurfaces: Surface[]
  canvasW: number
  canvasH: number
  padX: number
  padY: number
  lineSpacingPct: number
  alignment: Alignment
  blockText: boolean
  maxLineWidth?: number
}

/**
 * Ports the original Python CLI's composite_text_layers.
 * Stacks pre-rendered line surfaces onto a canvasW x canvasH RGBA surface,
 * applying blockText scaling, fit-to-height scaling, vertical centering,
 * and left/center/right alignment.
 */
export function compositeLines(opts: CompositeOptions): Surface {
  const { canvasW, canvasH, padX, padY, lineSpacingPct, alignment, blockText } = opts
  let lineSurfaces = opts.lineSurfaces

  if (lineSurfaces.length === 0) {
    return makeCanvas(canvasW, canvasH)
  }

  // Step 1: if blockText, resize all lines to maxLineWidth (or computed max width)
  if (blockText) {
    const maxW = opts.maxLineWidth ?? Math.max(...lineSurfaces.map(s => s.width))
    lineSurfaces = lineSurfaces.map(s => {
      const scale = maxW / s.width
      const newH = Math.round(s.height * scale)
      const scaled = makeCanvas(maxW, newH)
      ctx2d(scaled).drawImage(s as unknown as CanvasImageSource, 0, 0, maxW, newH)
      return scaled
    })
  }

  // Step 2: total height = sum of heights + spacing between lines
  const spacing = lineSpacingPct * canvasH
  let totalHeight = lineSurfaces.reduce((sum, s) => sum + s.height, 0)
  totalHeight += (lineSurfaces.length - 1) * spacing

  const availableHeight = canvasH - 2 * padY

  // Step 3: scale down all lines if total height exceeds available height
  if (totalHeight > availableHeight) {
    const scale = availableHeight / totalHeight
    lineSurfaces = lineSurfaces.map(s => {
      const newW = Math.round(s.width * scale)
      const newH = Math.round(s.height * scale)
      const scaled = makeCanvas(newW, newH)
      ctx2d(scaled).drawImage(s as unknown as CanvasImageSource, 0, 0, newW, newH)
      return scaled
    })
    totalHeight = lineSurfaces.reduce((sum, s) => sum + s.height, 0)
    totalHeight += (lineSurfaces.length - 1) * spacing
  }

  const out = makeCanvas(canvasW, canvasH)
  const ctx = ctx2d(out)

  // Step 4: start y centered within available area
  let y = Math.floor((availableHeight - totalHeight) / 2) + padY

  // Step 5: draw each line with alignment
  for (const surface of lineSurfaces) {
    let x: number
    if (alignment === 'left') {
      x = padX
    } else if (alignment === 'right') {
      x = canvasW - surface.width - padX
    } else {
      // center (and fallback)
      x = Math.floor((canvasW - surface.width) / 2)
    }

    ctx.drawImage(surface as unknown as CanvasImageSource, Math.floor(x), Math.floor(y))
    y += surface.height + spacing
  }

  return out
}
