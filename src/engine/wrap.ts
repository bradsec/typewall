export function splitLines(text: string, lineLength: number, targetLines?: number): string[] {
  // Manual breaks (`//` or newline) are fixed segment boundaries: words never
  // move across them. Each segment can still be sub-split further below.
  const hasManual = /\/\/|\r?\n/.test(text)
  const segments = (hasManual ? text.split(/\/\/|\r?\n/) : [text])
    .map(s => s.split(/\s+/).filter(Boolean))
    .filter(words => words.length > 0)

  if (segments.length === 0) return ['']

  // No shuffle-driven target: keep manual segments as-is, otherwise greedy-wrap.
  if (!targetLines || targetLines < 1) {
    if (hasManual) return segments.map(w => w.join(' '))
    return greedyWrap(segments[0], lineLength)
  }

  // Shuffle-driven: distribute extra line breaks into multi-word segments to
  // reach targetLines total, never fewer than the forced segment count.
  const totalWords = segments.reduce((sum, w) => sum + w.length, 0)
  let total = Math.min(targetLines, totalWords)
  total = Math.max(total, segments.length)

  const linesPer = segments.map(() => 1)
  let extra = total - segments.length
  while (extra > 0) {
    // Give the next break to the segment with the most unused splitting capacity.
    let best = -1
    let bestCap = 0
    for (let i = 0; i < segments.length; i++) {
      const cap = segments[i].length - linesPer[i]
      if (cap > bestCap) { bestCap = cap; best = i }
    }
    if (best < 0) break
    linesPer[best]++
    extra--
  }

  const out: string[] = []
  for (let i = 0; i < segments.length; i++) {
    out.push(...distributeWords(segments[i], linesPer[i]))
  }
  return out.length ? out : ['']
}

// Greedy width-based wrap: pack words until the next would exceed lineLength.
function greedyWrap(words: string[], lineLength: number): string[] {
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const candidate = cur ? cur + ' ' + w : w
    if (candidate.length > lineLength && cur) { lines.push(cur); cur = w }
    else cur = candidate
  }
  if (cur) lines.push(cur)
  return lines.length ? lines : ['']
}

// Split words into n lines balanced by word count, preserving order. Balancing
// by count (rather than character length) guarantees the requested line count
// is reached when there are enough words, so shuffle can produce 3+ line
// arrangements instead of collapsing short phrases back to two lines.
function distributeWords(words: string[], n: number): string[] {
  if (n <= 1 || words.length <= 1) return [words.join(' ')]
  const groups = Math.min(n, words.length)
  const lines: string[] = []
  let idx = 0
  for (let i = 0; i < groups; i++) {
    const remainingWords = words.length - idx
    const remainingLines = groups - i
    const take = Math.ceil(remainingWords / remainingLines)
    lines.push(words.slice(idx, idx + take).join(' '))
    idx += take
  }
  return lines.length ? lines : ['']
}
