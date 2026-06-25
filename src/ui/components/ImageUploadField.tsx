import { useRef, useState } from 'react'
import type { AssetRef } from '../../engine/types'
import { registerUploadedImage, resolveUploadedUrl, resolveUploadedName } from '../../state/assets'

interface ImageUploadFieldProps {
  label: string
  value: AssetRef | undefined
  onChange: (ref: AssetRef | undefined) => void
  disabled?: boolean
}

/**
 * Upload-only image control: the user picks a file from disk; no bundled
 * library is shown. The selected image is held in the session upload registry
 * (see state/assets.ts) and resolved by the render path.
 */
export function ImageUploadField({ label, value, onChange, disabled = false }: ImageUploadFieldProps) {
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const previewUrl = value ? resolveUploadedUrl(value) : undefined
  const name = value ? resolveUploadedName(value) ?? 'Selected image' : undefined

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Image could not be loaded (unsupported format)')
      return
    }
    try {
      const ref = await registerUploadedImage(file)
      onChange(ref)
      setError(null)
    } catch {
      setError('Image could not be loaded (max 4096px)')
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  const labelId = `imageupload-label-${label.toLowerCase().replace(/\s+/g, '-')}`

  return (
    <div className="flex flex-col gap-1">
      <span
        id={labelId}
        className="text-xs font-semibold uppercase tracking-wider"
        style={{ color: disabled ? '#6b7280' : '#9ca3af', fontFamily: 'var(--font-ui)', letterSpacing: '0.06em' }}
      >
        {label}
      </span>

      {value && previewUrl ? (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded"
          style={{ background: '#1e2126', border: '1px solid #3a4048', borderRadius: '4px', minHeight: '36px' }}
        >
          <img
            src={previewUrl}
            alt=""
            aria-hidden="true"
            className="object-contain rounded flex-shrink-0"
            style={{ width: '24px', height: '24px', borderRadius: '3px' }}
          />
          <span className="truncate" style={{ color: '#e6e8eb', fontSize: '13px', fontFamily: 'var(--font-ui)' }}>{name}</span>
          <div className="flex items-center gap-2" style={{ marginLeft: 'auto', flexShrink: 0 }}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => fileRef.current?.click()}
              style={{ color: '#9ca3af', fontSize: '12px', fontFamily: 'var(--font-ui)', cursor: disabled ? 'not-allowed' : 'pointer', background: 'none', border: 'none' }}
            >
              Replace
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => { onChange(undefined); setError(null) }}
              aria-label={`Clear ${label}`}
              style={{ color: '#9ca3af', fontSize: '14px', cursor: disabled ? 'not-allowed' : 'pointer', background: 'none', border: 'none', lineHeight: 1 }}
            >
              &times;
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => fileRef.current?.click()}
          aria-labelledby={labelId}
          className="flex items-center gap-2 px-3 py-2 rounded text-left"
          style={{
            background: '#1e2126',
            border: '1px dashed #3a4048',
            borderRadius: '4px',
            color: disabled ? '#6b7280' : '#9ca3af',
            cursor: disabled ? 'not-allowed' : 'pointer',
            minHeight: '36px',
            fontSize: '13px',
            fontFamily: 'var(--font-ui)',
          }}
        >
          <span style={{ fontSize: '16px' }}>+</span>
          <span>Choose file...</span>
        </button>
      )}

      {error && <p className="text-xs" style={{ color: '#e5564b' }}>{error}</p>}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={handleUpload}
        aria-label={`Upload ${label}`}
      />
    </div>
  )
}
