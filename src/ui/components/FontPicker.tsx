import { useState, useRef, useEffect } from 'react'
import type { AssetEntry } from '../../assets/manifest'
import type { AssetRef } from '../../engine/types'
import { loadFontData, resolveUploadedName, uploadedFontFamily, ensureUploadedFontFace } from '../../state/assets'
import { resolveAssetUrl } from '../../state/assets'
import { useUploadedFonts } from '../../state/uploaded-fonts'

// A font shown in the picker: bundled (from the manifest) or uploaded by the user.
export type PickerFont = { id: string; name: string; url: string; kind: 'bundled' | 'uploaded' }

interface FontPickerProps {
  label: string
  value: AssetRef
  fonts: PickerFont[]
  onChange: (ref: AssetRef) => void
  disabled?: boolean
}

const loadedFonts = new Map<string, 'loading' | 'loaded' | 'error'>()

async function ensureFont(entry: { name: string; url: string }): Promise<void> {
  const familyName = `igfont-${entry.name}`
  if (loadedFonts.get(entry.url) === 'loaded') return
  if (loadedFonts.get(entry.url) === 'loading') return
  loadedFonts.set(entry.url, 'loading')
  try {
    const data = await loadFontData(entry.url)
    const face = new FontFace(familyName, data)
    await face.load()
    document.fonts.add(face)
    loadedFonts.set(entry.url, 'loaded')
  } catch {
    loadedFonts.set(entry.url, 'error')
  }
}

export function FontPicker({ label, value, fonts, onChange, disabled = false }: FontPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [loadStatus, setLoadStatus] = useState<Map<string, string>>(new Map())
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadedFamilyName, setUploadedFamilyName] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const addUploadedFont = useUploadedFonts((s) => s.addFromFile)

  const isUploaded = value.kind === 'uploaded'
  const uploadedName = isUploaded ? resolveUploadedName(value) : undefined
  const current = fonts.find((f) => f.id === value.id) ?? fonts[0]
  const filtered = fonts.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase()),
  )

  useEffect(() => {
    if (open && searchRef.current) {
      searchRef.current.focus()
    }
  }, [open])

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

  async function handleSelect(entry: PickerFont) {
    setOpen(false)
    setSearch('')
    if (entry.kind === 'uploaded') {
      const ref: AssetRef = { id: entry.id, kind: 'uploaded' }
      onChange(ref)
      const family = await ensureUploadedFontFace(ref)
      setUploadedFamilyName(family ?? null)
      return
    }
    onChange({ id: entry.id, kind: 'bundled' })
    if (loadedFonts.get(entry.url) !== 'loaded') {
      setLoadStatus((m) => new Map(m).set(entry.url, 'loading'))
      await ensureFont(entry)
      setLoadStatus((m) => new Map(m).set(entry.url, loadedFonts.get(entry.url) ?? 'error'))
    }
  }

  async function handleUploadFont(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const ref = await addUploadedFont(file)
      const family = await ensureUploadedFontFace(ref)
      setUploadedFamilyName(family ?? null)
      onChange(ref)
      setOpen(false)
      setSearch('')
      setUploadError(null)
    } catch {
      setUploadError('Font could not be loaded (use .ttf, .otf, .woff, or .woff2)')
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  function getFontFamily(entry: PickerFont): string {
    if (entry.kind === 'uploaded') {
      const family = uploadedFontFamily(entry.id)
      return document.fonts.check(`12px "${family}"`) ? family : 'var(--font-ui)'
    }
    return loadedFonts.get(entry.url) === 'loaded' ? `igfont-${entry.name}` : 'var(--font-ui)'
  }

  // Ensure an uploaded font is loaded so the trigger renders in it (e.g. after
  // a preset import where the upload happened in a prior interaction).
  useEffect(() => {
    if (isUploaded) {
      ensureUploadedFontFace(value).then((family) => setUploadedFamilyName(family ?? null))
    }
  }, [isUploaded, value])

  // Load the current bundled font for preview (uploaded handled above).
  useEffect(() => {
    if (current && current.kind === 'bundled') {
      ensureFont(current).then(() => {
        setLoadStatus((m) => new Map(m).set(current.url, loadedFonts.get(current.url) ?? 'error'))
      })
    }
  }, [current])

  // When open, load uploaded fonts so their list rows preview in-face.
  useEffect(() => {
    if (!open) return
    for (const f of fonts) {
      if (f.kind === 'uploaded') {
        ensureUploadedFontFace({ id: f.id, kind: 'uploaded' }).then((fam) => {
          if (fam) setLoadStatus((m) => new Map(m).set(f.url, 'loaded'))
        })
      }
    }
  }, [open, fonts])

  const labelId = `fontpicker-label-${label.toLowerCase().replace(/\s+/g, '-')}`

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
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={labelId}
        className="flex items-center justify-between px-3 py-2 rounded text-left"
        style={{
          background: '#1e2126',
          border: '1px solid #3a4048',
          borderRadius: '4px',
          color: disabled ? '#6b7280' : '#e6e8eb',
          fontFamily: isUploaded ? (uploadedFamilyName ?? 'var(--font-ui)') : (current ? getFontFamily(current) : 'var(--font-ui)'),
          fontSize: '14px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          minHeight: '36px',
        }}
      >
        <span className="truncate">{isUploaded ? (uploadedName ?? 'Uploaded font') : (current?.name ?? 'Select font')}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" style={{ flexShrink: 0, marginLeft: '8px', color: '#6b7280' }}>
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={label}
          className="absolute z-50 w-full mt-1 rounded overflow-hidden"
          style={{
            top: '100%',
            background: '#1e2126',
            border: '1px solid #2a2e34',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            maxHeight: '280px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div className="p-2" style={{ borderBottom: '1px solid #2a2e34' }}>
            <input
              ref={searchRef}
              type="text"
              placeholder="Search fonts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
              className="w-full px-2 py-1 text-sm rounded"
              style={{
                background: '#16181b',
                border: '1px solid #3a4048',
                borderRadius: '4px',
                color: '#e6e8eb',
                fontFamily: 'var(--font-ui)',
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full flex items-center justify-center gap-1 px-3 py-2 mt-2 rounded"
              style={{
                background: '#16181b',
                border: '1px dashed #3a4048',
                borderRadius: '4px',
                color: '#f4a92c',
                fontSize: '13px',
                fontFamily: 'var(--font-ui)',
                cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: '15px' }}>+</span>
              <span>Upload your own font</span>
            </button>
            {uploadError && (
              <p className="text-xs mt-1" style={{ color: '#e5564b' }}>{uploadError}</p>
            )}
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filtered.map((entry) => {
              const isSelected = entry.id === value.id
              const status = loadStatus.get(entry.url) ?? loadedFonts.get(entry.url)
              return (
                <button
                  key={entry.id}
                  role="option"
                  aria-selected={isSelected}
                  type="button"
                  onClick={() => handleSelect(entry)}
                  className="w-full flex items-center justify-between px-3 py-2 text-left"
                  style={{
                    background: isSelected ? 'rgba(244,169,44,0.14)' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#e6e8eb',
                    fontFamily: getFontFamily(entry),
                    fontSize: '14px',
                    borderLeft: isSelected ? '2px solid #f4a92c' : '2px solid transparent',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#2a2e34' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = isSelected ? 'rgba(244,169,44,0.14)' : 'transparent' }}
                >
                  <span className="truncate">{entry.name}</span>
                  <span className="flex items-center gap-1 flex-shrink-0 ml-2">
                    {status === 'loading' && (
                      <span style={{ fontSize: '11px', color: '#6b7280' }}>loading...</span>
                    )}
                    {status === 'error' && (
                      <span style={{ fontSize: '11px', color: '#e5564b' }}>error</span>
                    )}
                    {isSelected && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-label="selected" style={{ color: '#f4a92c' }}>
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                </button>
              )
            })}
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-sm" style={{ color: '#6b7280' }}>No fonts found</div>
            )}
          </div>
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept=".ttf,.otf,.woff,.woff2,font/*"
        className="sr-only"
        onChange={handleUploadFont}
        aria-label="Upload font file"
      />
    </div>
  )
}

/**
 * Given a font AssetRef, resolves the CSS font-family string for canvas use.
 * Ensures the font is loaded via FontFace before returning.
 */
export async function resolveFontFamily(ref: AssetRef, fonts: AssetEntry[]): Promise<string> {
  const entry = fonts.find((f) => f.id === ref.id)
  if (!entry) return 'sans-serif'
  await ensureFont(entry)
  if (loadedFonts.get(entry.url) === 'loaded') return `igfont-${entry.name}`
  return entry.name
}

export { resolveAssetUrl }
