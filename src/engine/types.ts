export type Alignment = 'left' | 'center' | 'right'
export type WatermarkPosition =
  | 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right'
  | 'top-middle' | 'bottom-middle' | 'left-middle' | 'right-middle'

export interface ShadowConfig {
  enabled: boolean
  color: string
  offsetX: number
  offsetY: number
  opacity: number
}

export interface OutlineConfig {
  enabled: boolean
  color: string
  ratio: number
}

export interface SprayPaintConfig {
  enabled: boolean
  overflow: number
  // Edge/letter warping amount (0-100). 0 keeps the original edge-only
  // displacement; higher values warp the whole letter for a melted, distorted
  // look. Optional so configs persisted before this field still load.
  distort?: number
}

export interface MemeConfig {
  enabled: boolean
  style: 'overlay' | 'bars'
  topText: string
  bottomText: string
  // Remix-controlled caption size factor (0-1) applied to the caption height
  // budget so single-word captions can shrink. undefined/1 = full size.
  captionScale?: number
}

export interface TextConfig {
  content: string
  baseFontSize: number
  color: string
  opacity: number
  blockText: boolean
  randomLineSlant: boolean
  lineSpacingPct: number
  paddingPctWidth: number
  paddingPctHeight: number
  alignment: Alignment
  shadow: ShadowConfig
  outline: OutlineConfig
  sprayPaint: SprayPaintConfig
  perLineFonts?: string[]
  // Tracking: extra space between glyphs, normalized to font px
  // (px = letterSpacingPct * fontPx). Clamped to [-0.05, 0.4] by callers.
  // Optional so configs persisted before this field still load.
  letterSpacingPct?: number
  // Optional shuffle-controlled line count. When set (and the text has no
  // manual // or newline breaks), the text is balanced across this many lines
  // instead of greedy width-wrapping. undefined = automatic wrapping.
  targetLines?: number
  meme?: MemeConfig
}

export interface AssetRef {
  id: string
  kind: 'bundled' | 'uploaded'
}

export interface SizeFormat {
  name: string
  width: number
  height: number
}

export interface BackgroundConfig {
  color: string
  transparent: boolean
  image: {
    enabled: boolean
    assetRef?: AssetRef
    opacity: number
    blurFactor: number
    // How the image is mapped onto the canvas:
    // cover = fill canvas, crop overflow (preserves aspect);
    // contain = fit whole image, letterbox (preserves aspect);
    // fill = stretch to canvas (may distort).
    fit: BackgroundFit
  }
}

export type BackgroundFit = 'cover' | 'contain' | 'fill'

export interface OverlayConfig {
  image: {
    enabled: boolean
    assetRef?: AssetRef
    opacity: number
    fit: BackgroundFit
  }
  textMask: {
    enabled: boolean
    assetRef?: AssetRef
    fit: BackgroundFit
    // Cut strength (0-255). Scales how strongly bright mask pixels remove text.
    opacity: number
  }
}

export interface WatermarkConfig {
  enabled: boolean
  assetRef?: AssetRef
  position: WatermarkPosition
  scaleFactor: number
  paddingPct: number
  opacity: number
  formatOverrides: Record<string, Partial<Omit<WatermarkConfig, 'formatOverrides'>>>
}

export interface BorderConfig {
  enabled: boolean
  color: string
  // Border thickness in canvas pixels, drawn inset along the canvas edges.
  width: number
}

export interface RenderConfig {
  sizeFormat: SizeFormat
  text: TextConfig
  background: BackgroundConfig
  overlay: OverlayConfig
  watermark: WatermarkConfig
  border: BorderConfig
  fontRef: AssetRef
  seed: number
}

// Default values mirror the original Python CLI config (authoritative over Python dataclass defaults where
// they differ). Shadow offsets are stored post-normalization (raw yaml -3/3 / 1000 = -0.003/0.003).
// Outline ratio stored post-normalization (raw yaml 1.5 / 100 = 0.015).
export function defaultConfig(): RenderConfig {
  return {
    sizeFormat: { name: 'portrait', width: 1080, height: 1350 },
    text: {
      content: '',
      baseFontSize: 48,
      color: '#ffffff',
      opacity: 255,
      blockText: true,
      randomLineSlant: true,
      lineSpacingPct: 0.0125,
      paddingPctWidth: 0.12,
      paddingPctHeight: 0.18,
      alignment: 'center',
      letterSpacingPct: 0,
      shadow: {
        enabled: false,
        color: '#666666',
        offsetX: -0.003,
        offsetY: 0.003,
        opacity: 255,
      },
      outline: {
        enabled: false,
        color: '#333333',
        ratio: 0.015,
      },
      sprayPaint: {
        enabled: false,
        overflow: 15,
        distort: 0,
      },
      meme: { enabled: false, style: 'overlay', topText: '', bottomText: '', captionScale: 1 },
    },
    background: {
      color: '#000000',
      transparent: false,
      image: {
        enabled: false,
        opacity: 240,
        blurFactor: 0,
        fit: 'cover',
      },
    },
    overlay: {
      image: {
        enabled: false,
        opacity: 100,
        fit: 'cover',
      },
      textMask: {
        enabled: false,
        fit: 'cover',
        opacity: 255,
      },
    },
    watermark: {
      enabled: false,
      position: 'bottom-middle',
      scaleFactor: 0.14,
      paddingPct: 0.06,
      opacity: 255,
      formatOverrides: {},
    },
    border: {
      enabled: false,
      color: '#ffffff',
      width: 16,
    },
    fontRef: { id: 'fonts/Anton.ttf', kind: 'bundled' },
    seed: 0,
  }
}
