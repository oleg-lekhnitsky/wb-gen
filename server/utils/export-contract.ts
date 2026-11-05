import type { Page } from 'playwright'

/** Run after applying export dimensions, before capturing any pixels or layers. */
export async function assertExportAssetsReady(page: Page) {
  return page.evaluate(async () => {
    const stage = document.querySelector<HTMLElement>('.slot-stage--main')
    if (!stage) throw new Error('Export contract: missing banner stage.')

    // FontFaceSet.ready alone can resolve even when a face failed to download.
    const requests = new Map<string, { family: string, descriptor: string, text: string }>()
    for (const element of stage.querySelectorAll<HTMLElement>('*')) {
      const text = Array.from(element.childNodes)
        .filter(node => node.nodeType === Node.TEXT_NODE)
        .map(node => node.textContent || '').join('').trim()
      if (!text) continue
      const style = getComputedStyle(element)
      if (style.display === 'none' || style.visibility === 'hidden') continue
      const family = style.fontFamily.split(',')[0]!.trim().replace(/^["']|["']$/g, '')
      const descriptor = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${JSON.stringify(family)}`
      const previous = requests.get(descriptor)
      requests.set(descriptor, { family, descriptor, text: (previous?.text || '') + text })
    }

    const genericFamilies = new Set(['serif', 'sans-serif', 'monospace', 'system-ui', 'cursive', 'fantasy'])
    for (const { family, descriptor, text } of requests.values()) {
      if (genericFamilies.has(family.toLowerCase())) continue
      // An unknown family otherwise passes fonts.check() using a system fallback.
      const faces = await document.fonts.load(descriptor, text)
      if (!faces.length || !document.fonts.check(descriptor, text)) {
        throw new Error(`Export contract: required font ${family} is unavailable (${descriptor}).`)
      }
    }
    await document.fonts.ready

    for (const image of stage.querySelectorAll<HTMLImageElement>('img')) {
      if (!image.getAttribute('src')) continue
      try {
        await image.decode()
      } catch {
        throw new Error(`Export contract: image failed to decode (${image.currentSrc.slice(0, 120)}).`)
      }
      if (!image.naturalWidth || !image.naturalHeight) {
        throw new Error('Export contract: image has no decoded dimensions.')
      }
    }
    const metricsStarted = Date.now()
    let stableMetricFrames = 0
    while (stableMetricFrames < 3) {
      const legal = Array.from(stage.querySelectorAll<HTMLElement>('.slide-legal, .slide-subheading, .slide-logo')).filter(element => element.getBoundingClientRect().width > 0)
      const failed = legal.find(element => element.dataset.legalMetricError)
      if (failed) throw new Error(`Relative text sizing: ${failed.dataset.legalMetricError}`)
      stableMetricFrames = legal.some(element => element.dataset.relativeLegalReady === 'false') ? 0 : stableMetricFrames + 1
      if (Date.now() - metricsStarted > 10000) throw new Error('Relative glyph measurements did not settle.')
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    }
    // Allow font metrics, ResizeObserver and fitted headings to settle.
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    return { fonts: [...requests.values()].map(({ family, descriptor }) => ({ family, descriptor })) }
  })
}
