import { describe, it, expect } from 'vitest'
import { buildMatrix, outputName } from './matrix'
import { defaultConfig } from '../engine/types'

describe('buildMatrix', () => {
  it('produces text x format x font configs', () => {
    const base = defaultConfig()
    const m = buildMatrix({ texts: ['A', 'B'], formats: [{name:'sq',width:100,height:100},{name:'tall',width:100,height:200}],
      fontRefs: [{id:'f1',kind:'bundled'},{id:'f2',kind:'bundled'}], base })
    expect(m.length).toBe(2 * 2 * 2)
  })
  it('outputName matches CLI convention', () => {
    const c = defaultConfig(); c.text.content = 'Train Hard!'; c.sizeFormat = { name: 'poster', width: 1, height: 1 }; c.fontRef = { id: 'fonts/Anton.ttf', kind: 'bundled' }
    expect(outputName(c)).toBe('trainhard_Anton_poster.png')
  })
})
