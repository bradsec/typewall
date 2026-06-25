import { useRef } from 'react'

interface SliderProps {
  id: string
  label: string
  min: number
  max: number
  step: number
  value: number
  onChange: (value: number) => void
  format?: (v: number) => string
  disabled?: boolean
}

export function Slider({ id, label, min, max, step, value, onChange, format, disabled = false }: SliderProps) {
  const display = format ? format(value) : String(value)
  const pct = max === min ? 0 : ((value - min) / (max - min)) * 100

  // Use a ref to track mousedown for tooltip; omitted for simplicity — value label is always visible.
  const inputRef = useRef<HTMLInputElement>(null)

  const trackBg = disabled
    ? 'linear-gradient(to right, #1e2126 0%, #1e2126 100%)'
    : `linear-gradient(to right, #f4a92c 0%, #f4a92c ${pct}%, #3a4048 ${pct}%, #3a4048 100%)`

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label
          htmlFor={id}
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: disabled ? '#6b7280' : '#9ca3af', fontFamily: 'var(--font-ui)', letterSpacing: '0.06em' }}
        >
          {label}
        </label>
        <span
          className="text-xs"
          style={{ color: disabled ? '#6b7280' : '#e6e8eb', fontFamily: 'var(--font-mono)', minWidth: '3rem', textAlign: 'right' }}
        >
          {display}
        </span>
      </div>
      <input
        ref={inputRef}
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={display}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
        style={{
          background: trackBg,
        }}
      />
    </div>
  )
}
