const metricFaces = new Map<string, Promise<string>>()
let metricFaceId = 0

/** Measure the actual glyph outline using the same font file and axis values. */
export async function measureGlyphRatio(source: string, weight: string, variations: string, glyph: string) {
  const key = JSON.stringify([source, weight, variations])
  let pending = metricFaces.get(key)
  if (!pending) {
    const family = `BannerGlyphMetrics${++metricFaceId}`
    pending = (async () => {
      const face = new FontFace(family, `url(${JSON.stringify(source)})`, {
        weight, variationSettings: variations || 'normal'
      })
      await face.load()
      document.fonts.add(face)
      return family
    })()
    metricFaces.set(key, pending)
  }
  const family = await pending
  const context = document.createElement('canvas').getContext('2d')!
  context.font = `${weight} 1000px ${family}`
  const box = context.measureText(glyph)
  const ratio = (box.actualBoundingBoxAscent + box.actualBoundingBoxDescent) / 1000
  if (!(ratio > 0)) throw new Error('Could not measure glyph height for relative legal sizing.')
  return ratio
}

/** Browser-loaded UI fonts retain their selected weight and optical size. */
export async function measureLoadedGlyphRatio(family: string, weight: string, size: number, glyph: string) {
  // Tiny or collapsed text cannot provide stable glyph bounds. Inter cap
  // metrics are measured at a readable size, independently of the current fit.
  size = Math.max(100, size)
  const descriptor = `${weight} ${size}px ${JSON.stringify(family)}`
  const faces = await document.fonts.load(descriptor, glyph)
  if (!faces.length) throw new Error(`Required font ${family} is unavailable for glyph measurement.`)
  const context = document.createElement('canvas').getContext('2d')!
  context.font = descriptor
  const box = context.measureText(glyph)
  const ratio = (box.actualBoundingBoxAscent + box.actualBoundingBoxDescent) / size
  if (!(ratio > 0)) throw new Error('Could not measure relative text capitals.')
  return ratio
}
