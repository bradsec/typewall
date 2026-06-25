import { useState, useRef, useEffect } from 'react'
import type { AssetEntry } from '../../assets/manifest'
import type { AssetRef } from '../../engine/types'
import { resolveAssetUrl, registerUploadedImage } from '../../state/assets'

interface AssetPickerProps {
  label: string
  value: AssetRef | undefined
  assets: AssetEntry[]
  onChange: (ref: AssetRef | undefined) => void
  disabled?: boolean
  allowNone?: boolean
}

export function AssetPicker({ label, value, assets, onChange, disabled = false, allowNone = true }: AssetPickerProps) {
  const [open, setOpen] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const current = value ? assets.find((a) => a.id === value.id) : undefined

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setUploadError('Image could not be loaded (unsupported format)')
      return
    }
    try {
      const ref = await registerUploadedImage(file)
      onChange(ref)
      setOpen(false)
      setUploadError(null)
    } catch {
      setUploadError('Image could not be loaded (max 4096px)')
    }
    // reset so same file can be selected again
    if (fileRef.current) fileRef.current.value = ''
  }

  const labelId = `assetpicker-label-${label.toLowerCase().replace(/\s+/g, '-')}`

  return (
    <div ref={containerRef} className="relative flex flex-col gap-1">
      <label
        id={labelId}
        className="text-xs font-semibold uppercase tracking-wider"
        style={{ color: disabled ? '#6b7280' : '#9ca3af', fontFamily: 'var(--font-ui)', letterSpacing: '0.06em' }}
      >
        {label}
      </label>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-labelledby={labelId}
        className="flex items-center gap-2 px-3 py-2 rounded text-left"
        style={{
          background: '#1e2126',
          border: '1px solid #3a4048',
          borderRadius: '4px',
          color: disabled ? '#6b7280' : '#e6e8eb',
          cursor: disabled ? 'not-allowed' : 'pointer',
          minHeight: '36px',
          fontSize: '13px',
          fontFamily: 'var(--font-ui)',
        }}
      >
        {current ? (
          <>
            <img
              src={resolveAssetUrl(current.url)}
              alt=""
              aria-hidden="true"
              className="object-cover rounded flex-shrink-0"
              style={{ width: '24px', height: '24px', borderRadius: '3px' }}
            />
            <span className="truncate">{current.name}</span>
          </>
        ) : (
          <span style={{ color: '#6b7280' }}>None selected</span>
        )}
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" style={{ marginLeft: 'auto', flexShrink: 0, color: '#6b7280' }}>
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {uploadError && (
        <p className="text-xs" style={{ color: '#e5564b' }}>{uploadError}</p>
      )}

      {open && (
        <div
          role="dialog"
          aria-label={`Choose ${label}`}
          className="absolute z-50 rounded overflow-hidden"
          style={{
            top: '100%',
            left: 0,
            right: 0,
            background: '#1e2126',
            border: '1px solid #2a2e34',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            maxHeight: '280px',
            overflowY: 'auto',
            padding: '8px',
          }}
        >
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))' }}
          >
            {allowNone && (
              <button
                type="button"
                onClick={() => { onChange(undefined); setOpen(false) }}
                aria-label="No image"
                className="flex flex-col items-center justify-center gap-1 rounded"
                style={{
                  background: !value ? 'rgba(244,169,44,0.14)' : '#16181b',
                  border: !value ? '2px solid #f4a92c' : '1px solid #2a2e34',
                  borderRadius: '4px',
                  aspectRatio: '1',
                  minHeight: '64px',
                  cursor: 'pointer',
                  color: '#9ca3af',
                  fontSize: '11px',
                }}
              >
                <span style={{ fontSize: '18px' }}>+</span>
                <span>None</span>
              </button>
            )}
            {assets.map((entry) => {
              const isSelected = value?.id === entry.id
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => { onChange({ id: entry.id, kind: 'bundled' }); setOpen(false) }}
                  aria-label={entry.name}
                  aria-pressed={isSelected}
                  className="relative rounded overflow-hidden"
                  style={{
                    border: isSelected ? '2px solid #f4a92c' : '1px solid transparent',
                    borderRadius: '4px',
                    aspectRatio: '1',
                    minHeight: '64px',
                    cursor: 'pointer',
                    padding: 0,
                    background: '#16181b',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.02)' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)' }}
                >
                  <img
                    src={resolveAssetUrl(entry.url)}
                    alt={entry.name}
                    className="w-full h-full object-cover"
                  />
                  {isSelected && (
                    <div className="absolute top-1 right-1" style={{ background: '#f4a92c', borderRadius: '50%', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                        <path d="M2 5l2 2 4-4" stroke="#0e0f11" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  )}
                </button>
              )
            })}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              aria-label="Upload image"
              className="flex flex-col items-center justify-center gap-1 rounded"
              style={{
                background: '#16181b',
                border: '1px dashed #3a4048',
                borderRadius: '4px',
                aspectRatio: '1',
                minHeight: '64px',
                cursor: 'pointer',
                color: '#6b7280',
                fontSize: '11px',
              }}
            >
              <span style={{ fontSize: '18px' }}>+</span>
              <span>Upload</span>
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={handleUpload}
            aria-label="Upload image file"
          />
        </div>
      )}
    </div>
  )
}
