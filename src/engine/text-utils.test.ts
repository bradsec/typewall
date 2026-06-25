import { describe, it, expect } from 'vitest'
import { cleanFilename, calcLineLength } from './text-utils'

describe('cleanFilename', () => {
  it('strips non-alphanumerics, lowercases, caps at 30', () => {
    expect(cleanFilename('Shut the//f#ck up & train')).toBe('shutthefckuptrain')
    expect(cleanFilename('A'.repeat(40)).length).toBe(30)
  })
})
describe('calcLineLength', () => {
  it('returns a positive integer for normal input', () => {
    expect(calcLineLength(1000, 1420, 'hello world foo bar')).toBeGreaterThan(0)
  })
  it('wider canvas yields longer line length than tall canvas', () => {
    expect(calcLineLength(1600, 900, 'a b c')).toBeGreaterThan(calcLineLength(900, 1600, 'a b c'))
  })
})
