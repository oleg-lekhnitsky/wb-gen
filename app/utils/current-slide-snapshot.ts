/** A self-contained single-slide snapshot; packshots retain their original scope. */
export function currentSlideSnapshot<T extends {
  panelSlides: { left: unknown[], right: unknown[] }
  selectedIndex: number
  requestedSlideCount: number
  showPackshotOnFinalSlide: boolean
  sharedContentSlides?: unknown[]
  aspectSlideSettings?: Record<string, { left: unknown[], right: unknown[] }>
}>(settings: T, index: number): T {
  if (!Number.isInteger(index) || index < 0 || index >= Math.min(settings.panelSlides.left.length, settings.panelSlides.right.length)) {
    throw new Error('Select a valid slide before exporting.')
  }
  const snapshot: T = JSON.parse(JSON.stringify(settings))
  snapshot.showPackshotOnFinalSlide = settings.showPackshotOnFinalSlide && index === settings.panelSlides.left.length - 1
  snapshot.panelSlides.left = snapshot.panelSlides.left.slice(index, index + 1)
  snapshot.panelSlides.right = snapshot.panelSlides.right.slice(index, index + 1)
  snapshot.sharedContentSlides = snapshot.sharedContentSlides?.slice(index, index + 1)
  for (const fields of Object.values(snapshot.aspectSlideSettings || {})) {
    fields.left = fields.left.slice(index, index + 1)
    fields.right = fields.right.slice(index, index + 1)
  }
  snapshot.selectedIndex = 0
  snapshot.requestedSlideCount = 1
  return snapshot
}
