// src/workers/pool.test.ts
//
// Validates the BatchRunResult return shape added in Task 18. RenderPool.run
// cannot be exercised without a browser (Worker API), so we verify the exported
// interface types compile correctly and the shape of BatchRunResult is as
// documented: { results: BatchResult[], failures: BatchFailure[], cancelled?: boolean }.

import { describe, it, expect } from 'vitest'
import type { BatchResult, BatchFailure, BatchRunResult } from './pool'
import { RenderPool, resolveRef } from './pool'

describe('resolveRef', () => {
  // Regression: the base must be applied exactly once. A bug applied it in both
  // the pool and the worker, yielding protocol-relative "//fonts/X" (host
  // "fonts") and a "Failed to fetch" for every batch job.
  it('resolves a bundled id to a single absolute URL under dev base', () => {
    const url = resolveRef({ id: 'fonts/Anton.ttf', kind: 'bundled' }, 'http://localhost:5173/')
    expect(url).toBe('http://localhost:5173/fonts/Anton.ttf')
    expect(url).not.toContain('//fonts')
  })
  it('resolves against a GitHub Pages subpath base', () => {
    const url = resolveRef({ id: 'fonts/Anton.ttf', kind: 'bundled' }, 'https://u.github.io/repo/')
    expect(url).toBe('https://u.github.io/repo/fonts/Anton.ttf')
  })
  it('passes through blob/http/data ids unchanged', () => {
    const blob = resolveRef({ id: 'blob:abc', kind: 'uploaded' }, 'http://x/')
    expect(blob).toBe('blob:abc')
    const http = resolveRef({ id: 'https://cdn/x.ttf', kind: 'bundled' }, 'http://x/')
    expect(http).toBe('https://cdn/x.ttf')
  })
  it('returns undefined for a missing ref', () => {
    expect(resolveRef(undefined, 'http://x/')).toBeUndefined()
  })
})

describe('pool exports', () => {
  it('BatchRunResult has results and failures arrays', () => {
    // Construct a valid BatchRunResult literal — tsc will reject this if the
    // interface is missing either field, giving us compile-time coverage.
    const result: BatchRunResult = {
      results: [{ name: 'test.png', blob: new Blob(['data'], { type: 'image/png' }) }],
      failures: [{ name: 'bad.png', error: new Error('render failed') }],
    }
    expect(result.results).toHaveLength(1)
    expect(result.failures).toHaveLength(1)
  })

  it('BatchResult shape has name and blob', () => {
    const r: BatchResult = { name: 'img.png', blob: new Blob() }
    expect(r.name).toBe('img.png')
    expect(r.blob).toBeInstanceOf(Blob)
  })

  it('BatchFailure shape has name and error', () => {
    const err = new Error('oops')
    const f: BatchFailure = { name: 'img.png', error: err }
    expect(f.name).toBe('img.png')
    expect(f.error).toBe(err)
  })

  it('BatchRunResult with empty arrays is valid', () => {
    const empty: BatchRunResult = { results: [], failures: [] }
    expect(empty.results).toHaveLength(0)
    expect(empty.failures).toHaveLength(0)
  })

  it('BatchRunResult accepts cancelled field', () => {
    const cancelled: BatchRunResult = { results: [], failures: [], cancelled: true }
    expect(cancelled.cancelled).toBe(true)
  })

  it('cancel() method exists on RenderPool', () => {
    const pool = new RenderPool(1)
    expect(typeof pool.cancel).toBe('function')
    // cancel() before run() should not throw
    expect(() => pool.cancel()).not.toThrow()
  })
})
