/** Browser measurements are authoritative; the importer must never choose layout. */
export async function measureFigmaBanner(stage: HTMLElement, width: number, height: number) {
  await document.fonts.ready
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
  const root = stage.getBoundingClientRect()
  const sx = width / root.width, sy = height / root.height
  const fontScale = width / parseFloat(getComputedStyle(stage).width)
  if (Math.abs(sx - sy) > 0.01) throw new Error('Figma export requires a uniform stage scale.')
  const bounds = (el: Element, origin = root) => {
    const r = el.getBoundingClientRect()
    return { x: (r.x-origin.x)*sx, y:(r.y-origin.y)*sy, width:r.width*sx, height:r.height*sy }
  }
  const visible = (el: HTMLElement) => {
    for (let node: HTMLElement | null = el; node && node !== stage; node = node.parentElement) {
      const s = getComputedStyle(node)
      if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false
    }
    return el.getBoundingClientRect().width > 0
  }
  const rgba = (value: string) => {
    const parts = value.match(/[\d.]+/g)?.map(Number) || []
    return { r:(parts[0]||0)/255, g:(parts[1]||0)/255, b:(parts[2]||0)/255, a:parts[3] ?? 1 }
  }
  const asset = async (src: string) => {
    const response = await fetch(src)
    if (!response.ok) throw new Error('Could not read an export image.')
    const blob = await response.blob()
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob)
    })
  }
  const panels = []
  for (const panel of stage.querySelectorAll<HTMLElement>('.slot-panel')) {
    const slide = panel.querySelector<HTMLElement>('.slot-slide.is-active')
    if (!slide) throw new Error('No active slide to export.')
    const rect = panel.getBoundingClientRect(), style = getComputedStyle(slide)
    if (style.backgroundImage !== 'none') throw new Error('Figma export currently supports solid panel backgrounds. Split/checker backgrounds need an explicit exporter.')
    if (slide.querySelector('video')) throw new Error('Video is not supported by the editable still exporter.')
    const layers: any[] = []
    const logos: any[] = []
    for (const image of slide.querySelectorAll<HTMLImageElement>('img')) {
      if (!visible(image)) continue
      await image.decode()
      const data = await asset(image.src)
      const isSvg = data.startsWith('data:image/svg+xml')
      const target = image.closest('.slide-logo') ? logos : layers
      target.push({ type:isSvg?'svg':'image', name:image.closest('.slide-logo')?'Logo':'Photo', ...bounds(image,rect), data })
    }
    if (slide.classList.contains('has-bottom-fade')) layers.push({type:'fade',name:'Bottom fade',x:0,y:rect.height*sy*.42,width:rect.width*sx,height:rect.height*sy*.58})
    layers.push(...logos)
    const cta = slide.querySelector<HTMLElement>('.slide-cta')
    if (cta?.classList.contains('is-pulsing')) throw new Error('Turn off button pulse before exporting a still banner.')
    if (cta && visible(cta)) layers.push({type:'rect',name:'CTA background',...bounds(cta,rect),color:rgba(getComputedStyle(cta).backgroundColor),radius:Math.min(cta.getBoundingClientRect().height*sy/2,999)})
    const textBlocks = new Map<Element, any[]>()
    for (const el of slide.querySelectorAll<HTMLElement>('.slide-content *')) {
      if (!visible(el) || el.closest('[aria-hidden="true"]')) continue
      const s=getComputedStyle(el)
      const shadows = s.textShadow === 'none' ? [] : s.textShadow.split(/,(?![^()]*\))/).map(value => {
        const color = value.match(/rgba?\([^)]*\)/)?.[0]
        const lengths = value.replace(color || '', '').match(/-?[\d.]+px/g)?.map(parseFloat)
        if (!color || !lengths || lengths.length < 2) throw new Error('Could not read CSS text shadow.')
        return { color: rgba(color), x: lengths[0]! * fontScale, y: lengths[1]! * fontScale, blur: (lengths[2] || 0) * fontScale }
      })
      if (el.classList.contains('has-heading-highlight--white-pink') || el.classList.contains('has-heading-highlight--purple-white')) {
        const highlight = getComputedStyle(el, '::before')
        const box = bounds(el, rect)
        const color = rgba(highlight.backgroundColor)
        for (let n: HTMLElement | null = el; n && n !== slide; n = n.parentElement) color.a *= Number(getComputedStyle(n).opacity)
        color.a *= Number(highlight.opacity)
        layers.push({type:'rect',name:'Heading highlight',
          x:box.x + parseFloat(highlight.left) * fontScale,
          y:box.y + parseFloat(highlight.top) * fontScale,
          width:parseFloat(highlight.width) * fontScale,
          height:parseFloat(highlight.height) * fontScale,
          radius:parseFloat(highlight.borderTopLeftRadius) * fontScale,color})
      }
      const family=s.fontFamily.split(',')[0]!.trim().replace(/^["']|["']$/g,'')
      const variations=Object.fromEntries([...s.fontVariationSettings.matchAll(/"(.{4})"\s+(-?[\d.]+)/g)].map(m=>[m[1],Number(m[2])]))
      // The web alias is Inter 4.1's "Inter Variable", not Figma's legacy "Inter".
      // Keep optical sizing at the unscaled CSS font size when output dimensions differ.
      if (family === 'InterVariable' && variations.opsz === undefined) {
        variations.opsz = s.fontOpticalSizing === 'none' ? 14 : Math.max(14, Math.min(32, parseFloat(s.fontSize)))
      }
      for(const node of el.childNodes) {
        if(node.nodeType!==Node.TEXT_NODE || !node.textContent?.trim())continue
        const text=node.textContent
        const faces=await document.fonts.load(`${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${JSON.stringify(family)}`,text)
        if(!faces.length)throw new Error(`Required font ${family} is not loaded.`)
        const lines: Array<{text:string,x:number,y:number,width:number,height:number,armenian:boolean}> = []
        for(let i=0;i<text.length;i++){
          const range=document.createRange();range.setStart(node,i);range.setEnd(node,i+1)
          const r=range.getBoundingClientRect();if(!r.height)continue
          const value=s.textTransform==='uppercase'?text[i]!.toUpperCase():text[i]!
          const previous=lines.at(-1)
          const armenian = /[\u0530-\u058F\uFB13-\uFB17]/.test(value) || (/\s/.test(value) && Boolean(previous?.armenian))
          const x=(r.x-rect.x)*sx,y=(r.y-rect.y)*sy
          if(previous&&previous.armenian===armenian&&Math.abs(previous.y-y)<.5){previous.text+=value;previous.width=Math.max(previous.width,x+r.width*sx-previous.x)}
          else lines.push({text:value,x,y,width:r.width*sx,height:r.height*sy,armenian})
        }
        let opacity=1
        for(let n:HTMLElement|null=el;n&&n!==slide;n=n.parentElement)opacity*=Number(getComputedStyle(n).opacity)
        for(const line of lines){
          if(!line.text.trim())continue
          // Range bounds describe the font's em box, not the CSS line box.
          // Preserve tight leading (notably legal copy) and its baseline placement.
          const cssLineHeight = parseFloat(s.lineHeight)
          const lineHeight = Number.isFinite(cssLineHeight) ? cssLineHeight * fontScale : line.height
          const y = line.y + (line.height - lineHeight) / 2
          const owner = el.closest('h2, .slide-subheading, .slide-legal, .slide-cta, .slide-logo') || el
          const fragments = textBlocks.get(owner) || []
          textBlocks.set(owner, fragments)
          fragments.push({type:'text',name:el.closest('.slide-legal')?'Legal':el.closest('.slide-cta')?'CTA text':el.closest('.slide-subheading')?'Subheading':'Headline',...line,y,font:line.armenian ? {family:'Google Sans',weight:700,style:'normal',variations:{}} : {family,weight:Number(s.fontWeight),style:s.fontStyle,variations},shadows,fontSize:parseFloat(s.fontSize)*fontScale,letterSpacing:(parseFloat(s.letterSpacing)||0)*fontScale,lineHeight,color:rgba(s.color),opacity,text:line.text})
        }
      }
    }
    for (const fragments of textBlocks.values()) {
      const first = fragments[0]
      let text = '', previous: any
      const runs: any[] = []
      const measuredLines: any[] = []
      for (const fragment of fragments) {
        const newLine = previous && Math.abs(fragment.y - previous.y) > .5
        if (newLine) text += '\n'
        else if (previous && fragment.x > previous.x + previous.width + .5 && !/\s$/.test(text) && !/^\s/.test(fragment.text)) text += ' '
        const start = text.length
        text += fragment.text
        runs.push({start,end:text.length,font:fragment.font,fontSize:fragment.fontSize,lineHeight:fragment.lineHeight,letterSpacing:fragment.letterSpacing,color:fragment.color,opacity:fragment.opacity})
        if (!previous || newLine) measuredLines.push({start,width:fragment.width})
        else measuredLines.at(-1).width = Math.max(measuredLines.at(-1).width, fragment.x + fragment.width - first.x)
        previous = fragment
      }
      const x = Math.min(...fragments.map(f=>f.x)), y = Math.min(...fragments.map(f=>f.y))
      layers.push({...first,x,y,width:Math.max(...fragments.map(f=>f.x+f.width))-x,height:Math.max(...fragments.map(f=>f.y+f.lineHeight))-y,text,runs,measuredLines})
    }
    panels.push({name:panel.classList.contains('slot-panel--visual-start')?'First panel':'Second panel',...bounds(panel),color:rgba(style.backgroundColor),layers})
  }
  const warnings: string[] = []
  const overlay = stage.querySelector<HTMLElement>('.packshot-overlay')
  if (overlay && visible(overlay)) {
    const svg = overlay.querySelector<SVGSVGElement>('svg')
    const canvas = overlay.querySelector<HTMLCanvasElement>('canvas')
    const graphic = svg || canvas
    if (!graphic) throw new Error('The packshot has not finished loading. Try again in a moment.')
    const position = bounds(graphic)
    const data = svg
      ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`
      : canvas!.toDataURL('image/png')
    panels.push({ name:'Packshot', ...position, color:{r:0,g:0,b:0,a:0}, layers:[{
      type:svg?'svg':'image', name:'Packshot still', x:0,y:0,width:position.width,height:position.height,data
    }] })
    if (canvas) warnings.push('Canvas packshot captured as a still image. Use the SVG packshot renderer for vector packshot layers.')
  }
  return {version:1,name:`${width} × ${height}`,width,height,panels,source:{stageWidth:root.width,stageHeight:root.height,scale:sx},warnings}
}
