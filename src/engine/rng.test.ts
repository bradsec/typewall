import { describe, it, expect } from 'vitest'
import { Rng } from './rng'

describe('Rng', () => {
  it('is deterministic for a fixed seed', () => {
    const a = new Rng(42), b = new Rng(42)
    const seqA = [a.next(), a.next(), a.next()]
    const seqB = [b.next(), b.next(), b.next()]
    expect(seqA).toEqual(seqB)
  })
  it('differs across seeds', () => {
    expect(new Rng(1).next()).not.toEqual(new Rng(2).next())
  })
  it('range stays within bounds', () => {
    const r = new Rng(7)
    for (let i = 0; i < 1000; i++) { const v = r.range(5, 10); expect(v).toBeGreaterThanOrEqual(5); expect(v).toBeLessThan(10) }
  })
})
