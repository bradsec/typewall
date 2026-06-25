// src/workers/render.worker.ts
//
// Comlink-exposed render worker. Runs inside a WorkerGlobalScope with
// OffscreenCanvas. Fonts and images are fetched directly from bundled asset
// URLs within the worker; no main-thread postMessage round-trips needed.

import { expose } from 'comlink'
import type { RenderConfig, AssetRef } from '../engine/types'
import { render, type ResolvedAssets } from '../engine/pipeline'
import { registerFont, resolveFamily } from '../engine/fonts'
import { createSurface } from '../engine/surface'

// ---------------------------------------------------------------------------
// Asset URL map passed from the main thread.
// Keys: AssetRef.id values; values: absolute or base-relative URLs.
// ---------------------------------------------------------------------------
export interface AssetUrls {
  font?: string
  bgImage?: string
  overlayImage?: string
  maskImage?: string
  watermarkImage?: string
}

// The pool already resolves asset URLs to absolute form, so these are normally
// passed through unchanged. The new URL() fallback safely handles any relative
// URL by resolving it against baseUrl, instead of a brittle string concat.
function resolveWorkerUrl(url: string, baseUrl: string): string {
  if (
    url.startsWith('blob:') ||
    url.startsWith('http:') ||
    url.startsWith('https:') ||
    url.startsWith('data:')
  ) {
    return url
  }
  return new URL(url, baseUrl).href
}

async function fetchImage(url: string, baseUrl: string): Promise<ImageBitmap> {
  const resolved = resolveWorkerUrl(url, baseUrl)
  const res = await fetch(resolved)
  if (!res.ok) throw new Error(`fetchImage: ${res.status} ${resolved}`)
  const blob = await res.blob()
  return createImageBitmap(blob)
}

async function fetchFont(
  ref: AssetRef,
  url: string,
  baseUrl: string,
): Promise<string> {
  const resolved = resolveWorkerUrl(url, baseUrl)
  const res = await fetch(resolved)
  if (!res.ok) throw new Error(`fetchFont: ${res.status} ${resolved}`)
  const data = await res.arrayBuffer()
  const family = resolveFamily(ref)
  await registerFont(family, data)
  return family
}

// ---------------------------------------------------------------------------
// Worker API
// ---------------------------------------------------------------------------

const worker = {
  /**
   * Renders a single RenderConfig to a PNG Blob.
   *
   * @param config  - The fully-resolved RenderConfig to render.
   * @param assetUrls - Map of asset urls needed by this config (font, images).
   * @param baseUrl   - Vite BASE_URL forwarded from the main thread so relative
   *                    bundled paths resolve correctly inside the worker.
   */
  async renderToPng(
    config: RenderConfig,
    assetUrls: AssetUrls,
    baseUrl: string,
  ): Promise<Blob> {
    const resolved: ResolvedAssets = { fontFamily: resolveFamily(config.fontRef) }

    // Register the font if a URL was provided.
    if (assetUrls.font) {
      resolved.fontFamily = await fetchFont(config.fontRef, assetUrls.font, baseUrl)
    }

    // Load optional image assets.
    if (assetUrls.bgImage) {
      resolved.bgImage = await (async () => {
        const bmp = await fetchImage(assetUrls.bgImage!, baseUrl)
        const s = createSurface(bmp.width, bmp.height)
        const ctx = (s as OffscreenCanvas).getContext('2d')!
        ctx.drawImage(bmp, 0, 0)
        bmp.close()
        return s
      })()
    }

    if (assetUrls.overlayImage) {
      resolved.overlayImage = await (async () => {
        const bmp = await fetchImage(assetUrls.overlayImage!, baseUrl)
        const s = createSurface(bmp.width, bmp.height)
        const ctx = (s as OffscreenCanvas).getContext('2d')!
        ctx.drawImage(bmp, 0, 0)
        bmp.close()
        return s
      })()
    }

    if (assetUrls.maskImage) {
      resolved.maskImage = await (async () => {
        const bmp = await fetchImage(assetUrls.maskImage!, baseUrl)
        const s = createSurface(bmp.width, bmp.height)
        const ctx = (s as OffscreenCanvas).getContext('2d')!
        ctx.drawImage(bmp, 0, 0)
        bmp.close()
        return s
      })()
    }

    if (assetUrls.watermarkImage) {
      resolved.watermarkImage = await (async () => {
        const bmp = await fetchImage(assetUrls.watermarkImage!, baseUrl)
        const s = createSurface(bmp.width, bmp.height)
        const ctx = (s as OffscreenCanvas).getContext('2d')!
        ctx.drawImage(bmp, 0, 0)
        bmp.close()
        return s
      })()
    }

    const canvas = new OffscreenCanvas(
      config.sizeFormat.width,
      config.sizeFormat.height,
    )
    render(config, canvas, resolved)
    return canvas.convertToBlob({ type: 'image/png' })
  },
}

expose(worker)
