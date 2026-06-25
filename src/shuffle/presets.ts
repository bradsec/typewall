import type { Alignment } from '../engine/types'

export type Toggle = 'on' | 'off' | 'any'
export type Range = [number, number]

export interface VibeBias {
  palette: string[]
  fontIds: string[]
  alignments: Alignment[]
  slant: Toggle
  blockText: Toggle
  lineSpacing: Range
  letterSpacing: Range
  scaleEmphasis: Range
  sprayOverflow: Range
  shadow: Toggle
  outline: Toggle
  outlineRatio: Range
  maxLines: number
}

export interface VibePreset {
  id: string
  label: string
  bias: VibeBias
}

export const VIBE_PRESETS: VibePreset[] = [
  {
    id: 'brutalist',
    label: 'Brutalist',
    bias: {
      palette: ['#000000', '#111111', '#444444', '#888888', '#e5564b', '#ffffff'],
      fontIds: [
        'fonts/Anton.ttf', 'fonts/ArchivoBlack.ttf', 'fonts/BebasNeue.ttf',
        'fonts/Staatliches.ttf', 'fonts/RubikMonoOne.ttf',
      ],
      alignments: ['left'],
      slant: 'off',
      blockText: 'on',
      lineSpacing: [0.0, 0.02],
      letterSpacing: [-0.02, 0.0],
      scaleEmphasis: [1.0, 1.4],
      sprayOverflow: [5, 8],
      shadow: 'off',
      outline: 'on',
      outlineRatio: [0.02, 0.04],
      maxLines: 4,
    },
  },
  {
    id: 'y2k',
    label: 'Y2K Chrome',
    bias: {
      palette: ['#c0c0c0', '#9aa7ff', '#3fb6ff', '#1b2a6b', '#ffffff', '#7df9ff'],
      fontIds: ['fonts/Audiowide.ttf', 'fonts/Righteous.ttf', 'fonts/RussoOne.ttf', 'fonts/FasterOne.ttf'],
      alignments: ['center'],
      slant: 'any',
      blockText: 'any',
      lineSpacing: [0.01, 0.06],
      letterSpacing: [0.0, 0.08],
      scaleEmphasis: [0.9, 1.3],
      sprayOverflow: [5, 10],
      shadow: 'on',
      outline: 'any',
      outlineRatio: [0.008, 0.025],
      maxLines: 4,
    },
  },
  {
    id: 'vaporwave',
    label: 'Vaporwave',
    bias: {
      palette: ['#ff71ce', '#01cdfe', '#b967ff', '#05ffa1', '#000000', '#2d1b4e'],
      fontIds: ['fonts/Monoton.ttf', 'fonts/Audiowide.ttf', 'fonts/VT323.ttf', 'fonts/PressStart2P.ttf'],
      alignments: ['center'],
      slant: 'any',
      blockText: 'any',
      lineSpacing: [0.02, 0.1],
      letterSpacing: [0.05, 0.25],
      scaleEmphasis: [0.85, 1.2],
      sprayOverflow: [5, 10],
      shadow: 'on',
      outline: 'any',
      outlineRatio: [0.008, 0.02],
      maxLines: 3,
    },
  },
  {
    id: 'newspaper',
    label: 'Newspaper',
    bias: {
      palette: ['#000000', '#1a1a1a', '#3a3a3a', '#f5f1e6', '#ffffff'],
      fontIds: ['fonts/IBMPlexSerif.ttf', 'fonts/AbrilFatface.ttf', 'fonts/SpecialElite.ttf', 'fonts/PirataOne.ttf'],
      alignments: ['left', 'center'],
      slant: 'off',
      blockText: 'on',
      lineSpacing: [0.0, 0.03],
      letterSpacing: [-0.02, 0.02],
      scaleEmphasis: [0.9, 1.25],
      sprayOverflow: [5, 8],
      shadow: 'off',
      outline: 'off',
      outlineRatio: [0.008, 0.015],
      maxLines: 5,
    },
  },
]

export function getVibeBias(id: string): VibeBias | undefined {
  return VIBE_PRESETS.find((p) => p.id === id)?.bias
}
