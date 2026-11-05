export type PlacementTarget = 'first' | 'second' | 'hidden'
export type ContentPlacement = Record<'copy' | 'logo' | 'cta' | 'legal' | 'background1' | 'background2', PlacementTarget>
export type ContentLayoutPreset = 'stacked' | 'adaptive-split' | 'per-format'
export const placementKey = (width: number, height: number) => `${Math.round(width)}x${Math.round(height)}`
/** Settings are shared by ratio, independently of pack and pixel dimensions. */
export function placementRatioKey(width: number, height: number) {
  let w = Math.max(1, Math.round(width)), h = Math.max(1, Math.round(height))
  let a = w, b = h
  while (b) { const remainder = a % b; a = b; b = remainder }
  return `${w / a}:${h / a}`
}

export function migrateRatioSettings<T extends object>(saved: Record<string, T>, width: number, height: number) {
  const result: Record<string, T> = {}
  for (const [key, value] of Object.entries(saved)) {
    const match = key.match(/^(\d+)[x:](\d+)$/)
    if (!match) continue
    const ratio = placementRatioKey(Number(match[1]), Number(match[2]))
    // Explicit ratio settings win over older exact-size entries.
    if (!result[ratio] || key.includes(':')) result[ratio] = { ...value }
  }
  const current = saved[placementKey(width, height)]
  const ratio = placementRatioKey(width, height)
  if (current && !saved[ratio]) result[ratio] = { ...current }
  return result
}
export const migratePlacementRatios = (saved: Record<string, ContentPlacement>, width: number, height: number) => migrateRatioSettings(saved, width, height)
export function defaultContentPlacement(width: number, height: number, swapped = false): ContentPlacement {
  return { copy:'first', logo:'first', cta:width/height>=4?'first':'second', legal:'second', background1:swapped?'second':'first', background2:swapped?'first':'second' }
}
export function normalizeContentPlacement(value: unknown, width: number, height: number, swapped = false): ContentPlacement {
  const result = defaultContentPlacement(width,height,swapped)
  if (!value || typeof value !== 'object') return result
  for (const key of Object.keys(result) as Array<keyof ContentPlacement>) {
    const target = (value as Record<string, unknown>)[key]
    if (target === 'first' || target === 'second' || target === 'hidden') result[key] = target
  }
  const defaults = defaultContentPlacement(width, height, swapped)
  for (const key of ['copy','logo','cta','legal'] as const) if (result[key] === 'hidden') result[key] = defaults[key]
  if (result.background1 === 'hidden') result.background1 = result.background2 === 'first' ? 'second' : result.background2 === 'second' ? 'first' : (swapped ? 'second' : 'first')
  if (result.background2 === 'hidden') result.background2 = result.background1 === 'first' ? 'second' : 'first'
  if (result.background1 === result.background2) result.background2 = result.background1 === 'first' ? 'second' : 'first'
  return result
}
export function updateContentPlacement(value: ContentPlacement, key: keyof ContentPlacement, target: PlacementTarget): ContentPlacement {
  const next = { ...value }
  if (target === 'hidden') return next
  if (key === 'background1' || key === 'background2') {
    const other = key === 'background1' ? 'background2' : 'background1'
    if (next[other] === target) next[other] = next[key]
  }
  next[key] = target
  return next
}
export function backgroundSource(placement: ContentPlacement, panel: 'first' | 'second'): 'left' | 'right' | null {
  return placement.background1 === panel ? 'left' : placement.background2 === panel ? 'right' : null
}
export function placementClasses(placement: Pick<ContentPlacement, 'copy' | 'logo' | 'cta' | 'legal'>, panel: 'first' | 'second', content?: { heading?: string, subheading?: string, logo?: string, ctaText?: string, legalText?: string }) {
  const empty = content ? { copy: !content.heading?.trim() && !content.subheading?.trim(), logo: !content.logo?.trim(), cta: !content.ctaText?.trim(), legal: !content.legalText?.trim() } : undefined
  return Object.fromEntries((['copy','logo','cta','legal'] as const).map(key=>[`hide-${key}`,placement[key]!==panel || !!empty?.[key]]))
}
