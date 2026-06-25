import { createCanvas, GlobalFonts } from '@napi-rs/canvas'

GlobalFonts.registerFromPath('fonts/Anton.ttf', 'Anton')

class OffscreenCanvasShim {
  constructor(w: number, h: number) {
    return createCanvas(w, h)
  }
}
;(globalThis as any).OffscreenCanvas = OffscreenCanvasShim
