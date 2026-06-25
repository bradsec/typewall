// src/ui/Batch/MatrixBuilder.tsx
//
// Three-axis builder: text lines, size formats, fonts. Produces the inputs
// needed to call buildMatrix. Also houses the Generate button and count preview.

import { useState, useId } from 'react'
import type { AssetRef, SizeFormat } from '../../engine/types'
import type { AssetEntry } from '../../assets/manifest'
import { SIZE_FORMATS } from '../../assets/formats'

// ---- sub-components --------------------------------------------------------

interface CheckRowProps {
  id: string
  label: string
  sublabel?: string
  checked: boolean
  onChange: (v: boolean) => void
}

function CheckRow({ id, label, sublabel, checked, onChange }: CheckRowProps) {
  return (
    <label
      htmlFor={id}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 8px',
        borderRadius: '4px',
        cursor: 'pointer',
        background: checked ? 'rgba(244,169,44,0.08)' : 'transparent',
        transition: 'background 120ms ease',
        minHeight: '36px',
      }}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ accentColor: '#f4a92c', width: '14px', height: '14px', flexShrink: 0 }}
      />
      <span
        style={{
          fontFamily: 'var(--font-ui)',
          fontSize: '13px',
          color: checked ? '#e6e8eb' : '#9ca3af',
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
      {sublabel && (
        <span
          style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#6b7280', flexShrink: 0 }}
        >
          {sublabel}
        </span>
      )}
    </label>
  )
}

// ---- axis column -----------------------------------------------------------

interface AxisColumnProps {
  title: string
  children: React.ReactNode
}

function AxisColumn({ title, children }: AxisColumnProps) {
  return (
    <div
      style={{
        flex: '1 1 0',
        minWidth: '180px',
        display: 'flex',
        flexDirection: 'column',
        background: '#16181b',
        border: '1px solid #2a2e34',
        borderRadius: '8px',
        overflow: 'hidden',
      }}
    >
      {/* Column header */}
      <div
        style={{
          padding: '10px 12px 8px',
          borderBottom: '1px solid #2a2e34',
          background: '#1e2126',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: '#e6e8eb',
          }}
        >
          {title}
        </span>
      </div>

      {/* Scrollable content */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '4px',
          maxHeight: '280px',
        }}
      >
        {children}
      </div>
    </div>
  )
}

// ---- main component --------------------------------------------------------

export interface MatrixBuilderState {
  texts: string[]
  formats: SizeFormat[]
  fontRefs: AssetRef[]
}

interface MatrixBuilderProps {
  fonts: AssetEntry[]
  onGenerate: (state: MatrixBuilderState) => void
  running: boolean
}

export function MatrixBuilder({ fonts, onGenerate, running }: MatrixBuilderProps) {
  const textareaId = useId()

  // Text lines: raw textarea content; we split on newlines for the matrix
  const [rawText, setRawText] = useState('')

  // Format multi-select: start with 'postertest' pre-checked
  const [selectedFormats, setSelectedFormats] = useState<Set<string>>(
    new Set(['postertest']),
  )

  // Font multi-select: start with first font pre-checked
  const [selectedFontIds, setSelectedFontIds] = useState<Set<string>>(
    fonts.length > 0 ? new Set([fonts[0].id]) : new Set(),
  )

  // Derived: non-empty lines from textarea
  const textLines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  const checkedFormats = SIZE_FORMATS.filter((f) => selectedFormats.has(f.name))
  const checkedFonts = fonts.filter((f) => selectedFontIds.has(f.id))
  const count = textLines.length * checkedFormats.length * checkedFonts.length
  const canGenerate = count > 0 && !running

  function toggleFormat(name: string, on: boolean) {
    setSelectedFormats((prev) => {
      const next = new Set(prev)
      if (on) next.add(name)
      else next.delete(name)
      return next
    })
  }

  function toggleFont(id: string, on: boolean) {
    setSelectedFontIds((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function handleGenerate() {
    if (!canGenerate) return
    onGenerate({
      texts: textLines,
      formats: checkedFormats,
      fontRefs: checkedFonts.map((f) => ({ id: f.id, kind: 'bundled' as const })),
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Three axis columns */}
      <div
        style={{ display: 'flex', gap: '12px', alignItems: 'stretch', flexWrap: 'wrap' }}
      >
        {/* TEXT LINES column */}
        <div
          style={{
            flex: '1 1 0',
            minWidth: '180px',
            display: 'flex',
            flexDirection: 'column',
            background: '#16181b',
            border: '1px solid #2a2e34',
            borderRadius: '8px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '10px 12px 8px',
              borderBottom: '1px solid #2a2e34',
              background: '#1e2126',
            }}
          >
            <label
              htmlFor={textareaId}
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: '#e6e8eb',
                cursor: 'pointer',
              }}
            >
              TEXT LINES
            </label>
          </div>
          <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <textarea
              id={textareaId}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={'One entry per line, one image each\nFirst headline\nSecond headline\nThird headline'}
              rows={6}
              aria-describedby="batch-text-hint"
              style={{
                background: '#1e2126',
                border: '1px solid #3a4048',
                borderRadius: '4px',
                color: '#e6e8eb',
                fontFamily: 'var(--font-ui)',
                fontSize: '13px',
                padding: '8px',
                resize: 'vertical',
                minHeight: '100px',
                width: '100%',
              }}
            />
            <p
              id="batch-text-hint"
              style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: '#6b7280', margin: 0 }}
            >
              One line per text. Use{' '}
              <code style={{ fontFamily: 'var(--font-mono)', color: '#f8c46b' }}>//</code>{' '}
              for line breaks within an image.
              {textLines.length > 0 && (
                <span style={{ color: '#9ca3af' }}> ({textLines.length} texts)</span>
              )}
            </p>
          </div>
        </div>

        {/* FORMATS column */}
        <AxisColumn title="FORMATS">
          <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
            <legend className="sr-only">Size formats</legend>
            {SIZE_FORMATS.map((fmt) => (
              <CheckRow
                key={fmt.name}
                id={`fmt-${fmt.name}`}
                label={fmt.name}
                sublabel={`${fmt.width}×${fmt.height}`}
                checked={selectedFormats.has(fmt.name)}
                onChange={(on) => toggleFormat(fmt.name, on)}
              />
            ))}
          </fieldset>
        </AxisColumn>

        {/* FONTS column */}
        <AxisColumn title={`FONTS (${fonts.length})`}>
          <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
            <legend className="sr-only">Fonts</legend>
            {fonts.map((font) => (
              <CheckRow
                key={font.id}
                id={`font-${font.id}`}
                label={font.name}
                checked={selectedFontIds.has(font.id)}
                onChange={(on) => toggleFont(font.id, on)}
              />
            ))}
          </fieldset>
        </AxisColumn>
      </div>

      {/* Compute strip: count + Generate */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          padding: '10px 12px',
          background: '#16181b',
          border: '1px solid #2a2e34',
          borderRadius: '8px',
        }}
      >
        {/* Matrix count */}
        <span
          style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '13px',
            color: count > 0 ? '#9ca3af' : '#6b7280',
          }}
        >
          {count > 0 ? (
            <>
              Matrix:{' '}
              <span style={{ fontFamily: 'var(--font-mono)', color: '#e6e8eb' }}>
                {textLines.length} text
                {textLines.length !== 1 ? 's' : ''}
              </span>
              {' × '}
              <span style={{ fontFamily: 'var(--font-mono)', color: '#e6e8eb' }}>
                {checkedFormats.length} format
                {checkedFormats.length !== 1 ? 's' : ''}
              </span>
              {' × '}
              <span style={{ fontFamily: 'var(--font-mono)', color: '#e6e8eb' }}>
                {checkedFonts.length} font
                {checkedFonts.length !== 1 ? 's' : ''}
              </span>
              {' = '}
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '15px',
                  fontWeight: 700,
                  color: '#f4a92c',
                }}
              >
                {count}
              </span>
              {' images'}
            </>
          ) : (
            'Select at least one text, format, and font'
          )}
        </span>

        {/* Generate button */}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!canGenerate}
          style={{
            padding: '0 20px',
            height: '40px',
            background: canGenerate ? '#f4a92c' : '#1e2126',
            color: canGenerate ? '#0e0f11' : '#6b7280',
            border: 'none',
            borderRadius: '8px',
            fontFamily: 'var(--font-display)',
            fontSize: '13px',
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            cursor: canGenerate ? 'pointer' : 'not-allowed',
            flexShrink: 0,
            transition: 'background 120ms ease, color 120ms ease',
            minWidth: '120px',
          }}
          aria-disabled={!canGenerate}
        >
          {running ? 'Generating...' : count > 0 ? `GENERATE ${count}` : 'GENERATE'}
        </button>
      </div>
    </div>
  )
}
