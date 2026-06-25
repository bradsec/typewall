// src/state/assets.ts
//
// Asset loading layer for browser/worker use.
// - loadImage: fetches a URL and returns an ImageBitmap
// - loadFontData: fetches a URL and returns raw ArrayBuffer font data
// - registerUploadedFont / registerUploadedImage: accept a File, create an object
//   URL, store in the upload registry, and return an AssetRef
//
// Uploaded assets are held in a module-level Map for the session lifetime.
// The Map key is the AssetRef id (a stable string derived from the file name).

import type { AssetRef } from '../engine/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UploadRecord {
  url: string
  blob: Blob
  name: string
}

// ---------------------------------------------------------------------------
// Upload registry (in-memory, session-scoped)
// ---------------------------------------------------------------------------

const uploadedAssets = new Map<string, UploadRecord>()

export function uploadId(file: File, prefix: string): string {
  // Stable enough for the session: prefix + sanitised filename.
  const safe = file.name.toLowerCase().replace(/[^a-z0-9._-]/g, '-')
  return `${prefix}/${safe}`
}

/**
 * Register an already-loaded blob (e.g. rehydrated from IndexedDB) into the
 * session upload registry under a known id, returning its object URL.
 */
export function registerUploadedBlob(id: string, name: string, blob: Blob): string {
  const existing = uploadedAssets.get(id)
  if (existing) return existing.url
  const url = URL.createObjectURL(blob)
  uploadedAssets.set(id, { url, blob, name })
  return url
}

/**
 * CSS font-family for an uploaded font ref. Shared by the picker preview and
 * the render path so both agree on the registered FontFace name.
 */
export function uploadedFontFamily(id: string): string {
  return `igfont-uploaded-${id.replace(/\W/g, '_')}`
}

// Track which uploaded families are registered. document.fonts.check() is not
// reliable here: for an unregistered custom family it returns true via system
// fallback, which would skip loading and leave canvas text in a serif fallback.
const loadedUploadedFamilies = new Set<string>()

/**
 * Load (once) the FontFace for an uploaded font ref and return its family name.
 * Returns undefined if the ref is not an uploaded asset present in the registry.
 */
export async function ensureUploadedFontFace(ref: AssetRef): Promise<string | undefined> {
  const url = resolveUploadedUrl(ref)
  if (!url) return undefined
  const family = uploadedFontFamily(ref.id)
  if (loadedUploadedFamilies.has(family)) return family
  const resp = await fetch(url)
  const data = await resp.arrayBuffer()
  const face = new FontFace(family, data)
  await face.load()
  document.fonts.add(face)
  loadedUploadedFamilies.add(family)
  return family
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve a bundled asset path to a URL that works under any Vite base path.
 * Uploaded assets (blob: URLs) and absolute URLs are returned unchanged.
 */
export function resolveAssetUrl(url: string): string {
  if (url.startsWith('blob:') || url.startsWith('http:') || url.startsWith('https:') || url.startsWith('data:')) {
    return url
  }
  return `${import.meta.env.BASE_URL}${url}`
}

/**
 * Fetch an image URL and decode it to an ImageBitmap.
 * Works in both the main thread and OffscreenCanvas workers.
 */
export async function loadImage(url: string): Promise<ImageBitmap> {
  const response = await fetch(resolveAssetUrl(url))
  if (!response.ok) throw new Error(`loadImage: ${response.status} ${url}`)
  const blob = await response.blob()
  return createImageBitmap(blob)
}

/**
 * Fetch a font URL and return raw bytes for use with FontFace / @napi-rs/canvas.
 */
export async function loadFontData(url: string): Promise<ArrayBuffer> {
  const response = await fetch(resolveAssetUrl(url))
  if (!response.ok) throw new Error(`loadFontData: ${response.status} ${url}`)
  return response.arrayBuffer()
}

/**
 * Register an uploaded font File for the session.
 * Creates a blob object URL, stores it in the upload registry, and returns
 * an AssetRef that can be used as `fontRef` in a RenderConfig.
 */
export async function registerUploadedFont(file: File): Promise<AssetRef> {
  const id = uploadId(file, 'uploaded/fonts')
  // Reuse the existing object URL for an identical upload; creating a new one
  // and overwriting the map entry would leak the previous blob URL.
  if (!uploadedAssets.has(id)) {
    uploadedAssets.set(id, { url: URL.createObjectURL(file), blob: file, name: file.name })
  }
  return { id, kind: 'uploaded' }
}

/**
 * Register an uploaded image File for the session.
 * Creates a blob object URL, stores it in the upload registry, and returns
 * an AssetRef that can be used as a background/overlay asset reference.
 */
export async function registerUploadedImage(file: File): Promise<AssetRef> {
  const id = uploadId(file, 'uploaded/images')
  // Reuse the existing object URL for an identical upload; creating a new one
  // and overwriting the map entry would leak the previous blob URL.
  if (!uploadedAssets.has(id)) {
    uploadedAssets.set(id, { url: URL.createObjectURL(file), blob: file, name: file.name })
  }
  return { id, kind: 'uploaded' }
}

/**
 * Resolve an uploaded AssetRef to its blob URL.
 * Returns undefined if the ref is bundled or not found in the upload registry.
 */
export function resolveUploadedUrl(ref: AssetRef): string | undefined {
  if (ref.kind !== 'uploaded') return undefined
  return uploadedAssets.get(ref.id)?.url
}

/**
 * Resolve an uploaded AssetRef to its original file name for display.
 * Returns undefined if the ref is bundled or not found in the upload registry.
 */
export function resolveUploadedName(ref: AssetRef): string | undefined {
  if (ref.kind !== 'uploaded') return undefined
  return uploadedAssets.get(ref.id)?.name
}
