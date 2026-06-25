import { imageDataRGBA } from 'stackblur-canvas'
import { Rng } from './rng'
import { Surface, createSurface, getCtx } from './surface'
import type { SprayPaintConfig } from './types'
import {
  ImageDataLike,
  minFilterAlpha,
  dilateAlpha,
  displaceEdges,
  gaussianUnit,
} from './imageops'

// ============================================================================
// SPRAY PAINT EFFECT CONSTANTS (ported from the original Python CLI)
// ============================================================================
const OVERSPRAY_PADDING = 120
const SCALE_FACTOR_MIN = 0.4
const SCALE_FACTOR_MAX = 2.5
const MIN_NOISE_SIZE = 8

const EDGE_EROSION_SCALE = 1.0
const EDGE_NOISE_SIGMA = 60

const DISTORTION_STRENGTH_SCALE = 0.8
// Extra displacement (px, pre-scale) added at maximum `distort`. Tuned so full
// distort visibly warps whole letters without shredding them.
const DISTORTION_EXTRA_STRENGTH = 26
const DISTORTION_NOISE_FREQUENCY = 6
const DISTORTION_NOISE_SIGMA = 70
const DISTORTION_EDGE_THRESHOLD = 200

const OVERSPRAY_FALLOFF_STAGES = 3
const OVERSPRAY_BASE_SPREAD = 15
const OVERSPRAY_FALLOFF_EXPONENT = 0.6
const OVERSPRAY_THRESHOLD_BASE = 245
const OVERSPRAY_THRESHOLD_SCALE = 2
const OVERSPRAY_PARTICLE_NOISE = 50

const EDGE_TEXTURE_DILATION = 3
const EDGE_TEXTURE_CORE_THRESHOLD = 230
const EDGE_TEXTURE_NOISE_SIGMA = 88
const EDGE_TEXTURE_STRENGTH = 12
const EDGE_TEXTURE_THRESHOLD = 250

const FINAL_BLUR_SCALE = 0.3

// PIL MaxFilter/MinFilter take an odd kernel size; the radius is (size - 1)/2.
const EDGE_TEXTURE_DILATION_RADIUS = (EDGE_TEXTURE_DILATION - 1) / 2

// ----------------------------------------------------------------------------
// Single-channel alpha plane helpers (port of PIL ImageChops on the alpha band)
// ----------------------------------------------------------------------------

type Plane = { data: Float32Array; width: number; height: number }

function planeOf(width: number, height: number): Plane {
  return { data: new Float32Array(width * height), width, height }
}

/** Extract the alpha channel of an RGBA buffer into a single-channel plane. */
function alphaPlane(img: ImageDataLike): Plane {
  const p = planeOf(img.width, img.height)
  for (let i = 0; i < p.data.length; i++) p.data[i] = img.data[i * 4 + 3]
  return p
}

function copyPlane(p: Plane): Plane {
  const out = planeOf(p.width, p.height)
  out.data.set(p.data)
  return out
}

/** PIL ImageChops.subtract (no scale/offset): clamp(a - b) per pixel. */
function planeSubtract(a: Plane, b: Plane): Plane {
  const out = planeOf(a.width, a.height)
  for (let i = 0; i < a.data.length; i++) out.data[i] = clamp255(a.data[i] - b.data[i])
  return out
}

/** PIL ImageChops.add (no scale/offset): clamp(a + b) per pixel. */
function planeAdd(a: Plane, b: Plane): Plane {
  const out = planeOf(a.width, a.height)
  for (let i = 0; i < a.data.length; i++) out.data[i] = clamp255(a.data[i] + b.data[i])
  return out
}

/** PIL ImageChops.multiply: round(a * b / 255) per pixel. */
function planeMultiply(a: Plane, b: Plane): Plane {
  const out = planeOf(a.width, a.height)
  for (let i = 0; i < a.data.length; i++) out.data[i] = Math.round((a.data[i] * b.data[i]) / 255)
  return out
}

/** PIL Image.point with an arbitrary per-pixel mapping. */
function planePoint(p: Plane, fn: (v: number) => number): Plane {
  const out = planeOf(p.width, p.height)
  for (let i = 0; i < p.data.length; i++) out.data[i] = clamp255(fn(p.data[i]))
  return out
}

function thresholdBinary(v: number, threshold: number): number {
  return v > threshold ? 255 : 0
}

function clamp255(v: number): number {
  if (v < 0) return 0
  if (v > 255) return 255
  return v
}

// ----------------------------------------------------------------------------
// Morphology on planes (alpha min/max filter via the imageops helpers)
// ----------------------------------------------------------------------------

function planeToRGBA(p: Plane): ImageDataLike {
  const data = new Uint8ClampedArray(p.width * p.height * 4)
  for (let i = 0; i < p.data.length; i++) data[i * 4 + 3] = p.data[i]
  return { data, width: p.width, height: p.height }
}

function maxFilterPlane(p: Plane, radius: number): Plane {
  if (radius <= 0) return copyPlane(p)
  return alphaPlane(dilateAlpha(planeToRGBA(p), radius))
}

function minFilterPlane(p: Plane, radius: number): Plane {
  if (radius <= 0) return copyPlane(p)
  return alphaPlane(minFilterAlpha(planeToRGBA(p), radius))
}

// ----------------------------------------------------------------------------
// Gaussian blur on a plane via stackblur (Gaussian-equivalent approximation)
// ----------------------------------------------------------------------------

function gaussianBlurPlane(p: Plane, radius: number): Plane {
  const r = Math.max(0, Math.round(radius))
  if (r === 0) return copyPlane(p)
  // Replicate the plane into all RGBA channels so stackblur preserves it, then
  // read one channel back. stackblur accepts any ImageData-shaped object.
  const data = new Uint8ClampedArray(p.width * p.height * 4)
  for (let i = 0; i < p.data.length; i++) {
    const v = Math.round(p.data[i])
    data[i * 4] = v
    data[i * 4 + 1] = v
    data[i * 4 + 2] = v
    data[i * 4 + 3] = 255
  }
  const id = { data, width: p.width, height: p.height }
  imageDataRGBA(id as unknown as ImageData, 0, 0, p.width, p.height, r)
  const out = planeOf(p.width, p.height)
  for (let i = 0; i < out.data.length; i++) out.data[i] = data[i * 4]
  return out
}

// ----------------------------------------------------------------------------
// PIL Image.effect_noise: Gaussian noise, mean 128, std = sigma, clamped 0-255.
// Deterministic via the supplied Rng.
// ----------------------------------------------------------------------------

function effectNoise(width: number, height: number, sigma: number, rng: Rng): Plane {
  const p = planeOf(width, height)
  for (let i = 0; i < p.data.length; i++) p.data[i] = clamp255(128 + gaussianUnit(rng) * sigma)
  return p
}

/** Nearest-neighbour resize of a plane (used to upsample the noise fields). */
function resizePlane(p: Plane, w: number, h: number): Plane {
  if (p.width === w && p.height === h) return copyPlane(p)
  const out = planeOf(w, h)
  for (let y = 0; y < h; y++) {
    const sy = Math.min(p.height - 1, Math.floor((y / h) * p.height))
    for (let x = 0; x < w; x++) {
      const sx = Math.min(p.width - 1, Math.floor((x / w) * p.width))
      out.data[y * w + x] = p.data[sy * p.width + sx]
    }
  }
  return out
}

/**
 * Applies the spray paint stencil effect, porting the five phases of the original Python CLI.
 *
 * Differences from the Python reference, by design:
 * - Phase 2 (edge displacement) always runs; Python gated it on an optional
 *   numpy import.
 * - scaleFactor defaults to 1.0 (caller may pass base_font_size / 80, which the
 *   pipeline does); it is still clamped to [SCALE_FACTOR_MIN, MAX].
 * - Blur is the stackblur Gaussian approximation rather than PIL's exact
 *   GaussianBlur. Pixel parity is handled separately by the parity harness.
 */
export function applySpray(
  textBlock: Surface,
  cfg: SprayPaintConfig,
  color: string,
  rng: Rng,
  scaleFactorInput = 1.0,
): Surface {
  // Expand canvas for overspray halo (prevents edge clipping).
  const srcW = textBlock.width
  const srcH = textBlock.height
  const expandedW = srcW + OVERSPRAY_PADDING * 2
  const expandedH = srcH + OVERSPRAY_PADDING * 2

  const expanded = createSurface(expandedW, expandedH)
  const ectx = getCtx(expanded)
  ectx.clearRect(0, 0, expandedW, expandedH)
  ectx.drawImage(textBlock as CanvasImageSource, OVERSPRAY_PADDING, OVERSPRAY_PADDING)

  const expandedImg = ectx.getImageData(0, 0, expandedW, expandedH) as unknown as ImageDataLike
  const rgb = parseColor(color)

  // Original alpha band (PIL `a`).
  const a = alphaPlane(expandedImg)

  // scale_factor: resolution-dependent effect scaling. The caller supplies
  // base_font_size / FONT_SIZE_REFERENCE (default 1.0); it is clamped here to
  // the valid range, mirroring reference SCALE_FACTOR_MIN/MAX.
  const scaleFactor = Math.min(SCALE_FACTOR_MAX, Math.max(SCALE_FACTOR_MIN, scaleFactorInput))

  // ==========================================================================
  // PHASE 1: Edge Irregularity (Crisp Core + Rough Edges)
  // ==========================================================================
  let erodeSize = Math.max(1, Math.trunc(EDGE_EROSION_SCALE * scaleFactor))
  if (erodeSize % 2 === 0) erodeSize += 1

  let coreAlpha = copyPlane(a)
  if (erodeSize > 1) {
    coreAlpha = minFilterPlane(coreAlpha, (erodeSize - 1) / 2)
  }

  const edgeNoise = effectNoise(expandedW, expandedH, EDGE_NOISE_SIGMA, rng)

  // Edge mask: transition zone between text and background.
  const dilatedAlpha = maxFilterPlane(a, EDGE_TEXTURE_DILATION_RADIUS)
  const edgeMask = planeSubtract(dilatedAlpha, a)

  const edgeRoughness = planeMultiply(edgeNoise, edgeMask)
  coreAlpha = planeSubtract(coreAlpha, planePoint(edgeRoughness, (v) => Math.trunc(v / 8)))

  // ==========================================================================
  // PHASE 2: Edge Displacement (Organic Warping) -- always runs in this port.
  // The `distort` amount (0-100) increases displacement magnitude and spreads
  // it from the edges into the letter interior for a melted, warped look. At
  // distort 0 this matches the original edge-only behaviour exactly.
  // ==========================================================================
  const distortAmt = Math.min(1, Math.max(0, (cfg.distort ?? 0) / 100))
  const distortionStrength = Math.max(
    1,
    Math.trunc((DISTORTION_STRENGTH_SCALE + distortAmt * DISTORTION_EXTRA_STRENGTH) * scaleFactor),
  )
  if (distortionStrength > 0 && expandedH >= MIN_NOISE_SIZE && expandedW >= MIN_NOISE_SIZE) {
    // Edge-only zone: distort edges, keep the solid interior fixed.
    const edgeZone = planeSubtract(
      planePoint(dilatedAlpha, (v) => thresholdBinary(v, 0)),
      planePoint(a, (v) => thresholdBinary(v, DISTORTION_EDGE_THRESHOLD)),
    )

    // Lower the noise frequency as distortion rises so warps become broad waves
    // rather than fine jitter.
    const freq = Math.max(2, DISTORTION_NOISE_FREQUENCY - Math.round(distortAmt * 3))
    const noiseH = Math.max(MIN_NOISE_SIZE, Math.trunc(expandedH / freq))
    const noiseW = Math.max(MIN_NOISE_SIZE, Math.trunc(expandedW / freq))

    const hNoise = resizePlane(effectNoise(noiseW, noiseH, DISTORTION_NOISE_SIGMA, rng), expandedW, expandedH)
    const vNoise = resizePlane(effectNoise(noiseW, noiseH, DISTORTION_NOISE_SIGMA, rng), expandedW, expandedH)

    const hMap = new Float32Array(expandedW * expandedH)
    const vMap = new Float32Array(expandedW * expandedH)
    for (let i = 0; i < hMap.length; i++) {
      // Edges always displace; interior displaces proportionally to distortAmt
      // (weighted by how solid the pixel is) so whole letters warp at high amounts.
      const interior = (a.data[i] / 255) * distortAmt
      const weight = Math.max(edgeZone.data[i] / 255, interior)
      hMap[i] = ((hNoise.data[i] - 128) / 128) * distortionStrength * weight
      vMap[i] = ((vNoise.data[i] - 128) / 128) * distortionStrength * weight
    }

    coreAlpha = alphaPlane(displaceEdges(planeToRGBA(coreAlpha), hMap, vMap))
  }

  // ==========================================================================
  // PHASE 3: Stochastic Overspray (Exponential Falloff)
  // ==========================================================================
  let newA: Plane
  if (cfg.overflow > 0) {
    const overspraySpread = Math.trunc(
      OVERSPRAY_BASE_SPREAD * scaleFactor * (cfg.overflow / OVERSPRAY_BASE_SPREAD),
    )

    let probabilityMap = copyPlane(a)
    for (let stage = 0; stage < OVERSPRAY_FALLOFF_STAGES; stage++) {
      const blurAmount = (overspraySpread * (stage + 1)) / OVERSPRAY_FALLOFF_STAGES
      const blurredStage = gaussianBlurPlane(a, blurAmount)
      const decay = Math.pow(OVERSPRAY_FALLOFF_EXPONENT, stage + 1)
      const contribution = planePoint(blurredStage, (v) => Math.trunc(v * decay))
      probabilityMap = planeAdd(probabilityMap, contribution)
    }

    const particleNoise = effectNoise(expandedW, expandedH, OVERSPRAY_PARTICLE_NOISE, rng)
    const oversprayThreshold = OVERSPRAY_THRESHOLD_BASE - Math.trunc(cfg.overflow * OVERSPRAY_THRESHOLD_SCALE)
    const oversprayMask = planePoint(particleNoise, (v) => thresholdBinary(v, oversprayThreshold))

    let oversprayLayer = planeMultiply(probabilityMap, oversprayMask)
    oversprayLayer = planePoint(oversprayLayer, (v) => Math.min(255, v))

    newA = planeAdd(coreAlpha, oversprayLayer)
  } else {
    newA = coreAlpha
  }

  // ==========================================================================
  // PHASE 4: Edge-Only Texture (Solid Interior)
  // ==========================================================================
  const edgeDetectionMask = planeSubtract(
    maxFilterPlane(newA, EDGE_TEXTURE_DILATION_RADIUS),
    planePoint(newA, (v) => thresholdBinary(v, EDGE_TEXTURE_CORE_THRESHOLD)),
  )

  const textureNoise = effectNoise(expandedW, expandedH, EDGE_TEXTURE_NOISE_SIGMA, rng)
  let edgeTexture = planePoint(textureNoise, (v) => (v > EDGE_TEXTURE_THRESHOLD ? EDGE_TEXTURE_STRENGTH : 0))
  edgeTexture = planeMultiply(edgeTexture, edgeDetectionMask)
  newA = planeSubtract(newA, edgeTexture)

  // ==========================================================================
  // PHASE 5: Final Polish (Subtle Smoothing) + RGB recolor.
  // ==========================================================================
  const finalBlur = FINAL_BLUR_SCALE * scaleFactor
  newA = gaussianBlurPlane(newA, finalBlur)

  const outData = new Uint8ClampedArray(expandedW * expandedH * 4)
  for (let i = 0; i < newA.data.length; i++) {
    outData[i * 4] = rgb[0]
    outData[i * 4 + 1] = rgb[1]
    outData[i * 4 + 2] = rgb[2]
    outData[i * 4 + 3] = Math.round(newA.data[i])
  }

  const out = createSurface(expandedW, expandedH)
  const octx = getCtx(out)
  octx.putImageData(toImageData(octx, outData, expandedW, expandedH), 0, 0)
  return out
}

function toImageData(ctx: CanvasRenderingContext2D, data: Uint8ClampedArray, w: number, h: number): ImageData {
  const id = ctx.createImageData(w, h)
  id.data.set(data)
  return id
}

function parseColor(color: string): [number, number, number] {
  const c = color.trim()
  if (c.startsWith('#')) {
    let hex = c.slice(1)
    if (hex.length === 3) hex = hex.split('').map((ch) => ch + ch).join('')
    if (hex.length === 6) {
      const n = parseInt(hex, 16)
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    }
  }
  const m = c.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i)
  if (m) return [Number(m[1]) & 255, Number(m[2]) & 255, Number(m[3]) & 255]
  return [255, 255, 255]
}
