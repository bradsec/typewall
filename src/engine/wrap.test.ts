import { describe, it, expect } from 'vitest'
import { splitLines } from './wrap'

describe('splitLines', () => {
  it('splits on // when present', () => {
    expect(splitLines('big//biceps//win', 99)).toEqual(['big', 'biceps', 'win'])
  })
  it('splits on newlines when present', () => {
    expect(splitLines('big\nbiceps\nwin', 99)).toEqual(['big', 'biceps', 'win'])
  })
  it('handles mixed // and newline separators', () => {
    expect(splitLines('big//biceps\nwin', 99)).toEqual(['big', 'biceps', 'win'])
  })
  it('drops blank lines from trailing newline', () => {
    expect(splitLines('one\n', 99)).toEqual(['one'])
  })
  it('distributes words across targetLines when set', () => {
    expect(splitLines('big biceps energy now', 99, 2)).toEqual(['big biceps', 'energy now'])
  })
  it('targetLines never exceeds word count', () => {
    expect(splitLines('one two', 99, 5)).toEqual(['one', 'two'])
  })
  it('reaches the requested line count for 3+ lines (no collapse to two)', () => {
    const t = 'Hello my name is TypeWall'
    expect(splitLines(t, 99, 3)).toHaveLength(3)
    expect(splitLines(t, 99, 4)).toHaveLength(4)
    expect(splitLines(t, 99, 5)).toHaveLength(5)
  })
  it('manual breaks stay as forced boundaries under targetLines', () => {
    expect(splitLines('a//b//c', 99, 1)).toEqual(['a', 'b', 'c'])
  })
  it('sub-splits a multi-word segment while keeping a short manual line intact', () => {
    const lines = splitLines('TrainHardr\nLife is too short to be small', 99, 4)
    expect(lines.length).toBe(4)
    expect(lines[0]).toBe('TrainHardr')
    expect(lines.slice(1).join(' ')).toBe('Life is too short to be small')
  })
  it('does not split single-word segments', () => {
    // 2 forced segments, targetLines 5: the single-word segment stays one line
    const lines = splitLines('Go\nbig or go home now', 99, 5)
    expect(lines[0]).toBe('Go')
    expect(lines.length).toBeLessThanOrEqual(5)
  })
  it('greedy-wraps by char width when no //', () => {
    expect(splitLines('aaa bbb ccc ddd', 7)).toEqual(['aaa bbb', 'ccc ddd'])
  })
  it('never returns empty lines', () => {
    expect(splitLines('one//', 99)).toEqual(['one'])
  })
})
