import { describe, it, expect } from 'vitest'
import { exportPreset, importPreset } from './presets'
import { defaultConfig } from '../engine/types'

describe('presets', () => {
  it('round-trips a config', () => {
    const c = defaultConfig(); c.text.content = 'ROUND//TRIP'; c.seed = 9
    expect(importPreset(exportPreset(c))).toEqual(c)
  })
  it('rejects invalid JSON', () => {
    expect(() => importPreset('{ not valid')).toThrow()
  })
  it('rejects structurally-wrong preset', () => {
    expect(() => importPreset(JSON.stringify({ foo: 1 }))).toThrow()
  })
})
