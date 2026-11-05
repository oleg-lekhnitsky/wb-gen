export type MeasuredHeadingWord = { width: number, gap: number, breakAfter: boolean }

/** Measurements are taken at the user's maximum font size. Never scale up. */
export function fitHeading(words: MeasuredHeadingWord[], width: number, height: number, lineHeight: number) {
  if (!words.length) return { scale: 1, lines: [] as number[][] }
  const wrap = (scale: number) => {
    const lines: number[][] = []
    let line: number[] = [], used = 0
    for (let index = 0; index < words.length; index++) {
      const word = words[index]!
      const next = used + (line.length ? words[index - 1]!.gap * scale : 0) + word.width * scale
      if (line.length && (words[index - 1]!.breakAfter || next > width)) {
        lines.push(line); line = []; used = 0
      }
      used += (line.length ? words[index - 1]!.gap * scale : 0) + word.width * scale
      line.push(index)
    }
    if (line.length) lines.push(line)
    return lines
  }
  const fits = (scale: number) => words.every(word => word.width * scale <= width)
    && wrap(scale).length * lineHeight * scale <= height
  let low = 0, high = 1
  if (width > 0 && height > 0 && lineHeight > 0) {
    if (fits(1)) low = 1
    else for (let step = 0; step < 24; step++) {
      const middle = (low + high) / 2
      if (fits(middle)) low = middle
      else high = middle
    }
  }
  const scale = low
  const greedy = wrap(scale)
  // At the largest fitting size, rebalance the same number of lines. Any
  // adjacent words may share a line, but explicit breaks are mandatory.
  const count = greedy.length
  const memo = new Map<string, { cost: number, lines: number[][] } | null>()
  function balance(start: number, remaining: number): { cost: number, lines: number[][] } | null {
    if (start === words.length) return remaining === 0 ? { cost: 0, lines: [] } : null
    if (remaining <= 0 || words.length - start < remaining) return null
    const key = `${start}:${remaining}`
    if (memo.has(key)) return memo.get(key)!
    let best: ReturnType<typeof balance> = null, used = 0
    for (let end = start; end < words.length; end++) {
      if (end > start && words[end - 1]!.breakAfter) break
      used += (end > start ? words[end - 1]!.gap : 0) + words[end]!.width
      const lineWidth = used * scale
      if (lineWidth > width + .001) break
      const rest = balance(end + 1, remaining - 1)
      if (!rest) continue
      const slack = Math.max(0, 1 - lineWidth / Math.max(1, width))
      const isolatedShortWord = end === start && slack > .6 ? .5 : 0
      const cost = slack * slack + isolatedShortWord + rest.cost
      if (!best || cost < best.cost) best = { cost, lines: [Array.from({ length: end - start + 1 }, (_, i) => start + i), ...rest.lines] }
    }
    memo.set(key, best)
    return best
  }
  return { scale, lines: balance(0, count)?.lines ?? greedy }
}

/** Fast feasibility check used when relative text shares the heading's budget. */
export function headingFitsAtScale(words: MeasuredHeadingWord[], width: number, height: number, lineHeight: number, scale: number) {
  let lines = words.length ? 1 : 0, used = 0
  for (let index = 0; index < words.length; index++) {
    const word = words[index]!
    if (word.width * scale > width) return false
    const gap = index ? words[index - 1]!.gap * scale : 0
    if (index && (words[index - 1]!.breakAfter || used + gap + word.width * scale > width)) {
      lines++; used = 0
    } else used += gap
    used += word.width * scale
  }
  return lines * lineHeight * scale <= height
}
