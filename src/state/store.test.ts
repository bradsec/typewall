// src/state/store.test.ts
// Focused tests for the section-scoped setters added in Task 17.
// Key invariant: patchText/patchShadow/etc. must NOT drop sibling fields.

import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from './store'
import { defaultConfig } from '../engine/types'

// Reset store state between tests
function resetStore() {
  useStore.setState({ config: defaultConfig(), locks: { layout: false, fonts: false, scale: false, effects: false, color: false } })
}

describe('store section-scoped setters', () => {
  beforeEach(resetStore)

  it('patchText preserves shadow, outline, sprayPaint when changing color', () => {
    const { patchText } = useStore.getState()
    patchText({ color: '#ff0000' })
    const { config } = useStore.getState()
    expect(config.text.color).toBe('#ff0000')
    expect(config.text.shadow).toEqual(defaultConfig().text.shadow)
    expect(config.text.outline).toEqual(defaultConfig().text.outline)
    expect(config.text.sprayPaint).toEqual(defaultConfig().text.sprayPaint)
  })

  it('patchShadow preserves text.color and text.outline when changing shadow.enabled', () => {
    const { patchText, patchShadow } = useStore.getState()
    patchText({ color: '#abcdef' })
    patchShadow({ enabled: true })
    const { config } = useStore.getState()
    expect(config.text.shadow.enabled).toBe(true)
    expect(config.text.shadow.color).toBe(defaultConfig().text.shadow.color)
    expect(config.text.color).toBe('#abcdef')
    expect(config.text.outline).toEqual(defaultConfig().text.outline)
  })

  it('patchOutline preserves text.shadow', () => {
    const { patchShadow, patchOutline } = useStore.getState()
    patchShadow({ enabled: true, color: '#ff0000' })
    patchOutline({ enabled: true, ratio: 0.025 })
    const { config } = useStore.getState()
    expect(config.text.outline.enabled).toBe(true)
    expect(config.text.outline.ratio).toBe(0.025)
    expect(config.text.shadow.enabled).toBe(true)
    expect(config.text.shadow.color).toBe('#ff0000')
  })

  it('patchSprayPaint preserves text.shadow and text.outline', () => {
    const { patchShadow, patchSprayPaint } = useStore.getState()
    patchShadow({ enabled: true })
    patchSprayPaint({ overflow: 20 })
    const { config } = useStore.getState()
    expect(config.text.sprayPaint.overflow).toBe(20)
    expect(config.text.shadow.enabled).toBe(true)
  })

  it('patchBackground preserves background.image sub-object when changing color', () => {
    const { patchBackground } = useStore.getState()
    // First set image opacity to a non-default value
    const defaults = defaultConfig()
    patchBackground({ image: { ...defaults.background.image, opacity: 200 } })
    patchBackground({ color: '#123456' })
    const { config } = useStore.getState()
    expect(config.background.color).toBe('#123456')
    expect(config.background.image.opacity).toBe(200)
  })

  it('patchWatermark preserves existing fields', () => {
    const { patchWatermark } = useStore.getState()
    patchWatermark({ enabled: true, scaleFactor: 0.3 })
    patchWatermark({ position: 'top-right' })
    const { config } = useStore.getState()
    expect(config.watermark.enabled).toBe(true)
    expect(config.watermark.scaleFactor).toBe(0.3)
    expect(config.watermark.position).toBe('top-right')
  })
})

describe('activeVibe', () => {
  it('defaults to none and updates via setActiveVibe', () => {
    expect(useStore.getState().activeVibe).toBe('none')
    useStore.getState().setActiveVibe('brutalist')
    expect(useStore.getState().activeVibe).toBe('brutalist')
    useStore.getState().setActiveVibe('none')
  })
})
