// src/batch/matrix.ts
//
// Pure functions for building the render task matrix.
// Mirrors the CLI's format x text x font task enumeration (main.py).

import type { AssetRef, RenderConfig, SizeFormat } from '../engine/types'
import { cleanFilename } from '../engine/text-utils'

export interface MatrixInput {
  texts: string[]
  formats: SizeFormat[]
  fontRefs: AssetRef[]
  base: RenderConfig
}

/**
 * Expands the cross-product of texts x formats x fontRefs into one RenderConfig
 * per combination, mirroring the CLI task matrix in main.py.
 */
export function buildMatrix(input: MatrixInput): RenderConfig[] {
  const { texts, formats, fontRefs, base } = input
  const configs: RenderConfig[] = []

  for (const fmt of formats) {
    for (const text of texts) {
      for (const fontRef of fontRefs) {
        configs.push({
          ...base,
          sizeFormat: fmt,
          text: { ...base.text, content: text },
          fontRef,
        })
      }
    }
  }

  return configs
}

/**
 * Derives the output filename for a rendered config.
 * Pattern: `${cleanFilename(text)}_${fontName}_${formatName}.png`
 * where fontName is the basename of fontRef.id without extension.
 * Mirrors reference main.py output path construction.
 */
export function outputName(config: RenderConfig): string {
  const textPart = cleanFilename(config.text.content)
  const base = config.fontRef.id.split('/').pop() ?? config.fontRef.id
  const fontPart = base.replace(/\.[^.]+$/, '')
  const formatPart = config.sizeFormat.name
  return `${textPart}_${fontPart}_${formatPart}.png`
}
