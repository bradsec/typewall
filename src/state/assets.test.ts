// src/state/assets.test.ts
import { describe, it, expect, vi } from 'vitest'
import { manifest } from '../assets/manifest'
import { registerUploadedImage, registerUploadedFont } from './assets'

describe('manifest', () => {
  it('lists bundled fonts including the default', () => {
    expect(manifest.fonts.length).toBeGreaterThan(0)
    expect(manifest.fonts.some(f => f.name === 'anton')).toBe(true)
  })
  it('every entry has a stable id and url', () => {
    for (const f of manifest.fonts) { expect(f.id).toBeTruthy(); expect(f.url).toBeTruthy() }
  })
})

describe('uploaded asset registration (F2 regression)', () => {
  it('reuses the object URL for an identical re-upload instead of leaking', async () => {
    const spy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:dedup')
    const file = new File([new Uint8Array([1, 2, 3])], 'f2-image-fixture.png', { type: 'image/png' })
    const a = await registerUploadedImage(file)
    const b = await registerUploadedImage(file)
    expect(a.id).toBe(b.id)
    expect(spy).toHaveBeenCalledTimes(1)   // not called again on the second upload
    spy.mockRestore()
  })
  it('also dedupes font uploads', async () => {
    const spy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:dedup-font')
    const file = new File([new Uint8Array([4, 5, 6])], 'f2-font-fixture.ttf', { type: 'font/ttf' })
    await registerUploadedFont(file)
    await registerUploadedFont(file)
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })
})
