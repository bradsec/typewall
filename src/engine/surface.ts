export type Surface = OffscreenCanvas | HTMLCanvasElement

export function createSurface(w: number, h: number): Surface {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h)
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c
}

export function getCtx(s: Surface): CanvasRenderingContext2D {
  const ctx = (s as HTMLCanvasElement).getContext('2d')
  if (!ctx) throw new Error('2D context unavailable')
  return ctx as CanvasRenderingContext2D
}
