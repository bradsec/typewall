import type { BackgroundFit } from '../../engine/types'

interface FitSelectorProps {
  value: BackgroundFit | undefined
  onChange: (fit: BackgroundFit) => void
  label?: string
}

const FITS: BackgroundFit[] = ['cover', 'contain', 'fill']

/**
 * Segmented control for image fit (cover/contain/fill). Used by the background
 * image, overlay image, and text mask. undefined is treated as the default cover.
 */
export function FitSelector({ value, onChange, label = 'Fit' }: FitSelectorProps) {
  return (
    <div className="flex flex-col gap-1">
      <span
        className="text-xs font-semibold uppercase tracking-wider"
        style={{ color: '#9ca3af', fontFamily: 'var(--font-ui)', letterSpacing: '0.06em', fontSize: '11px' }}
      >
        {label}
      </span>
      <div className="flex gap-1" role="group" aria-label={label}>
        {FITS.map((m) => {
          const selected = (value ?? 'cover') === m
          return (
            <button
              key={m}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(m)}
              className="flex-1 py-1.5 text-xs font-medium capitalize"
              style={{
                background: selected ? 'rgba(244,169,44,0.14)' : '#1e2126',
                border: `1px solid ${selected ? '#f4a92c' : '#2a2e34'}`,
                borderRadius: '4px',
                color: selected ? '#f4a92c' : '#9ca3af',
                cursor: 'pointer',
                fontFamily: 'var(--font-ui)',
              }}
            >
              {m}
            </button>
          )
        })}
      </div>
    </div>
  )
}
