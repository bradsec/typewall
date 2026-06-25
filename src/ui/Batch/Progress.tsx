// src/ui/Batch/Progress.tsx
//
// Progress bar for a running batch job. Receives live done/total counts and
// a final failure count once the run completes. Announces progress to screen
// readers via aria-live.

interface ProgressProps {
  done: number
  total: number
  failures: number
  running: boolean
}

export function Progress({ done, total, failures, running }: ProgressProps) {
  if (total === 0) return null

  const pct = total > 0 ? (done / total) * 100 : 0
  const successCount = done - failures

  const liveMessage =
    running
      ? `Generating ${done} of ${total}`
      : failures > 0
        ? `Done: ${successCount} generated, ${failures} failed`
        : `Done: ${total} images generated`

  return (
    <div
      style={{
        background: '#16181b',
        borderTop: '1px solid #2a2e34',
        padding: '12px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      {/* Label row */}
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}
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
          PROGRESS
        </span>

        {/* done/total counter */}
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            color: '#9ca3af',
          }}
          aria-hidden="true"
        >
          {done}&nbsp;/&nbsp;{total}
        </span>

        {/* Failure badge - visible only when failures exist */}
        {!running && failures > 0 && (
          <span
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '12px',
              color: '#e5564b',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            {/* Warning icon - non-color signal */}
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M6 1L11 10H1L6 1Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path
                d="M6 5v2.5M6 9v.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            {failures} failed
          </span>
        )}
      </div>

      {/* Track */}
      <div
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Batch progress: ${done} of ${total}`}
        style={{
          height: '6px',
          background: '#2a2e34',
          borderRadius: '3px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: !running && failures > 0 ? '#e5564b' : '#f4a92c',
            borderRadius: '3px',
            transition: 'width 200ms linear',
          }}
        />
      </div>

      {/* Screen-reader live region */}
      <span
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {liveMessage}
      </span>
    </div>
  )
}
