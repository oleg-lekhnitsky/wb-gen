export type PlacementTarget = 'first' | 'second' | 'hidden'
export type ContentPlacement = Record<'copy' | 'logo' | 'cta' | 'legal' | 'background1' | 'background2', PlacementTarget>
export type ContentLayoutPreset = 'stacked' | 'adaptive-split' | 'per-format'
export const placementKey = (width: number, height: number) => `${Math.round(width)}x${Math.round(height)}`
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
