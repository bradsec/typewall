import { useRef } from 'react'
import { useStore } from '../../state/store'
import { PreviewCanvas, type PreviewCanvasHandle } from './PreviewCanvas'
import { ControlPanel } from './ControlPanel'
import { ShuffleBar } from './ShuffleBar'
import { outputName } from '../../batch/matrix'
import { saveAs } from 'file-saver'

export function Editor() {
  const config = useStore((s) => s.config)
  const canvasRef = useRef<PreviewCanvasHandle>(null)

  function handleExport() {
    if (!canvasRef.current) return
    canvasRef.current.toBlob((blob) => {
      if (!blob) return
      saveAs(blob, outputName(config))
    }, 'image/png')
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <ShuffleBar onExport={handleExport} />

      {/* Mobile: the whole editor scrolls as one column (stage on top, controls
          flowing below) so there is a single scrollbar. lg+: nothing here
          scrolls; the stage fills and only the rail (360px) scrolls. */}
      <div
        className="flex flex-1 flex-col lg:flex-row overflow-y-auto lg:overflow-hidden"
        style={{ minHeight: 0 }}
      >
        {/* Stage (canvas area) */}
        <div
          className="relative overflow-hidden flex-shrink-0 lg:flex-1 lg:flex-shrink"
          style={{ background: '#0e0f11', minWidth: 0, minHeight: '50vh' }}
        >
          <PreviewCanvas ref={canvasRef} config={config} />

          {/* Export button anchored stage bottom-right — desktop only; mobile export is in ShuffleBar */}
          <button
            type="button"
            onClick={handleExport}
            className="hidden lg:flex absolute bottom-4 right-4 items-center gap-2 px-5 py-2.5 rounded font-semibold text-sm"
            style={{
              background: '#f4a92c',
              color: '#0e0f11',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontFamily: 'var(--font-ui)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            }}
          >
            Export PNG
          </button>
        </div>

        {/* Control rail — flows in the mobile scroll column; fixed 360px
            self-scrolling rail on lg+. Only one element scrolls per breakpoint. */}
        <div
          className="w-full flex-shrink-0 lg:flex-none lg:h-full lg:w-[360px] lg:overflow-y-auto lg:border-l"
          style={{ background: '#16181b', borderColor: '#2a2e34' }}
        >
          <ControlPanel />
        </div>
      </div>
    </div>
  )
}
