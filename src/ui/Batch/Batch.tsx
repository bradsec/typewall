// src/ui/Batch/Batch.tsx
//
// Batch screen: base-style summary, matrix builder, run progress, results grid
// and ZIP download. The Editor config from useStore is the base style; the user
// adds multiple texts, formats, and fonts to form the matrix.

import { useState, useCallback, useRef, useEffect } from 'react'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { useStore } from '../../state/store'
import { manifest } from '../../assets/manifest'
import { buildMatrix } from '../../batch/matrix'
import { RenderPool } from '../../workers/pool'
import type { BatchResult, BatchFailure } from '../../workers/pool'
import { MatrixBuilder } from './MatrixBuilder'
import type { MatrixBuilderState } from './MatrixBuilder'
import { Progress } from './Progress'

type RunState = 'idle' | 'running' | 'done' | 'cancelled'

interface ResultTile {
  name: string
  url: string
}

// ---- Base style summary strip -----------------------------------------------

function BaseStyleStrip() {
  const config = useStore((s) => s.config)
  const { text, background, watermark, sizeFormat } = config

  const bgDesc = background.transparent
    ? 'transparent'
    : background.image.enabled
      ? 'image bg'
      : background.color

  const effectParts: string[] = []
  if (text.sprayPaint.enabled) effectParts.push(`spray ${text.sprayPaint.overflow}`)
  if (text.shadow.enabled) effectParts.push('shadow')
  if (text.outline.enabled) effectParts.push('outline')

  const fontName = config.fontRef.id.split('/').pop()?.replace(/\.[^.]+$/, '') ?? config.fontRef.id

  return (
    <div
      style={{
        background: '#16181b',
        borderBottom: '1px solid #2a2e34',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flexWrap: 'wrap',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '11px',
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: '#6b7280',
          flexShrink: 0,
        }}
      >
        BASE STYLE:
      </span>
      <span
        style={{
          fontFamily: 'var(--font-ui)',
          fontSize: '12px',
          color: '#9ca3af',
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {fontName}
        {text.color !== '#ffffff' && ` . ${text.color}`}
        {effectParts.length > 0 && ` . ${effectParts.join(', ')}`}
        {` . ${bgDesc}`}
        {watermark.enabled && ' . wm'}
        {` . ${sizeFormat.name}`}
      </span>
      <a
        href="#editor"
        onClick={(e) => {
          e.preventDefault()
          // Signal is handled by the parent (App.tsx) via the tab click
          const tabBtn = document.getElementById('tab-editor')
          if (tabBtn) tabBtn.click()
        }}
        style={{
          fontFamily: 'var(--font-ui)',
          fontSize: '12px',
          color: '#f4a92c',
          textDecoration: 'none',
          flexShrink: 0,
          borderBottom: '1px solid rgba(244,169,44,0.4)',
          paddingBottom: '1px',
        }}
      >
        Edit in Editor
      </a>
    </div>
  )
}

// ---- Results grid -----------------------------------------------------------

interface ResultsGridProps {
  tiles: ResultTile[]
  failures: BatchFailure[]
}

function ResultsGrid({ tiles, failures }: ResultsGridProps) {
  if (tiles.length === 0 && failures.length === 0) {
    return (
      <div
        style={{
          padding: '32px 16px',
          textAlign: 'center',
          color: '#6b7280',
          fontFamily: 'var(--font-ui)',
          fontSize: '14px',
        }}
      >
        No images yet. Set your axes and Generate.
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
        gap: '8px',
        padding: '16px',
      }}
      aria-label="Generated images"
    >
      {tiles.map((tile) => (
        <div
          key={tile.name}
          style={{
            background: '#1e2126',
            border: '1px solid #2a2e34',
            borderRadius: '8px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <img
            src={tile.url}
            alt={tile.name}
            style={{
              width: '100%',
              aspectRatio: '1 / 1',
              objectFit: 'cover',
              display: 'block',
            }}
            loading="lazy"
          />
          <span
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '10px',
              color: '#6b7280',
              padding: '4px 6px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={tile.name}
          >
            {tile.name}
          </span>
        </div>
      ))}
      {failures.map((f) => {
        const errMsg = f.error instanceof Error ? f.error.message : String(f.error)
        return (
          <div
            key={f.name}
            role="img"
            aria-label={`Failed: ${f.name}`}
            title={`Failed: ${errMsg}`}
            style={{
              background: '#1e2126',
              border: '1px solid #e5564b',
              borderRadius: '8px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              aspectRatio: '1 / 1',
              gap: '4px',
              padding: '8px',
            }}
          >
            {/* Error icon */}
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <circle cx="10" cy="10" r="9" stroke="#e5564b" strokeWidth="1.5" />
              <path d="M10 6v5M10 13v1" stroke="#e5564b" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '10px',
                color: '#e5564b',
                textAlign: 'center',
                wordBreak: 'break-all',
              }}
            >
              {f.name}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ---- Batch screen -----------------------------------------------------------

export function Batch() {
  const config = useStore((s) => s.config)

  const [runState, setRunState] = useState<RunState>('idle')
  const [done, setDone] = useState(0)
  const [total, setTotal] = useState(0)
  const [tiles, setTiles] = useState<ResultTile[]>([])
  const [failures, setFailures] = useState<BatchFailure[]>([])

  // tilesRef mirrors tiles state so clearPreviousRun always sees current tiles
  // even when called from inside a useCallback with stale closure.
  const tilesRef = useRef<ResultTile[]>([])
  useEffect(() => {
    tilesRef.current = tiles
  }, [tiles])

  // poolRef holds the active RenderPool so handleCancel can reach it.
  const poolRef = useRef<RenderPool | null>(null)

  // On unmount, revoke any live tile URLs and stop an in-flight run so blob
  // URLs and workers are not leaked.
  useEffect(() => () => {
    for (const t of tilesRef.current) URL.revokeObjectURL(t.url)
    poolRef.current?.cancel()
  }, [])

  // Revoke old object URLs to avoid memory leaks when a new run starts.
  // Reads tilesRef.current to avoid stale closure when config hasn't changed.
  function clearPreviousRun() {
    for (const t of tilesRef.current) URL.revokeObjectURL(t.url)
    setTiles([])
    setFailures([])
    setDone(0)
    setTotal(0)
  }

  const handleGenerate = useCallback(
    async (state: MatrixBuilderState) => {
      clearPreviousRun()
      const jobs = buildMatrix({ ...state, base: config })
      if (jobs.length === 0) return

      setRunState('running')
      setTotal(jobs.length)
      setDone(0)

      const pool = new RenderPool()
      poolRef.current = pool

      const result = await pool.run(jobs, (d, t) => {
        setDone(d)
        setTotal(t)
      })

      poolRef.current = null

      // Build object-URL tiles from blobs
      const newTiles: ResultTile[] = result.results.map((r: BatchResult) => ({
        name: r.name,
        url: URL.createObjectURL(r.blob),
      }))
      setTiles(newTiles)
      setFailures(result.failures)
      setRunState(result.cancelled ? 'cancelled' : 'done')
    },
    // config changes between clicks are intentional
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config],
  )

  function handleCancel() {
    poolRef.current?.cancel()
  }

  async function handleDownloadZip() {
    if (tiles.length === 0) return
    const zip = new JSZip()
    // Fetch blobs from object URLs and add to zip
    await Promise.all(
      tiles.map(async (tile) => {
        const res = await fetch(tile.url)
        const blob = await res.blob()
        zip.file(tile.name, blob)
      }),
    )
    const zipBlob = await zip.generateAsync({ type: 'blob' })
    saveAs(zipBlob, 'typewall-batch.zip')
  }

  const running = runState === 'running'
  const isDone = runState === 'done'
  const isCancelled = runState === 'cancelled'
  const showProgress = running || isDone || isCancelled

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Base style summary */}
      <BaseStyleStrip />

      {/* Main scrollable content */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Matrix builder */}
        <div style={{ padding: '16px' }}>
          <MatrixBuilder
            fonts={manifest.fonts}
            onGenerate={handleGenerate}
            running={running}
          />
        </div>

        {/* Cancel button — visible while running */}
        {running && (
          <div style={{ padding: '0 16px 8px', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={handleCancel}
              aria-label="Cancel batch generation"
              style={{
                padding: '0 16px',
                height: '36px',
                background: 'transparent',
                color: '#e5564b',
                border: '1px solid #e5564b',
                borderRadius: '8px',
                fontFamily: 'var(--font-display)',
                fontSize: '12px',
                fontWeight: 600,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        )}

        {/* Progress (appears when running, done, or cancelled) */}
        {showProgress && (
          <Progress
            done={done}
            total={total}
            failures={failures.length}
            running={running}
          />
        )}

        {/* Cancelled state notice */}
        {isCancelled && (
          <div
            role="status"
            aria-live="polite"
            style={{
              margin: '0 16px',
              padding: '10px 14px',
              background: 'rgba(229,86,75,0.08)',
              border: '1px solid rgba(229,86,75,0.3)',
              borderRadius: '8px',
              fontFamily: 'var(--font-ui)',
              fontSize: '13px',
              color: '#e5564b',
            }}
          >
            Generation cancelled.
            {tiles.length > 0 && ` ${tiles.length} image${tiles.length !== 1 ? 's' : ''} completed before cancellation.`}
          </div>
        )}

        {/* Results area */}
        {(isDone || isCancelled || tiles.length > 0 || failures.length > 0) && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {/* Results header with Download ZIP */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderTop: '1px solid #2a2e34',
                background: '#16181b',
                gap: '8px',
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
                RESULTS
                {tiles.length > 0 && (
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      color: '#6b7280',
                      marginLeft: '8px',
                      fontWeight: 500,
                      textTransform: 'none',
                      letterSpacing: '0',
                    }}
                  >
                    {tiles.length} image{tiles.length !== 1 ? 's' : ''}
                    {failures.length > 0 && `, ${failures.length} failed`}
                  </span>
                )}
              </span>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {tiles.length > 0 && (
                  <button
                    type="button"
                    onClick={handleDownloadZip}
                    style={{
                      padding: '0 16px',
                      height: '36px',
                      background: '#f4a92c',
                      color: '#0e0f11',
                      border: 'none',
                      borderRadius: '8px',
                      fontFamily: 'var(--font-display)',
                      fontSize: '12px',
                      fontWeight: 600,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                    }}
                  >
                    Download ZIP
                  </button>
                )}
              </div>
            </div>

            <ResultsGrid tiles={tiles} failures={failures} />
          </div>
        )}

        {/* Idle empty state */}
        {runState === 'idle' && tiles.length === 0 && (
          <div
            style={{
              padding: '0 16px 24px',
              textAlign: 'center',
              color: '#6b7280',
              fontFamily: 'var(--font-ui)',
              fontSize: '13px',
            }}
          >
            No images yet. Set your axes and Generate.
          </div>
        )}
      </div>
    </div>
  )
}
