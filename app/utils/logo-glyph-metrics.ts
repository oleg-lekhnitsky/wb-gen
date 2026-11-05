/** Read the existing b outline; never rewrite the logo's paths or viewBox. */
export function measureLogoB(svgMarkup: string) {
  const parsed = new DOMParser().parseFromString(svgMarkup, 'image/svg+xml')
  const svg = document.importNode(parsed.documentElement, true) as unknown as SVGSVGElement
  Object.assign(svg.style, { position:'fixed', visibility:'hidden', pointerEvents:'none', left:'0', top:'0' })
  document.body.appendChild(svg)
  try {
    const b = svg.querySelector<SVGGraphicsElement>('g[clip-path] > path:last-of-type')
    const height = b?.getBBox().height || 0
    if (!(height > 0)) throw new Error('Could not measure the default logo b outline.')
    return { bHeight:height, width:svg.viewBox.baseVal.width, height:svg.viewBox.baseVal.height }
  } finally { svg.remove() }
}
