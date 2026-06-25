import type { SizeFormat } from '../engine/types'

// Recognizable social and print presets at their standard pixel dimensions.
export const SIZE_FORMATS: SizeFormat[] = [
  { name: 'square', width: 1080, height: 1080 },
  { name: 'portrait', width: 1080, height: 1350 },
  { name: 'story', width: 1080, height: 1920 },
  { name: 'landscape', width: 1920, height: 1080 },
  { name: 'wide', width: 1200, height: 630 },
  { name: 'poster', width: 1080, height: 1527 },
  { name: 'pinterest', width: 1000, height: 1500 },

  // Print paper sizes at 300 DPI (print-ready). ISO A-series (AU/UK/intl) and
  // US ANSI sizes, each in portrait and landscape. Pixel dims = inches * 300
  // (A-series via mm / 25.4 * 300, rounded).
  { name: 'a4-portrait', width: 2480, height: 3508 },
  { name: 'a4-landscape', width: 3508, height: 2480 },
  { name: 'a3-portrait', width: 3508, height: 4961 },
  { name: 'a3-landscape', width: 4961, height: 3508 },
  { name: 'a5-portrait', width: 1748, height: 2480 },
  { name: 'a5-landscape', width: 2480, height: 1748 },
  { name: 'letter-portrait', width: 2550, height: 3300 },
  { name: 'letter-landscape', width: 3300, height: 2550 },
  { name: 'legal-portrait', width: 2550, height: 4200 },
  { name: 'legal-landscape', width: 4200, height: 2550 },
  { name: 'tabloid-portrait', width: 3300, height: 5100 },
  { name: 'tabloid-landscape', width: 5100, height: 3300 },
]
