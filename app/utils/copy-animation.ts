/** All staggered units must finish before the slide transition ends. */
export function copyAnimationTiming(headingCount: number, subheadingCount: number, transitionMs: number) {
  const total = Math.max(1, Number.isFinite(transitionMs) ? transitionMs : 650)
  const stagger = 80
  const subheadingStart = headingCount ? 200 + headingCount * stagger : 0
  const heading = Array.from({length:headingCount}, (_,index)=>index*stagger)
  const subheading = Array.from({length:subheadingCount}, (_,index)=>subheadingStart+index*stagger)
  const lastDelay = Math.max(0, ...heading, ...subheading)
  // Reserve at least half the transition for each unit's actual motion.
  const scale = lastDelay ? Math.min(1, total * .5 / lastDelay) : 1
  const duration = total-lastDelay*scale
  // Delay entrance only; keep exit timing and the transition deadline intact.
  const enterDelay = total * .4
  return { heading:heading.map(delay=>delay*scale), subheading:subheading.map(delay=>delay*scale), duration, enterDelay, enterDuration:duration-enterDelay }
}

/** offsetTop is unaffected by the translate/scale used during animation. */
export function copyLineIndices(tops: number[], tolerance = 3) {
  let line = -1
  let previousTop = Number.NEGATIVE_INFINITY
  return tops.map(top => {
    if (line < 0 || Math.abs(top - previousTop) > tolerance) {
      line++
      previousTop = top
    }
    return line
  })
}
