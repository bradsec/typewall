import type { RenderConfig } from '../engine/types'

const REQUIRED_KEYS: (keyof RenderConfig)[] = [
  'sizeFormat',
  'text',
  'background',
  'overlay',
  'watermark',
  'fontRef',
  'seed',
]

export function exportPreset(config: RenderConfig): string {
  return JSON.stringify(config, null, 2)
}

export function importPreset(json: string): RenderConfig {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('invalid preset')
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('invalid preset')
  }

  const obj = parsed as Record<string, unknown>

  for (const key of REQUIRED_KEYS) {
    if (!(key in obj)) {
      throw new Error('invalid preset')
    }
  }

  const text = obj.text as Record<string, unknown> | null
  if (text === null || typeof text !== 'object' || typeof text.baseFontSize !== 'number') {
    throw new Error('invalid preset')
  }

  return parsed as RenderConfig
}
