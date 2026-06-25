import { useStore } from '../../state/store'
import { manifest } from '../../assets/manifest'
import { Section } from '../components/Section'
import { Slider } from '../components/Slider'
import { ColorField } from '../components/ColorField'
import { Toggle } from '../components/Toggle'
import { FontPicker } from '../components/FontPicker'
import { ImageUploadField } from '../components/ImageUploadField'
import { FitSelector } from '../components/FitSelector'
import { TextContentField } from '../components/TextContentField'
import { useUploadedFonts } from '../../state/uploaded-fonts'
import type { Alignment, WatermarkPosition } from '../../engine/types'
import { SIZE_FORMATS } from '../../assets/formats'

const ALIGNMENTS: Alignment[] = ['left', 'center', 'right']
const ALIGN_LABELS: Record<Alignment, string> = { left: 'L', center: 'C', right: 'R' }
const BG_MODES = ['solid', 'transparent', 'image'] as const
type BgMode = typeof BG_MODES[number]

const WM_GRID: Array<WatermarkPosition | null> = [
  'top-left', 'top-middle', 'top-right',
  'left-middle', null, 'right-middle',
  'bottom-left', 'bottom-middle', 'bottom-right',
]
const WM_LABELS: Record<WatermarkPosition, string> = {
  'top-left': 'TL', 'top-middle': 'TC', 'top-right': 'TR',
  'left-middle': 'ML', 'right-middle': 'MR',
  'bottom-left': 'BL', 'bottom-middle': 'BC', 'bottom-right': 'BR',
}

function pctFmt(v: number) { return `${(v * 100).toFixed(1)}%` }
function numFmt(v: number) { return String(v) }

export function ControlPanel() {
  const config = useStore((s) => s.config)
  const patchText = useStore((s) => s.patchText)
  const patchBackground = useStore((s) => s.patchBackground)
  const patchOverlay = useStore((s) => s.patchOverlay)
  const patchWatermark = useStore((s) => s.patchWatermark)
  const patchShadow = useStore((s) => s.patchShadow)
  const patchOutline = useStore((s) => s.patchOutline)
  const patchSprayPaint = useStore((s) => s.patchSprayPaint)
  const patchConfig = useStore((s) => s.patchConfig)
  const uploadedFonts = useUploadedFonts((s) => s.fonts)

  const { text, background, overlay, watermark } = config
  const meme = text.meme ?? { enabled: false, style: 'overlay' as const, topText: '', bottomText: '' }
  const border = config.border ?? { enabled: false, color: '#ffffff', width: 16 }

  // Background mode derived value
  function getBgMode(): BgMode {
    if (background.transparent) return 'transparent'
    if (background.image.enabled) return 'image'
    return 'solid'
  }

  function setBgMode(mode: BgMode) {
    if (mode === 'transparent') {
      patchBackground({ transparent: true, image: { ...background.image, enabled: false } })
    } else if (mode === 'image') {
      patchBackground({ transparent: false, image: { ...background.image, enabled: true } })
    } else {
      patchBackground({ transparent: false, image: { ...background.image, enabled: false } })
    }
  }

  const bgMode = getBgMode()

  // Effects summary for collapsed display
  const effectsSummary = [
    text.sprayPaint.enabled ? `Spray ${text.sprayPaint.overflow}` : null,
    text.shadow.enabled ? 'Shadow on' : null,
    text.outline.enabled ? 'Outline on' : null,
  ].filter(Boolean).join(', ') || undefined

  return (
    <div className="flex flex-col" style={{ background: '#16181b' }}>
      {/* CONTENT */}
      <Section title="CONTENT" defaultOpen storageKey="content">
        {!meme.enabled && (
          <div className="flex flex-col gap-1">
            <label
              htmlFor="text-content"
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: '#9ca3af', fontFamily: 'var(--font-ui)', letterSpacing: '0.06em', fontSize: '11px' }}
            >
              Text
            </label>
            <TextContentField
              value={text.content}
              onChange={(content) => patchText({ content })}
            />
          </div>
        )}

        {meme.enabled && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: '#9ca3af', fontFamily: 'var(--font-ui)', letterSpacing: '0.06em', fontSize: '11px' }}>
                Meme style
              </span>
              <div role="group" aria-label="Meme style" className="flex rounded overflow-hidden"
                style={{ border: '1px solid #2a2e34', borderRadius: '4px' }}>
                {(['overlay', 'bars'] as const).map((s, idx) => {
                  const selected = meme.style === s
                  return (
                    <button key={s} type="button" aria-pressed={selected}
                      onClick={() => patchText({ meme: { ...meme, style: s } })}
                      className="flex-1 py-1.5 text-xs font-medium capitalize"
                      style={{
                        background: selected ? 'rgba(244,169,44,0.14)' : '#1e2126',
                        color: selected ? '#e6e8eb' : '#9ca3af',
                        border: selected ? '1px solid #f4a92c' : '1px solid transparent',
                        cursor: 'pointer',
                        borderRadius: idx === 0 ? '3px 0 0 3px' : '0 3px 3px 0',
                      }}>
                      {s}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="meme-top" className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: '#9ca3af', fontFamily: 'var(--font-ui)', letterSpacing: '0.06em', fontSize: '11px' }}>
                Top caption
              </label>
              <input id="meme-top" type="text" value={meme.topText}
                onChange={(e) => patchText({ meme: { ...meme, topText: e.target.value } })}
                className="w-full px-3 py-2 text-sm rounded"
                style={{ background: '#1e2126', border: '1px solid #3a4048', borderRadius: '4px', color: '#e6e8eb', fontFamily: 'var(--font-ui)' }} />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="meme-bottom" className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: '#9ca3af', fontFamily: 'var(--font-ui)', letterSpacing: '0.06em', fontSize: '11px' }}>
                Bottom caption
              </label>
              <input id="meme-bottom" type="text" value={meme.bottomText}
                onChange={(e) => patchText({ meme: { ...meme, bottomText: e.target.value } })}
                className="w-full px-3 py-2 text-sm rounded"
                style={{ background: '#1e2126', border: '1px solid #3a4048', borderRadius: '4px', color: '#e6e8eb', fontFamily: 'var(--font-ui)' }} />
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label
            htmlFor="format-select"
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: '#9ca3af', fontFamily: 'var(--font-ui)', letterSpacing: '0.06em', fontSize: '11px' }}
          >
            Format
          </label>
          <select
            id="format-select"
            value={config.sizeFormat.name}
            onChange={(e) => {
              const fmt = SIZE_FORMATS.find((f) => f.name === e.target.value)
              if (fmt) patchConfig({ sizeFormat: fmt })
            }}
            className="w-full px-3 py-2 text-sm rounded"
            style={{
              background: '#1e2126',
              border: '1px solid #3a4048',
              borderRadius: '4px',
              color: '#e6e8eb',
              fontFamily: 'var(--font-ui)',
              appearance: 'none',
              cursor: 'pointer',
            }}
          >
            {SIZE_FORMATS.map((f) => (
              <option key={f.name} value={f.name}>
                {f.name} {f.width}&times;{f.height}
              </option>
            ))}
          </select>
        </div>
      </Section>

      {/* TYPE */}
      <Section title="TYPE" defaultOpen storageKey="type">
        <FontPicker
          label="Font"
          value={config.fontRef}
          fonts={[...manifest.fonts, ...uploadedFonts]}
          onChange={(ref) => patchConfig({ fontRef: ref })}
        />

        <ColorField
          id="text-color"
          label="Color"
          value={text.color}
          onChange={(c) => patchText({ color: c })}
        />

        <Slider
          id="text-opacity"
          label="Opacity"
          min={0}
          max={255}
          step={1}
          value={text.opacity}
          onChange={(v) => patchText({ opacity: v })}
          format={(v) => `${Math.round((v / 255) * 100)}%`}
        />

        {/* Alignment */}
        <div className="flex flex-col gap-1">
          <span
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: '#9ca3af', fontFamily: 'var(--font-ui)', letterSpacing: '0.06em', fontSize: '11px' }}
          >
            Alignment
          </span>
          <div
            role="group"
            aria-label="Text alignment"
            className="flex rounded overflow-hidden"
            style={{ border: '1px solid #2a2e34', borderRadius: '4px' }}
          >
            {ALIGNMENTS.map((a, idx) => {
              const selected = text.alignment === a
              return (
                <button
                  key={a}
                  type="button"
                  aria-pressed={selected}
                  aria-label={`Align ${a}`}
                  onClick={() => patchText({ alignment: a })}
                  className="flex-1 py-1.5 text-xs font-medium"
                  style={{
                    background: selected ? 'rgba(244,169,44,0.14)' : '#1e2126',
                    color: selected ? '#e6e8eb' : '#9ca3af',
                    border: selected ? '1px solid #f4a92c' : '1px solid transparent',
                    fontWeight: selected ? 600 : 500,
                    cursor: 'pointer',
                    borderRadius: idx === 0 ? '3px 0 0 3px' : idx === 2 ? '0 3px 3px 0' : '0',
                  }}
                >
                  {ALIGN_LABELS[a]}
                </button>
              )
            })}
          </div>
        </div>

        <Toggle id="block-text" label="Block text" checked={text.blockText} onChange={(v) => patchText({ blockText: v })} />
        <Toggle id="random-slant" label="Random slant" checked={text.randomLineSlant} onChange={(v) => patchText({ randomLineSlant: v })} />

        <Slider
          id="line-spacing"
          label="Line spacing"
          min={0}
          max={0.3}
          step={0.005}
          value={text.lineSpacingPct}
          onChange={(v) => patchText({ lineSpacingPct: v })}
          format={pctFmt}
        />

        <Slider
          id="tracking"
          label="Tracking"
          min={-0.05}
          max={0.4}
          step={0.01}
          value={text.letterSpacingPct ?? 0}
          onChange={(v) => patchText({ letterSpacingPct: v })}
          format={pctFmt}
        />

        <Slider
          id="padding-w"
          label="Padding W"
          min={0}
          max={0.4}
          step={0.01}
          value={text.paddingPctWidth}
          onChange={(v) => patchText({ paddingPctWidth: v })}
          format={pctFmt}
        />

        <Slider
          id="padding-h"
          label="Padding H"
          min={0}
          max={0.4}
          step={0.01}
          value={text.paddingPctHeight}
          onChange={(v) => patchText({ paddingPctHeight: v })}
          format={pctFmt}
        />

        <Slider
          id="base-font-size"
          label="Base font size"
          min={8}
          max={200}
          step={1}
          value={text.baseFontSize}
          onChange={(v) => patchText({ baseFontSize: v })}
          format={numFmt}
        />
      </Section>

      {/* EFFECTS */}
      <Section title="EFFECTS" storageKey="effects" summary={effectsSummary}>
        {/* Shadow */}
        <Toggle
          id="shadow-enabled"
          label="Shadow"
          checked={text.shadow.enabled}
          onChange={(v) => patchShadow({ enabled: v })}
        />
        {text.shadow.enabled && (
          <div className="pl-4 flex flex-col gap-4" style={{ borderLeft: '2px solid #2a2e34' }}>
            <ColorField
              id="shadow-color"
              label="Shadow color"
              value={text.shadow.color}
              onChange={(c) => patchShadow({ color: c })}
            />
            <Slider
              id="shadow-offset-x"
              label="Offset X"
              min={-0.05}
              max={0.05}
              step={0.001}
              value={text.shadow.offsetX}
              onChange={(v) => patchShadow({ offsetX: v })}
              format={(v) => v.toFixed(3)}
            />
            <Slider
              id="shadow-offset-y"
              label="Offset Y"
              min={-0.05}
              max={0.05}
              step={0.001}
              value={text.shadow.offsetY}
              onChange={(v) => patchShadow({ offsetY: v })}
              format={(v) => v.toFixed(3)}
            />
            <Slider
              id="shadow-opacity"
              label="Shadow opacity"
              min={0}
              max={255}
              step={1}
              value={text.shadow.opacity}
              onChange={(v) => patchShadow({ opacity: v })}
              format={(v) => `${Math.round((v / 255) * 100)}%`}
            />
          </div>
        )}

        {/* Outline */}
        <Toggle
          id="outline-enabled"
          label="Outline"
          checked={text.outline.enabled}
          onChange={(v) => patchOutline({ enabled: v })}
        />
        {text.outline.enabled && (
          <div className="pl-4 flex flex-col gap-4" style={{ borderLeft: '2px solid #2a2e34' }}>
            <ColorField
              id="outline-color"
              label="Outline color"
              value={text.outline.color}
              onChange={(c) => patchOutline({ color: c })}
            />
            <Slider
              id="outline-ratio"
              label="Ratio"
              min={0.005}
              max={0.15}
              step={0.001}
              value={text.outline.ratio}
              onChange={(v) => patchOutline({ ratio: v })}
              format={(v) => v.toFixed(3)}
            />
          </div>
        )}

        {/* Spray paint */}
        <Toggle
          id="spray-enabled"
          label="Spray paint"
          checked={text.sprayPaint.enabled}
          onChange={(v) => patchSprayPaint({ enabled: v })}
        />
        {text.sprayPaint.enabled && (
          <div className="pl-4 flex flex-col gap-4" style={{ borderLeft: '2px solid #2a2e34' }}>
            <Slider
              id="spray-overflow"
              label="Overflow"
              min={0}
              max={25}
              step={1}
              value={text.sprayPaint.overflow}
              onChange={(v) => patchSprayPaint({ overflow: v })}
              format={numFmt}
            />
            <Slider
              id="spray-distort"
              label="Distort"
              min={0}
              max={100}
              step={1}
              value={text.sprayPaint.distort ?? 0}
              onChange={(v) => patchSprayPaint({ distort: v })}
              format={numFmt}
            />
          </div>
        )}
      </Section>

      {/* BACKGROUND */}
      <Section title="BACKGROUND" storageKey="background">
        {/* Mode selector */}
        <div className="flex flex-col gap-1">
          <span
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: '#9ca3af', fontFamily: 'var(--font-ui)', letterSpacing: '0.06em', fontSize: '11px' }}
          >
            Mode
          </span>
          <div
            role="group"
            aria-label="Background mode"
            className="flex rounded overflow-hidden"
            style={{ border: '1px solid #2a2e34', borderRadius: '4px' }}
          >
            {BG_MODES.map((mode, idx) => {
              const selected = bgMode === mode
              return (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setBgMode(mode)}
                  className="flex-1 py-1.5 text-xs font-medium capitalize"
                  style={{
                    background: selected ? 'rgba(244,169,44,0.14)' : '#1e2126',
                    color: selected ? '#e6e8eb' : '#9ca3af',
                    border: selected ? '1px solid #f4a92c' : '1px solid transparent',
                    fontWeight: selected ? 600 : 500,
                    cursor: 'pointer',
                    borderRadius: idx === 0 ? '3px 0 0 3px' : idx === 2 ? '0 3px 3px 0' : '0',
                  }}
                >
                  {mode}
                </button>
              )
            })}
          </div>
        </div>

        {bgMode === 'solid' && (
          <ColorField
            id="bg-color"
            label="Background color"
            value={background.color}
            onChange={(c) => patchBackground({ color: c })}
          />
        )}

        {bgMode === 'image' && (
          <>
            <ImageUploadField
              label="Background image"
              value={background.image.assetRef}
              onChange={(ref) => patchBackground({ image: { ...background.image, assetRef: ref ?? undefined } })}
            />
            <FitSelector
              value={background.image.fit}
              onChange={(fit) => patchBackground({ image: { ...background.image, fit } })}
            />
            <ColorField
              id="bg-image-color"
              label="Background color"
              value={background.color}
              onChange={(c) => patchBackground({ color: c })}
            />
            <Slider
              id="bg-opacity"
              label="Image opacity"
              min={0}
              max={255}
              step={1}
              value={background.image.opacity}
              onChange={(v) => patchBackground({ image: { ...background.image, opacity: v } })}
              format={(v) => `${Math.round((v / 255) * 100)}%`}
            />
            <Slider
              id="bg-blur"
              label="Blur"
              min={0}
              max={20}
              step={0.5}
              value={background.image.blurFactor}
              onChange={(v) => patchBackground({ image: { ...background.image, blurFactor: v } })}
              format={(v) => v.toFixed(1)}
            />
          </>
        )}

        {bgMode === 'transparent' && (
          <p className="text-xs" style={{ color: '#6b7280' }}>
            Background and overlay are skipped for transparent formats.
          </p>
        )}
      </Section>

      {/* OVERLAY & MASK */}
      <Section title="OVERLAY & MASK" storageKey="overlay">
        <Toggle
          id="overlay-enabled"
          label="Overlay image"
          checked={overlay.image.enabled}
          onChange={(v) => patchOverlay({ image: { ...overlay.image, enabled: v } })}
        />
        {overlay.image.enabled && (
          <div className="pl-4 flex flex-col gap-4" style={{ borderLeft: '2px solid #2a2e34' }}>
            <ImageUploadField
              label="Overlay"
              value={overlay.image.assetRef}
              onChange={(ref) => patchOverlay({ image: { ...overlay.image, assetRef: ref ?? undefined } })}
            />
            <FitSelector
              value={overlay.image.fit}
              onChange={(fit) => patchOverlay({ image: { ...overlay.image, fit } })}
            />
            <Slider
              id="overlay-opacity"
              label="Overlay opacity"
              min={0}
              max={255}
              step={1}
              value={overlay.image.opacity}
              onChange={(v) => patchOverlay({ image: { ...overlay.image, opacity: v } })}
              format={(v) => `${Math.round((v / 255) * 100)}%`}
            />
          </div>
        )}

        <Toggle
          id="textmask-enabled"
          label="Text mask"
          checked={overlay.textMask.enabled}
          onChange={(v) => patchOverlay({ textMask: { ...overlay.textMask, enabled: v } })}
        />
        {overlay.textMask.enabled && (
          <div className="pl-4 flex flex-col gap-4" style={{ borderLeft: '2px solid #2a2e34' }}>
            <ImageUploadField
              label="Text mask image"
              value={overlay.textMask.assetRef}
              onChange={(ref) => patchOverlay({ textMask: { ...overlay.textMask, assetRef: ref ?? undefined } })}
            />
            <FitSelector
              value={overlay.textMask.fit}
              onChange={(fit) => patchOverlay({ textMask: { ...overlay.textMask, fit } })}
            />
            <Slider
              id="textmask-opacity"
              label="Mask strength"
              min={0}
              max={255}
              step={1}
              value={overlay.textMask.opacity ?? 255}
              onChange={(v) => patchOverlay({ textMask: { ...overlay.textMask, opacity: v } })}
              format={(v) => `${Math.round((v / 255) * 100)}%`}
            />
          </div>
        )}
      </Section>

      {/* WATERMARK */}
      <Section title="WATERMARK" storageKey="watermark">
        <Toggle
          id="watermark-enabled"
          label="Watermark"
          checked={watermark.enabled}
          onChange={(v) => patchWatermark({ enabled: v })}
        />
        {watermark.enabled && (
          <div className="pl-4 flex flex-col gap-4" style={{ borderLeft: '2px solid #2a2e34' }}>
            <ImageUploadField
              label="Watermark image"
              value={watermark.assetRef}
              onChange={(ref) => patchWatermark({ assetRef: ref ?? undefined })}
            />

            {/* Position grid */}
            <div className="flex flex-col gap-1">
              <span
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: '#9ca3af', fontFamily: 'var(--font-ui)', letterSpacing: '0.06em', fontSize: '11px' }}
              >
                Position
              </span>
              <div
                role="group"
                aria-label="Watermark position"
                style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}
              >
                {WM_GRID.map((pos, idx) => {
                  if (!pos) {
                    return (
                      <div
                        key={`empty-${idx}`}
                        aria-disabled="true"
                        style={{
                          background: '#1e2126',
                          border: '1px solid #2a2e34',
                          borderRadius: '4px',
                          height: '32px',
                          position: 'relative',
                          overflow: 'hidden',
                        }}
                      >
                        <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.3 }}>
                          <line x1="0" y1="0" x2="100%" y2="100%" stroke="#6b7280" strokeWidth="1" />
                        </svg>
                      </div>
                    )
                  }
                  const selected = watermark.position === pos
                  return (
                    <button
                      key={pos}
                      type="button"
                      aria-pressed={selected}
                      aria-label={pos}
                      onClick={() => patchWatermark({ position: pos })}
                      style={{
                        background: selected ? 'rgba(244,169,44,0.14)' : '#1e2126',
                        border: selected ? '1px solid #f4a92c' : '1px solid #2a2e34',
                        borderRadius: '4px',
                        height: '32px',
                        color: selected ? '#f4a92c' : '#9ca3af',
                        fontSize: '10px',
                        fontFamily: 'var(--font-ui)',
                        cursor: 'pointer',
                        fontWeight: selected ? 600 : 500,
                      }}
                    >
                      {WM_LABELS[pos]}
                    </button>
                  )
                })}
              </div>
            </div>

            <Slider
              id="wm-scale"
              label="Scale"
              min={0.05}
              max={0.5}
              step={0.01}
              value={watermark.scaleFactor}
              onChange={(v) => patchWatermark({ scaleFactor: v })}
              format={pctFmt}
            />
            <Slider
              id="wm-padding"
              label="Padding"
              min={0}
              max={0.2}
              step={0.01}
              value={watermark.paddingPct}
              onChange={(v) => patchWatermark({ paddingPct: v })}
              format={pctFmt}
            />
            <Slider
              id="wm-opacity"
              label="Opacity"
              min={0}
              max={255}
              step={1}
              value={watermark.opacity}
              onChange={(v) => patchWatermark({ opacity: v })}
              format={(v) => `${Math.round((v / 255) * 100)}%`}
            />
          </div>
        )}
      </Section>

      {/* BORDER */}
      <Section title="BORDER" storageKey="border">
        <Toggle
          id="border-enabled"
          label="Border"
          checked={border.enabled}
          disabled={meme.enabled}
          onChange={(v) => patchConfig({ border: { ...border, enabled: v } })}
        />
        {meme.enabled && (
          <p className="text-xs" style={{ color: '#6b7280' }}>
            Border is unavailable in meme mode.
          </p>
        )}
        {border.enabled && !meme.enabled && (
          <div className="pl-4 flex flex-col gap-4" style={{ borderLeft: '2px solid #2a2e34' }}>
            <ColorField
              id="border-color"
              label="Border color"
              value={border.color}
              onChange={(c) => patchConfig({ border: { ...border, color: c } })}
            />
            <Slider
              id="border-width"
              label="Thickness"
              min={1}
              max={80}
              step={1}
              value={border.width}
              onChange={(v) => patchConfig({ border: { ...border, width: v } })}
              format={(v) => `${v}px`}
            />
          </div>
        )}
      </Section>
    </div>
  )
}
