import { useState } from 'react'
import { useStore } from '../../state/store'
import { shuffle, type ShuffleDimension } from '../../shuffle/shuffle'
import { manifest } from '../../assets/manifest'
import { VIBE_PRESETS, getVibeBias } from '../../shuffle/presets'
import { effectiveBackgroundColor } from '../../shuffle/contrast'

const DIMENSIONS: ShuffleDimension[] = ['layout', 'fonts', 'scale', 'effects', 'color']
const DIM_LABELS: Record<ShuffleDimension, string> = {
  layout: 'Layout',
  fonts: 'Fonts',
  scale: 'Scale',
  effects: 'Effects',
  color: 'Color',
}

const DEFAULT_PALETTE = [
  '#ffffff', '#000000', '#f4a92c', '#e5564b', '#3fb67a',
  '#ff6b35', '#4ecdc4', '#a8dadc', '#f7dc6f', '#bb8fce',
]

interface ShuffleBarProps {
  onExport: () => void
}

function LockIcon({ locked }: { locked: boolean }) {
  return locked ? (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <rect x="2" y="5" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 5V3.5a2 2 0 0 1 4 0V5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ) : (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <rect x="2" y="5" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 5V3.5a2 2 0 0 1 4 0V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function ShuffleBar({ onExport }: ShuffleBarProps) {
  const config = useStore((s) => s.config)
  const locks = useStore((s) => s.locks)
  const setConfig = useStore((s) => s.setConfig)
  const setLocks = useStore((s) => s.setLocks)
  const reset = useStore((s) => s.reset)

  const memeEnabled = useStore((s) => s.config.text.meme?.enabled ?? false)
  const setMeme = useStore((s) => s.setMeme)
  const activeVibe = useStore((s) => s.activeVibe)
  const setActiveVibe = useStore((s) => s.setActiveVibe)
  const bgAvgColor = useStore((s) => s.bgAvgColor)

  const [diceRotate, setDiceRotate] = useState(false)
  const [fontMix, setFontMix] = useState(false)

  function toggleLock(dim: ShuffleDimension) {
    setLocks({ ...locks, [dim]: !locks[dim] })
  }

  function handleShuffle() {
    setDiceRotate(true)
    setTimeout(() => setDiceRotate(false), 200)

    const nextSeed = (config.seed + 1) & 0xffffff

    const fontRefs = manifest.fonts.map((f) => ({ id: f.id, kind: 'bundled' as const }))

    // Use the cached image-average only when it still matches the current
    // background image; otherwise let effectiveBackgroundColor fall back.
    const imageAvg =
      bgAvgColor && bgAvgColor.id === config.background.image.assetRef?.id
        ? bgAvgColor.color
        : undefined

    const newConfig = shuffle(config, locks, nextSeed, {
      palette: DEFAULT_PALETTE,
      fontRefs,
      fontMix,
      bias: getVibeBias(activeVibe),
      backgroundColor: effectiveBackgroundColor(config.background, imageAvg),
    })

    setConfig(newConfig)
  }

  function handleReset() {
    if (window.confirm('Reset all settings and clear the canvas? This cannot be undone.')) {
      reset()
    }
  }

  return (
    <div
      className="flex items-center gap-3 px-4 flex-wrap py-2"
      style={{
        background: '#16181b',
        borderBottom: '1px solid #2a2e34',
        minHeight: '48px',
      }}
    >
      <span
        className="font-semibold uppercase tracking-wider flex-shrink-0"
        style={{ fontSize: '11px', color: '#6b7280', fontFamily: 'var(--font-display)', letterSpacing: '0.06em' }}
      >
        SHUFFLE
      </span>

      <label className="flex items-center gap-1.5 text-xs font-medium flex-shrink-0" style={{ color: '#9ca3af', fontFamily: 'var(--font-ui)' }}>
        <span>Vibe</span>
        <select
          value={activeVibe}
          onChange={(e) => setActiveVibe(e.target.value)}
          aria-label="Vibe preset"
          style={{
            background: '#1e2126', color: '#e6e8eb', border: '1px solid #3a4048',
            borderRadius: '6px', padding: '4px 6px', fontSize: '12px', cursor: 'pointer',
            fontFamily: 'var(--font-ui)', minHeight: '28px',
          }}
        >
          <option value="none">None</option>
          {VIBE_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
      </label>

      {/* Lock chips */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {DIMENSIONS.map((dim) => {
          const locked = locks[dim]
          return (
            <button
              key={dim}
              type="button"
              aria-pressed={locked}
              aria-label={`${locked ? 'Unlock' : 'Lock'} ${DIM_LABELS[dim]}`}
              onClick={() => toggleLock(dim)}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium"
              style={{
                background: locked ? 'rgba(244,169,44,0.14)' : 'transparent',
                border: `1px solid ${locked ? '#f4a92c' : '#3a4048'}`,
                borderRadius: '4px',
                color: locked ? '#f4a92c' : '#9ca3af',
                cursor: 'pointer',
                fontFamily: 'var(--font-ui)',
                minHeight: '28px',
                transition: 'background 120ms ease, border-color 120ms ease, color 120ms ease',
              }}
            >
              <LockIcon locked={locked} />
              <span>{DIM_LABELS[dim]}</span>
            </button>
          )
        })}
      </div>

      {/* Font mix toggle — enables per-line font mixing when Fonts is unlocked */}
      <label
        className="flex items-center gap-1.5 text-xs font-medium flex-shrink-0"
        style={{ color: fontMix ? '#f4a92c' : '#9ca3af', fontFamily: 'var(--font-ui)', cursor: 'pointer', userSelect: 'none' }}
      >
        <input
          type="checkbox"
          checked={fontMix}
          onChange={(e) => setFontMix(e.target.checked)}
          aria-label="Mix fonts per line"
          className="rounded"
          style={{ accentColor: '#f4a92c', width: '14px', height: '14px', cursor: 'pointer' }}
        />
        <span>Mix fonts</span>
      </label>

      {/* Meme mode toggle */}
      <label
        className="flex items-center gap-1.5 text-xs font-medium flex-shrink-0"
        style={{ color: memeEnabled ? '#f4a92c' : '#9ca3af', fontFamily: 'var(--font-ui)', cursor: 'pointer', userSelect: 'none' }}
      >
        <input
          type="checkbox"
          checked={memeEnabled}
          onChange={(e) => setMeme(e.target.checked)}
          aria-label="Meme mode"
          className="rounded"
          style={{ accentColor: '#f4a92c', width: '14px', height: '14px', cursor: 'pointer' }}
        />
        <span>Meme</span>
      </label>

      {/* Shuffle button */}
      <button
        type="button"
        onClick={handleShuffle}
        aria-label="Remix unlocked dimensions"
        className="flex items-center gap-2 px-4 py-1.5 rounded font-semibold text-sm flex-shrink-0"
        style={{
          background: '#f4a92c',
          color: '#0e0f11',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          fontFamily: 'var(--font-ui)',
          minHeight: '32px',
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          aria-hidden="true"
          style={{ transform: diceRotate ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 180ms ease' }}
        >
          <rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="4.5" cy="4.5" r="1" fill="currentColor" />
          <circle cx="9.5" cy="9.5" r="1" fill="currentColor" />
          <circle cx="9.5" cy="4.5" r="1" fill="currentColor" />
          <circle cx="4.5" cy="9.5" r="1" fill="currentColor" />
        </svg>
        <span>Remix</span>
      </button>

      {/* Reset + Export - pushed right on lg+; wrap below on small screens */}
      <div className="hidden lg:block lg:flex-1" />
      <button
        type="button"
        onClick={handleReset}
        aria-label="Reset all settings and clear the canvas"
        title="Reset all settings"
        className="flex items-center gap-2 px-3 py-1.5 rounded font-semibold text-sm flex-shrink-0"
        style={{
          background: 'transparent',
          color: '#9ca3af',
          border: '1px solid #3a4048',
          borderRadius: '8px',
          cursor: 'pointer',
          fontFamily: 'var(--font-ui)',
          minHeight: '32px',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M11.5 5A5 5 0 1 0 12 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M12 1.5V5H8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="hidden sm:inline">Reset</span>
      </button>
      <button
        type="button"
        onClick={onExport}
        aria-label="Export PNG"
        className="flex items-center gap-2 px-4 py-1.5 rounded font-semibold text-sm flex-shrink-0"
        style={{
          background: '#1e2126',
          color: '#e6e8eb',
          border: '1px solid #3a4048',
          borderRadius: '8px',
          cursor: 'pointer',
          fontFamily: 'var(--font-ui)',
          minHeight: '32px',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M7 1v8M4 6l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M1 10v2a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span className="hidden sm:inline">Export PNG</span>
      </button>
    </div>
  )
}
