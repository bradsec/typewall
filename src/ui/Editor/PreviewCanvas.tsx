import { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react'
import type { CSSProperties } from 'react'
import type { RenderConfig } from '../../engine/types'
import type { ResolvedAssets } from '../../engine/pipeline'
import { render } from '../../engine/pipeline'
import { manifest } from '../../assets/manifest'
import { loadImage, resolveUploadedUrl, resolveAssetUrl, ensureUploadedFontFace } from '../../state/assets'
import { useStore } from '../../state/store'
import { resolveFontFamily } from '../components/FontPicker'
import { useUploadedFonts } from '../../state/uploaded-fonts'
import { useEyedropper } from '../../state/eyedropper'

export interface PreviewCanvasHandle {
  toBlob: (callback: (blob: Blob | null) => void, type?: string) => void
}

interface PreviewCanvasProps {
  config: RenderConfig
}

type RenderState = 'loading' | 'ok' | 'error'

// Bounded LRU cache of decoded ImageBitmaps. Bitmaps are GPU-backed and can be
// large, so the cache is capped and the oldest entry is closed on eviction to
// release memory when many unique images are loaded in one session.
const IMAGE_CACHE = new Map<string, ImageBitmap>()
const IMAGE_CACHE_MAX = 24

function cachePut(key: string, bmp: ImageBitmap): void {
  if (IMAGE_CACHE.size >= IMAGE_CACHE_MAX) {
    const oldest = IMAGE_CACHE.keys().next().value as string | undefined
    if (oldest !== undefined) {
      IMAGE_CACHE.get(oldest)?.close()
      IMAGE_CACHE.delete(oldest)
    }
  }
  IMAGE_CACHE.set(key, bmp)
}

// Transparency checkerboard, shown through transparent canvas pixels so a
// transparent background reads as transparent (not a flat grey).
const CHECKERBOARD: CSSProperties = {
  backgroundColor: '#15171a',
  backgroundImage:
    'linear-gradient(45deg, #2a2e34 25%, transparent 25%), linear-gradient(-45deg, #2a2e34 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #2a2e34 75%), linear-gradient(-45deg, transparent 75%, #2a2e34 75%)',
  backgroundSize: '20px 20px',
  backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0',
}

// Scratch 1x1 canvas for averaging a background image down to a single color.
// Drawing scaled to 1x1 lets the browser box-filter the whole image cheaply.
let AVG_CANVAS: HTMLCanvasElement | null = null

function averageColorHex(src: CanvasImageSource): string | null {
  try {
    if (!AVG_CANVAS) {
      AVG_CANVAS = document.createElement('canvas')
      AVG_CANVAS.width = 1
      AVG_CANVAS.height = 1
    }
    const ctx = AVG_CANVAS.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    ctx.clearRect(0, 0, 1, 1)
    ctx.drawImage(src, 0, 0, 1, 1)
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
    return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
  } catch {
    return null
  }
}

// Keep the store's cached background-average color in sync with what was just
// rendered, so shuffle can bias text colors for contrast against an image
// background. Cleared when the background is not an image.
function syncBgAvgColor(cfg: RenderConfig, bgImage: CanvasImageSource | undefined): void {
  const ref = cfg.background.image.assetRef
  const { bgAvgColor, setBgAvgColor } = useStore.getState()
  if (cfg.background.transparent || !cfg.background.image.enabled || !ref || !bgImage) {
    if (bgAvgColor !== null) setBgAvgColor(null)
    return
  }
  const color = averageColorHex(bgImage)
  if (!color) return
  if (bgAvgColor?.id !== ref.id || bgAvgColor?.color !== color) {
    setBgAvgColor({ id: ref.id, color })
  }
}

async function loadCachedImage(url: string): Promise<ImageBitmap> {
  const resolved = resolveAssetUrl(url)
  const cached = IMAGE_CACHE.get(resolved)
  if (cached) {
    // Refresh recency: move to the end of the Map's insertion order.
    IMAGE_CACHE.delete(resolved)
    IMAGE_CACHE.set(resolved, cached)
    return cached
  }
  const bmp = await loadImage(url)
  cachePut(resolved, bmp)
  return bmp
}

async function resolveAssets(config: RenderConfig): Promise<ResolvedAssets> {
  const fontEntry = manifest.fonts.find((f) => f.id === config.fontRef.id)
  const fontRef = config.fontRef
  let fontFamily = 'sans-serif'

  if (fontRef.kind === 'uploaded') {
    try {
      const fam = await ensureUploadedFontFace(fontRef)
      if (fam) fontFamily = fam
    } catch {
      fontFamily = 'sans-serif'
    }
  } else if (fontEntry) {
    fontFamily = await resolveFontFamily(fontRef, manifest.fonts)
  }

  const assets: ResolvedAssets = { fontFamily }

  // Per-line fonts (Mix fonts): resolve each id to a loaded family. Ids may be
  // bundled (manifest) or uploaded; the pipeline cycles them across lines.
  if (config.text.perLineFonts && config.text.perLineFonts.length > 0) {
    assets.perLineFamilies = await Promise.all(
      config.text.perLineFonts.map(async (id) => {
        if (manifest.fonts.some((f) => f.id === id)) {
          return resolveFontFamily({ id, kind: 'bundled' }, manifest.fonts)
        }
        return (await ensureUploadedFontFace({ id, kind: 'uploaded' })) ?? fontFamily
      }),
    )
  }

  // Background image
  if (!config.background.transparent && config.background.image.enabled && config.background.image.assetRef) {
    const ref = config.background.image.assetRef
    try {
      if (ref.kind === 'uploaded') {
        const url = resolveUploadedUrl(ref)
        if (url) {
          const cached = IMAGE_CACHE.get(url)
          if (cached) {
            assets.bgImage = cached
          } else {
            const bmp = await loadCachedImage(url)
            assets.bgImage = bmp
          }
        }
      } else {
        const entry = manifest.backgrounds.find((b) => b.id === ref.id)
        if (entry) assets.bgImage = await loadCachedImage(entry.url)
      }
    } catch { /* skip */ }
  }

  // Overlay image
  if (!config.background.transparent && config.overlay.image.enabled && config.overlay.image.assetRef) {
    const ref = config.overlay.image.assetRef
    try {
      if (ref.kind === 'uploaded') {
        const url = resolveUploadedUrl(ref)
        if (url) assets.overlayImage = await loadCachedImage(url)
      } else {
        const entry = manifest.overlays.find((o) => o.id === ref.id)
        if (entry) assets.overlayImage = await loadCachedImage(entry.url)
      }
    } catch { /* skip */ }
  }

  // Text mask
  if (!config.background.transparent && config.overlay.textMask.enabled && config.overlay.textMask.assetRef) {
    const ref = config.overlay.textMask.assetRef
    try {
      if (ref.kind === 'uploaded') {
        const url = resolveUploadedUrl(ref)
        if (url) assets.maskImage = await loadCachedImage(url)
      } else {
        const entry = manifest.textmasks.find((m) => m.id === ref.id)
        if (entry) assets.maskImage = await loadCachedImage(entry.url)
      }
    } catch { /* skip */ }
  }

  // Watermark
  if (config.watermark.enabled && config.watermark.assetRef) {
    const ref = config.watermark.assetRef
    try {
      if (ref.kind === 'uploaded') {
        const url = resolveUploadedUrl(ref)
        if (url) assets.watermarkImage = await loadCachedImage(url)
      } else {
        const entry = manifest.watermarks.find((w) => w.id === ref.id)
        if (entry) assets.watermarkImage = await loadCachedImage(entry.url)
      }
    } catch { /* skip */ }
  }

  return assets
}

export const PreviewCanvas = forwardRef<PreviewCanvasHandle, PreviewCanvasProps>(function PreviewCanvas({ config }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [renderState, setRenderState] = useState<RenderState>('loading')
  const [renderError, setRenderError] = useState<string>('')
  const [fitPct, setFitPct] = useState(100)

  const pickActive = useEyedropper((s) => s.pick != null)
  const sampleColor = useEyedropper((s) => s.sample)
  const cancelPick = useEyedropper((s) => s.cancel)

  // Sample the clicked pixel from the rendered canvas and hand the hex back to
  // the armed ColorField. Maps the click from displayed CSS pixels to the
  // canvas's full backing resolution.
  const handleCanvasPick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!pickActive || !canvas) return
    const rect = canvas.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    const x = Math.floor((e.clientX - rect.left) * (canvas.width / rect.width))
    const y = Math.floor((e.clientY - rect.top) * (canvas.height / rect.height))
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    try {
      const px = Math.min(canvas.width - 1, Math.max(0, x))
      const py = Math.min(canvas.height - 1, Math.max(0, y))
      const [r, g, b] = ctx.getImageData(px, py, 1, 1).data
      const hex = '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')
      sampleColor(hex)
    } catch {
      // Reading pixels can throw if the canvas is tainted; cancel quietly.
      cancelPick()
    }
  }, [pickActive, sampleColor, cancelPick])

  // Esc cancels an armed eyedropper.
  useEffect(() => {
    if (!pickActive) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') cancelPick() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pickActive, cancelPick])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const renderIdRef = useRef(0)

  useImperativeHandle(ref, () => ({
    toBlob: (callback, type = 'image/png') => {
      if (canvasRef.current) {
        canvasRef.current.toBlob(callback, type)
      } else {
        callback(null)
      }
    },
  }))

  const runRender = useCallback(async (cfg: RenderConfig) => {
    const id = ++renderIdRef.current

    // Always render so the chosen format and background (solid color or image)
    // show even before any text is entered. The pipeline draws the background
    // and simply omits text when content/captions are empty.
    setRenderState('loading')

    try {
      const assets = await resolveAssets(cfg)
      if (id !== renderIdRef.current) return // stale

      const canvas = canvasRef.current
      if (!canvas) return

      canvas.width = cfg.sizeFormat.width
      canvas.height = cfg.sizeFormat.height

      render(cfg, canvas, assets)
      syncBgAvgColor(cfg, assets.bgImage)

      // Compute fit %
      if (containerRef.current) {
        const containerW = containerRef.current.clientWidth
        const containerH = containerRef.current.clientHeight
        const scaleW = containerW / cfg.sizeFormat.width
        const scaleH = containerH / cfg.sizeFormat.height
        const scale = Math.min(scaleW, scaleH, 1)
        setFitPct(Math.round(scale * 100))
      }

      if (id !== renderIdRef.current) return
      setRenderState('ok')
    } catch (err) {
      if (id !== renderIdRef.current) return
      setRenderError(err instanceof Error ? err.message : String(err))
      setRenderState('error')
    }
  }, [])

  // Re-render when uploaded fonts rehydrate from IndexedDB so a persisted
  // uploaded-font selection resolves instead of falling back.
  const uploadedFonts = useUploadedFonts((s) => s.fonts)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      runRender(config)
    }, 150)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [config, runRender, uploadedFonts])

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col items-center justify-center w-full h-full"
      style={{ background: '#0e0f11', padding: '24px' }}
    >
      {/* Loading bar */}
      {renderState === 'loading' && (
        <div
          className="absolute top-0 left-0 right-0 z-10"
          style={{ height: '2px', background: '#f4a92c' }}
          role="progressbar"
          aria-label="Rendering..."
        />
      )}

      {/* Eyedropper hint */}
      {pickActive && (
        <div
          className="absolute top-2 left-1/2 z-10 px-3 py-1.5 rounded text-xs font-medium"
          style={{ transform: 'translateX(-50%)', background: '#f4a92c', color: '#0e0f11', fontFamily: 'var(--font-ui)' }}
          role="status"
        >
          Click the preview to pick a color (Esc to cancel)
        </div>
      )}

      {/* Canvas area: bounded box the canvas fits inside, preserving aspect. */}
      <div className="relative flex-1 min-h-0 w-full flex items-center justify-center">
        <canvas
          ref={canvasRef}
          onClick={handleCanvasPick}
          aria-label={`Preview: ${config.text.content || 'empty'} in ${config.sizeFormat.name} format`}
          style={{
            cursor: pickActive ? 'crosshair' : 'default',
            // Intrinsic dimensions (canvas width/height attributes) drive size;
            // max-width/height fit it within the area while preserving aspect.
            // This is robust to short/wide stages, unlike an explicit-width frame.
            display: renderState === 'ok' ? 'block' : 'none',
            maxWidth: '100%',
            maxHeight: '100%',
            width: 'auto',
            height: 'auto',
            border: '1px solid #3a4048',
            borderRadius: '2px',
            // Checkerboard shows through wherever the canvas is transparent.
            ...CHECKERBOARD,
            // Preview is downscaled (backing is full format resolution); smooth
            // scaling avoids jagged edges. Export uses full resolution.
            imageRendering: 'auto',
          }}
        />

        <span className="sr-only" aria-live="polite">
          {renderState === 'ok' ? `Rendered: ${config.text.content}` : ''}
        </span>

        {renderState === 'error' && (
          <div className="flex flex-col items-center justify-center gap-2 p-4" role="alert" aria-live="assertive">
            <div style={{ border: '1px solid #e5564b', borderRadius: '8px', padding: '16px', textAlign: 'center', background: '#1e2126', maxWidth: '280px' }}>
              <p style={{ color: '#e5564b', fontSize: '13px', fontFamily: 'var(--font-ui)', margin: '0 0 8px 0', fontWeight: 600 }}>
                Render failed
              </p>
              <p style={{ color: '#9ca3af', fontSize: '12px', fontFamily: 'var(--font-ui)', margin: 0 }}>
                {renderError}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Status footer */}
      <div
        className="flex items-center gap-3 mt-2 flex-shrink-0"
        style={{ fontSize: '11px', color: '#6b7280', fontFamily: 'var(--font-mono)' }}
      >
        <span>{config.sizeFormat.name} {config.sizeFormat.width}&times;{config.sizeFormat.height}</span>
        {renderState === 'ok' && fitPct < 100 && (
          <>
            <span aria-hidden="true">·</span>
            <span>fit {fitPct}%</span>
          </>
        )}
      </div>
    </div>
  )
})
