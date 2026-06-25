import type { CSSProperties } from 'react'

interface ToggleProps {
  id: string
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
}

export function Toggle({ id, label, checked, onChange, disabled = false, className = '' }: ToggleProps) {
  const trackStyle: CSSProperties = {
    backgroundColor: disabled ? '#1e2126' : checked ? '#f4a92c' : '#2a2e34',
    transition: 'background-color 120ms ease',
  }
  const knobStyle: CSSProperties = {
    backgroundColor: disabled ? '#2a2e34' : checked ? '#0e0f11' : '#9ca3af',
    transform: checked ? 'translateX(16px)' : 'translateX(2px)',
    transition: 'transform 120ms ease, background-color 120ms ease',
  }

  return (
    <label
      htmlFor={id}
      className={`flex items-center gap-2 cursor-pointer select-none ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className="relative inline-flex items-center w-9 h-5 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        style={trackStyle}
        type="button"
      >
        <span
          className="inline-block w-4 h-4 rounded-full"
          style={knobStyle}
        />
        <span className="sr-only">{checked ? 'on' : 'off'}</span>
      </button>
      <span className="text-sm font-medium" style={{ color: disabled ? '#6b7280' : '#e6e8eb', fontFamily: 'var(--font-ui)' }}>
        {label}
      </span>
    </label>
  )
}
