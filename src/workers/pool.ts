// src/workers/pool.ts
//
// Worker pool for parallel image rendering. Spawns render.worker.ts instances
// and dispatches jobs via a shared queue. Job errors are recorded and the
// batch continues rather than aborting. Call cancel() to stop dispatching new
// jobs; already-running jobs complete and run() resolves with partial results.

import { wrap } from 'comlink'
import type { RenderConfig, AssetRef } from '../engine/types'
import { outputName } from '../batch/matrix'
import type { AssetUrls } from './render.worker'

export interface BatchResult {
  name: string
  blob: Blob
}

export interface BatchFailure {
  name: string
  error: unknown
}

export interface BatchRunResult {
  results: BatchResult[]
  failures: BatchFailure[]
  cancelled?: boolean
}

// ---------------------------------------------------------------------------
// Asset URL resolution helpers
// ---------------------------------------------------------------------------

/**
 * Resolve an AssetRef to a fully-qualified absolute URL on the main thread.
 *
 * Resolution must happen here, not in the worker: a worker resolves relative
 * URLs against its own script location (e.g. /assets/), not the page, so a
 * page-relative bundled path like "fonts/X.ttf" would 404. Resolving against
 * the document base produces an absolute URL that is correct in dev (base "/")
 * and on GitHub Pages subpaths (base "./" served from /repo/), and which the
 * worker then fetches verbatim. baseHref is injected for testability.
 */
export function resolveRef(
  ref: AssetRef | undefined,
  baseHref: string,
): string | undefined {
  if (!ref) return undefined
  const id = ref.id
  if (
    id.startsWith('blob:') ||
    id.startsWith('http:') ||
    id.startsWith('https:') ||
    id.startsWith('data:')
  ) {
    return id
  }
  return new URL(id, baseHref).href
}

function currentBaseHref(): string {
  return typeof document !== 'undefined' ? document.baseURI : self.location.href
}

function buildAssetUrls(config: RenderConfig, baseHref: string): AssetUrls {
  const urls: AssetUrls = {}
  urls.font = resolveRef(config.fontRef, baseHref)

  if (config.background.image.enabled && config.background.image.assetRef) {
    urls.bgImage = resolveRef(config.background.image.assetRef, baseHref)
  }
  if (config.overlay.image.enabled && config.overlay.image.assetRef) {
    urls.overlayImage = resolveRef(config.overlay.image.assetRef, baseHref)
  }
  if (config.overlay.textMask.enabled && config.overlay.textMask.assetRef) {
    urls.maskImage = resolveRef(config.overlay.textMask.assetRef, baseHref)
  }
  if (config.watermark.enabled && config.watermark.assetRef) {
    urls.watermarkImage = resolveRef(config.watermark.assetRef, baseHref)
  }

  return urls
}

// ---------------------------------------------------------------------------
// Worker proxy type (subset of the exposed worker API used here)
// ---------------------------------------------------------------------------

interface RenderWorkerProxy {
  renderToPng(config: RenderConfig, assetUrls: AssetUrls, baseUrl: string): Promise<Blob>
}

// ---------------------------------------------------------------------------
// RenderPool
// ---------------------------------------------------------------------------

export class RenderPool {
  private readonly size: number
  private _cancelled = false

  constructor(size?: number) {
    this.size = size ?? navigator.hardwareConcurrency ?? 4
  }

  /** Stop dispatching new jobs. Already-running jobs complete normally. */
  cancel(): void {
    this._cancelled = true
  }

  /**
   * Renders all jobs and returns results in completion order.
   *
   * Spawns min(this.size, jobs.length) workers. Each worker claims jobs from a
   * shared queue until the queue is empty or cancel() has been called.
   * On error, records a failure and continues. run() never rejects.
   */
  async run(
    jobs: RenderConfig[],
    onProgress: (done: number, total: number) => void,
  ): Promise<BatchRunResult> {
    this._cancelled = false

    if (jobs.length === 0) {
      onProgress(0, 0)
      return { results: [], failures: [] }
    }

    const baseHref = currentBaseHref()
    const workerCount = Math.min(this.size, jobs.length)

    const rawWorkers: Worker[] = []
    const proxies: RenderWorkerProxy[] = []

    for (let i = 0; i < workerCount; i++) {
      const w = new Worker(new URL('./render.worker.ts', import.meta.url), {
        type: 'module',
      })
      rawWorkers.push(w)
      proxies.push(wrap<RenderWorkerProxy>(w))
    }

    const results: BatchResult[] = []
    const failures: BatchFailure[] = []
    let done = 0
    const total = jobs.length
    let nextJobIdx = 0
    const self = this

    const workerLoops = proxies.map((proxy) =>
      (async () => {
        while (true) {
          if (self._cancelled) break
          const idx = nextJobIdx++
          if (idx >= jobs.length) break

          const job = jobs[idx]
          const name = outputName(job)
          const assetUrls = buildAssetUrls(job, baseHref)

          try {
            // assetUrls are already absolute; the worker fetches them verbatim.
            const blob = await proxy.renderToPng(job, assetUrls, baseHref)
            results.push({ name, blob })
          } catch (err: unknown) {
            console.error(`RenderPool: job "${name}" failed`, err)
            failures.push({ name, error: err })
          }
          done++
          onProgress(done, total)
        }
      })()
    )

    // Always terminate, even if a loop rejects (e.g. an unexpected throw from
    // buildAssetUrls), so workers are never leaked.
    try {
      await Promise.all(workerLoops)
    } finally {
      for (const w of rawWorkers) w.terminate()
    }

    return {
      results,
      failures,
      ...(self._cancelled ? { cancelled: true } : {}),
    }
  }
}
