import { Rng } from './rng'

/**
 * Environment-agnostic image buffer. Matches the shape of the DOM/canvas
 * ImageData (RGBA, row-major, 4 bytes per pixel) without depending on the
 * global ImageData constructor so these helpers run in browser, worker, and
 * Node test contexts alike.
 */
export interface ImageDataLike {
  data: Uint8ClampedArray
  width: number
  height: number
}

function emptyLike(width: number, height: number): ImageDataLike {
  return { data: new Uint8ClampedArray(width * height * 4), width, height }
}

/**
 * Erodes the alpha channel: each pixel's alpha becomes the minimum alpha over
 * the (2r+1)x(2r+1) neighbourhood. Out-of-bounds neighbours are treated as 0,
 * so block edges shrink. RGB channels are copied through unchanged.
 *
 * Ports PIL ImageFilter.MinFilter applied to the alpha channel (generator.py
 * Phase 1).
 */
export function minFilterAlpha(img: ImageDataLike, radius: number): ImageDataLike {
  const { width: w, height: h, data: src } = img
  const out = emptyLike(w, h)
  const dst = out.data
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4
      dst[idx] = src[idx]
      dst[idx + 1] = src[idx + 1]
      dst[idx + 2] = src[idx + 2]
      let min = 255
      for (let dy = -radius; dy <= radius && min > 0; dy++) {
        const ny = y + dy
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx
          let v: number
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) v = 0
          else v = src[(ny * w + nx) * 4 + 3]
          if (v < min) {
            min = v
            if (min === 0) break
          }
        }
      }
      dst[idx + 3] = min
    }
  }
  return out
}

/**
 * Dilates the alpha channel: each pixel's alpha becomes the maximum alpha over
 * the (2r+1)x(2r+1) neighbourhood. Out-of-bounds neighbours are treated as 0.
 * RGB channels are copied through unchanged.
 *
 * Ports PIL ImageFilter.MaxFilter applied to the alpha channel (used to build
 * edge masks, generator.py Phase 4).
 */
export function dilateAlpha(img: ImageDataLike, radius: number): ImageDataLike {
  const { width: w, height: h, data: src } = img
  const out = emptyLike(w, h)
  const dst = out.data
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4
      dst[idx] = src[idx]
      dst[idx + 1] = src[idx + 1]
      dst[idx + 2] = src[idx + 2]
      let max = 0
      for (let dy = -radius; dy <= radius && max < 255; dy++) {
        const ny = y + dy
        if (ny < 0 || ny >= h) continue
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx
          if (nx < 0 || nx >= w) continue
          const v = src[(ny * w + nx) * 4 + 3]
          if (v > max) {
            max = v
            if (max === 255) break
          }
        }
      }
      dst[idx + 3] = max
    }
  }
  return out
}

/**
 * Generates a stochastic particle mask: each pixel draws an 8-bit Gaussian
 * noise value (mean 128) via the supplied Rng, and the output alpha is 255
 * where the noise exceeds the threshold, otherwise 0. RGB are left at 0.
 *
 * Ports the PIL pattern `Image.effect_noise(...).point(threshold_binary)`
 * used for particle placement (generator.py Phase 3, threshold = 245 -
 * overflow * 2). Determinism comes entirely from the Rng.
 */
export function thresholdNoise(w: number, h: number, threshold: number, rng: Rng): ImageDataLike {
  const out = emptyLike(w, h)
  const dst = out.data
  for (let i = 0; i < w * h; i++) {
    const n = gaussianByte(rng)
    dst[i * 4 + 3] = n > threshold ? 255 : 0
  }
  return out
}

/**
 * Edge displacement remap. For each output pixel, samples the source alpha at
 * (x + hMap, y + vMap), rounding to the nearest integer and clamping to image
 * bounds. RGB channels are copied through from the matching source pixel.
 *
 * Ports the numpy displacement remap in generator.py Phase 2. Unlike the
 * Python reference, which gated this behind an optional numpy import, the port
 * always runs it.
 */
export function displaceEdges(img: ImageDataLike, hMap: Float32Array, vMap: Float32Array): ImageDataLike {
  const { width: w, height: h, data: src } = img
  const out = emptyLike(w, h)
  const dst = out.data
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      let sx = Math.round(x + hMap[i])
      let sy = Math.round(y + vMap[i])
      if (sx < 0) sx = 0
      else if (sx > w - 1) sx = w - 1
      if (sy < 0) sy = 0
      else if (sy > h - 1) sy = h - 1
      const srcIdx = (sy * w + sx) * 4
      const dstIdx = i * 4
      dst[dstIdx] = src[srcIdx]
      dst[dstIdx + 1] = src[srcIdx + 1]
      dst[dstIdx + 2] = src[srcIdx + 2]
      dst[dstIdx + 3] = src[srcIdx + 3]
    }
  }
  return out
}

/**
 * Draws one 8-bit sample of Gaussian noise centred at 128, matching the
 * distribution of PIL's Image.effect_noise (mean 128, standard deviation set
 * by the sigma the caller folds into how it consumes the value). A fixed
 * sigma of 1 standard deviation step is applied here; callers that need a
 * specific sigma scale the result. Uses Box-Muller over the deterministic Rng.
 */
function gaussianByte(rng: Rng): number {
  return clampByte(128 + gaussianUnit(rng) * 64)
}

/**
 * Standard-normal sample in roughly [-3, 3] via Box-Muller using two Rng
 * draws. Deterministic for a fixed Rng seed.
 */
export function gaussianUnit(rng: Rng): number {
  let u1 = rng.next()
  if (u1 < 1e-12) u1 = 1e-12
  const u2 = rng.next()
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}

function clampByte(v: number): number {
  if (v < 0) return 0
  if (v > 255) return 255
  return Math.round(v)
}
