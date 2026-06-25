import { useState, useEffect } from 'react'

interface SectionProps {
  title: string
  summary?: string
  defaultOpen?: boolean
  storageKey?: string
  children: React.ReactNode
}

export function Section({ title, summary, defaultOpen = false, storageKey, children }: SectionProps) {
  const [open, setOpen] = useState(() => {
    if (storageKey) {
      const stored = localStorage.getItem(`section:${storageKey}`)
      if (stored !== null) return stored === 'true'
    }
    return defaultOpen
  })

  useEffect(() => {
    if (storageKey) {
      localStorage.setItem(`section:${storageKey}`, String(open))
    }
  }, [open, storageKey])

  function toggle() {
    setOpen((v) => !v)
  }

  return (
    <div style={{ borderBottom: '1px solid #2a2e34' }}>
      <button
        type="button"
        aria-expanded={open}
        onClick={toggle}
        className="w-full flex items-center justify-between px-4 text-left"
        style={{ height: '46px', background: 'transparent', border: 'none', cursor: 'pointer' }}
      >
        <div className="flex items-center gap-3">
          <span
            className="font-semibold uppercase tracking-wider"
            style={{ fontSize: '11px', lineHeight: '14px', letterSpacing: '0.06em', color: '#e6e8eb', fontFamily: 'var(--font-display)' }}
          >
            {title}
          </span>
          {!open && summary && (
            <span style={{ fontSize: '11px', color: '#6b7280', fontFamily: 'var(--font-ui)' }}>
              {summary}
            </span>
          )}
        </div>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 160ms ease-out', color: '#6b7280', flexShrink: 0 }}
        >
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div
        style={{
          overflow: 'hidden',
          maxHeight: open ? '9999px' : '0',
          opacity: open ? 1 : 0,
          transition: 'max-height 160ms ease-out, opacity 160ms ease-out',
        }}
      >
        <div className="px-4 pt-1 pb-6 flex flex-col gap-5">
          {children}
        </div>
      </div>
    </div>
  )
}
