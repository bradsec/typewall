import { useState, useEffect } from 'react'
import { Editor } from './ui/Editor/Editor'
import { Batch } from './ui/Batch/Batch'
import { useUploadedFonts } from './state/uploaded-fonts'
import { useStore } from './state/store'
import { shuffle } from './shuffle/shuffle'
import { effectiveBackgroundColor } from './shuffle/contrast'
import { defaultConfig } from './engine/types'
import { manifest } from './assets/manifest'

type Tab = 'editor' | 'batch'

const LANDING_TEXT = 'Hello my name is TypeWall'
const LANDING_PALETTE = [
  '#ffffff', '#000000', '#f4a92c', '#e5564b', '#3fb67a',
  '#ff6b35', '#4ecdc4', '#a8dadc', '#f7dc6f', '#bb8fce',
]
const ALL_UNLOCKED = { layout: false, fonts: false, scale: false, effects: false, color: false }

export default function App() {
  const [tab, setTab] = useState<Tab>('editor')

  // Rehydrate user-uploaded fonts persisted in IndexedDB so they are available
  // in the picker and resolve in the render path across sessions.
  const loadUploadedFonts = useUploadedFonts((s) => s.loadAll)
  useEffect(() => { loadUploadedFonts() }, [loadUploadedFonts])

  // Landing demo: every load/refresh shows the default phrase with a fresh
  // random remix of normal (non-meme) settings. Math.random is fine here (UI
  // seed only); the engine's rendering stays seeded/deterministic. This
  // intentionally overrides any persisted config so each visit looks alive.
  const setConfig = useStore((s) => s.setConfig)
  useEffect(() => {
    const base = defaultConfig()
    base.text.content = LANDING_TEXT
    const seed = Math.floor(Math.random() * 0xffffff)
    const fontRefs = manifest.fonts.map((f) => ({ id: f.id, kind: 'bundled' as const }))
    setConfig(shuffle(base, ALL_UNLOCKED, seed, {
      palette: LANDING_PALETTE,
      fontRefs,
      fontMix: false,
      backgroundColor: effectiveBackgroundColor(base.background),
    }))
  }, [setConfig])

  return (
    <div
      className="flex flex-col"
      style={{ height: '100dvh', background: '#0e0f11', overflow: 'hidden' }}
    >
      {/* Top bar */}
      <header
        className="flex items-center gap-6 px-5 flex-shrink-0"
        style={{ height: '56px', background: '#16181b', borderBottom: '1px solid #2a2e34', zIndex: 10 }}
      >
        {/* Wordmark */}
        <span
          className="font-extrabold uppercase tracking-tight"
          style={{ fontSize: '20px', lineHeight: '24px', fontFamily: 'var(--font-display)', color: '#f4f5f7', letterSpacing: '-0.01em', userSelect: 'none' }}
        >
          TYPEWALL
        </span>

        {/* Tabs */}
        <nav role="tablist" aria-label="App sections" className="flex items-center gap-0">
          {(['editor', 'batch'] as Tab[]).map((t) => {
            const active = tab === t
            return (
              <button
                key={t}
                role="tab"
                aria-selected={active}
                aria-controls={`panel-${t}`}
                id={`tab-${t}`}
                type="button"
                onClick={() => setTab(t)}
                className="relative px-4 font-semibold uppercase text-xs tracking-wider"
                style={{
                  height: '56px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: active ? '#e6e8eb' : '#6b7280',
                  fontFamily: 'var(--font-display)',
                  letterSpacing: '0.06em',
                  transition: 'color 120ms ease',
                }}
              >
                {t.toUpperCase()}
                {/* Active underline */}
                {active && (
                  <span
                    className="absolute bottom-0 left-4 right-4"
                    style={{ height: '2px', background: '#f4a92c', borderRadius: '1px 1px 0 0' }}
                  />
                )}
              </button>
            )
          })}
        </nav>

        {/* Right spacer */}
        <div className="flex-1" />

        {/* Help placeholder */}
        <button
          type="button"
          aria-label="Help"
          className="flex items-center justify-center rounded"
          style={{
            width: '32px',
            height: '32px',
            background: '#1e2126',
            border: '1px solid #2a2e34',
            color: '#6b7280',
            cursor: 'pointer',
            borderRadius: '8px',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" />
            <path d="M7 9V7.5c1 0 2-.5 2-1.5S8.5 4.5 7 4.5 5 5.5 5 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="7" cy="11" r="0.5" fill="currentColor" />
          </svg>
        </button>
      </header>

      {/* Tab panels */}
      <main className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        <div
          id="panel-editor"
          role="tabpanel"
          aria-labelledby="tab-editor"
          style={{ display: tab === 'editor' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}
        >
          <Editor />
        </div>

        <div
          id="panel-batch"
          role="tabpanel"
          aria-labelledby="tab-batch"
          style={{ display: tab === 'batch' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}
        >
          <Batch />
        </div>
      </main>

      {/* Status bar */}
      <footer
        className="flex items-center gap-2 px-4 flex-shrink-0"
        style={{ height: '28px', background: '#16181b', borderTop: '1px solid #2a2e34', fontSize: '12px', color: '#6b7280' }}
      >
        <a
          href="https://github.com/bradsec/typewall"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5"
          style={{ color: 'inherit', textDecoration: 'none', fontFamily: 'var(--font-ui)' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#f4a92c')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#6b7280')}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
          </svg>
          <span>github.com/bradsec/typewall</span>
        </a>
      </footer>
    </div>
  )
}
