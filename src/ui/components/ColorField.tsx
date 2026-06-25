import { useState, useRef, useEffect } from 'react'
import { useEyedropper } from '../../state/eyedropper'

interface ColorFieldProps {
  id: string
  label: string
  value: string
  onChange: (color: string) => void
  disabled?: boolean
}

function isValidHex(s: string): boolean {
  return /^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}$/.test(s)
}

function normalizeHex(s: string): string {
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    return '#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3]
  }
  return s.toLowerCase()
}

export function ColorField({ id, label, value, onChange, disabled = false }: ColorFieldProps) {
  const [draft, setDraft] = useState(value)
  const [error, setError] = useState(false)
  const lastValid = useRef(value)

  useEffect(() => {
    setDraft(value)
    lastValid.current = value
    setError(false)
  }, [value])

  function handleTextChange(v: string) {
    setDraft(v)
    if (isValidHex(v)) {
      const norm = normalizeHex(v)
      setError(false)
      lastValid.current = norm
      onChange(norm)
    } else {
      setError(true)
    }
  }

  function handleBlur() {
    if (!isValidHex(draft)) {
      setDraft(lastValid.current)
      setError(false)
    }
  }

  function applyColor(v: string) {
    const norm = normalizeHex(v)
    setDraft(norm)
    setError(false)
    lastValid.current = norm
    onChange(norm)
  }

  function handleSwatchChange(e: React.ChangeEvent<HTMLInputElement>) {
    applyColor(e.target.value)
  }

  // Canvas eyedropper: arm the shared picker with this field's setter, then the
  // preview samples the next clicked pixel. Works in every browser.
  const beginPick = useEyedropper((s) => s.begin)
  const cancelPick = useEyedropper((s) => s.cancel)
  const pickActive = useEyedropper((s) => s.pick) != null
  const [armedHere, setArmedHere] = useState(false)

  // Clear this field's armed highlight once the pick resolves or is cancelled.
  useEffect(() => {
    if (!pickActive) setArmedHere(false)
  }, [pickActive])

  function toggleEyedropper() {
    if (armedHere) {
      cancelPick()
      setArmedHere(false)
    } else {
      setArmedHere(true)
      beginPick(applyColor)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={`${id}-text`}
        className="text-xs font-semibold uppercase tracking-wider"
        style={{ color: disabled ? '#6b7280' : '#9ca3af', fontFamily: 'var(--font-ui)', letterSpacing: '0.06em' }}
      >
        {label}
      </label>
      <div className="flex items-center gap-2">
        <div className="relative w-7 h-7 rounded flex-shrink-0" style={{ borderRadius: '4px', border: '1px solid #3a4048' }}>
          <input
            id={`${id}-swatch`}
            type="color"
            value={lastValid.current}
            disabled={disabled}
            onChange={handleSwatchChange}
            aria-label={`${label} color swatch`}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
            style={{ borderRadius: '4px' }}
          />
          <div
            className="w-full h-full rounded"
            style={{ backgroundColor: lastValid.current, borderRadius: '4px', pointerEvents: 'none' }}
          />
        </div>
        <input
          id={`${id}-text`}
          type="text"
          value={draft}
          disabled={disabled}
          onChange={(e) => handleTextChange(e.target.value)}
          onBlur={handleBlur}
          maxLength={7}
          aria-label={`${label} hex value`}
          aria-invalid={error}
          aria-describedby={error ? `${id}-error` : undefined}
          className="flex-1 px-2 py-1 text-xs rounded"
          style={{
            fontFamily: 'var(--font-mono)',
            background: '#1e2126',
            color: disabled ? '#6b7280' : '#e6e8eb',
            border: `1px solid ${error ? '#e5564b' : '#3a4048'}`,
            borderRadius: '4px',
          }}
        />
        <button
          type="button"
          onClick={toggleEyedropper}
          disabled={disabled}
          aria-label={`Pick ${label} from the canvas`}
          aria-pressed={armedHere}
          title={armedHere ? 'Click the preview to sample a color (Esc to cancel)' : 'Pick a color from the canvas'}
          className="flex items-center justify-center w-7 h-7 rounded flex-shrink-0 disabled:cursor-not-allowed"
          style={{
            background: armedHere ? 'rgba(244,169,44,0.14)' : '#1e2126',
            border: `1px solid ${armedHere ? '#f4a92c' : '#3a4048'}`,
            borderRadius: '4px',
            color: disabled ? '#6b7280' : armedHere ? '#f4a92c' : '#9ca3af',
            cursor: 'pointer',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M11.5 1.5a2 2 0 0 1 3 3l-1.2 1.2 1 1-1.4 1.4-1-1L6.6 12.4l-3 .9.9-3 5.3-5.3-1-1L10.3 2.7l1 1L11.5 1.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      {error && (
        <p id={`${id}-error`} className="text-xs" style={{ color: '#e5564b' }}>
          Use #RGB or #RRGGBB
        </p>
      )}
    </div>
  )
}
