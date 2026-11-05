import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chromium } from 'playwright'
import { assertExportAssetsReady } from '../server/utils/export-contract.ts'

test('export assets: loaded font passes; missing font and broken image fail', async () => {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  try {
    const font = await readFile(new URL('../app/assets/WBSans-Medium.otf', import.meta.url))
    await page.setContent(`
      <style>
        @font-face { font-family: ExportTest; src: url(data:font/otf;base64,${font.toString('base64')}); }
        .slot-stage--main { font-family: ExportTest; }
      </style>
      <main class="slot-stage--main"><h2>Great rides. Small prices.</h2></main>
    `)
    const ready = await assertExportAssetsReady(page)
    assert.equal(ready.fonts[0]?.family, 'ExportTest')

    await page.locator('h2').evaluate(element => { element.style.fontFamily = 'MissingExportFont, Arial' })
    await assert.rejects(assertExportAssetsReady(page), /required font MissingExportFont is unavailable/)

    await page.locator('h2').evaluate(element => { element.style.fontFamily = 'ExportTest' })
    await page.locator('main').evaluate(element => {
      const image = document.createElement('img')
      image.src = 'data:image/png;base64,broken'
      element.appendChild(image)
    })
    await assert.rejects(assertExportAssetsReady(page), /image failed to decode/)
  } finally {
    await browser.close()
  }
})

test('Figma measurements preserve line breaks and ignore preview zoom', async () => {
  const { measureFigmaBanner } = await import('../app/utils/figma-export.ts')
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  try {
    const font = await readFile(new URL('../app/assets/WBSans-Medium.otf', import.meta.url))
    await page.setContent(`<style>
      @font-face {font-family:ExportTest;src:url(data:font/otf;base64,${font.toString('base64')})}
      #stage {width:520px;height:650px;transform-origin:top left}
      .slot-panel {width:520px;height:650px;position:relative}
      .slot-slide {position:absolute;inset:0;background:rgb(255,0,255)}
      .slide-content {font-family:ExportTest;font-size:20px;line-height:24px}
      .slide-legal {width:130px}
    </style><div id="stage"><div class="slot-panel slot-panel--visual-start"><article class="slot-slide is-active"><div class="slide-content"><p class="slide-legal">Great rides at small prices every day</p><p style="display:none">Hidden text</p></div></article></div></div>`)
    await page.addScriptTag({ content: `window.measureBanner = ${measureFigmaBanner.toString()}` })
    const measure = () => page.evaluate(async () => {
      const win = window as Window & { measureBanner: typeof measureFigmaBanner }
      return win.measureBanner(document.querySelector<HTMLElement>('#stage')!, 520, 650)
    })
    const normal = await measure()
    await page.locator('#stage').evaluate(el => { el.style.transform = 'scale(.5)' })
    const zoomed = await measure()
    const first = normal.panels[0]!.layers.filter(layer => layer.type === 'text')
    const second = zoomed.panels[0]!.layers.filter(layer => layer.type === 'text')
    assert.equal(first.length, 1, 'the wrapped paragraph exports one text block')
    assert.ok(first[0]!.text.includes('\n'))
    assert.deepEqual(first.map(layer => layer.text), second.map(layer => layer.text))
    assert.ok(first.every(layer => layer.fontSize === 20))
    assert.ok(second.every(layer => layer.fontSize === 20))
    assert.ok(!first.some(layer => layer.text.includes('Hidden')))
    for (let i = 0; i < first.length; i++) {
      assert.ok(Math.abs(first[i]!.x - second[i]!.x) < .05)
      assert.ok(Math.abs(first[i]!.y - second[i]!.y) < .05)
    }
  } finally { await browser.close() }
})

test('format placement defaults, validation and size keys', async () => {
  const { defaultContentPlacement, normalizeContentPlacement, placementKey, placementClasses } = await import('../app/utils/content-placement.ts')
  assert.deepEqual(defaultContentPlacement(360, 640), { copy:'first', logo:'first', cta:'second', legal:'second', background1:'first', background2:'second' })
  assert.equal(defaultContentPlacement(728, 90).cta, 'first')
  assert.notEqual(placementKey(250,250), placementKey(320,320), 'exact dimension keys remain available for backward-compatible migration')
  assert.deepEqual(normalizeContentPlacement({logo:'second',cta:'hidden',legal:'invalid'},360,640), {copy:'first',logo:'second',cta:'second',legal:'second',background1:'first',background2:'second'})
  assert.deepEqual(placementClasses({copy:'first',logo:'first',cta:'second',legal:'hidden'},'second'), {'hide-copy':true,'hide-logo':true,'hide-cta':false,'hide-legal':true})
  const placement=defaultContentPlacement(360,640)
  assert.equal(placementClasses(placement,'first',{heading:'  ',subheading:''})['hide-copy'],true)
  assert.equal(placementClasses(placement,'first',{subheading:'Visible'})['hide-copy'],false)
  assert.equal(placementClasses(placement,'second',{ctaText:'  ',legalText:''})['hide-cta'],true)
  assert.equal(placementClasses(placement,'second',{ctaText:'Book'})['hide-cta'],false)
})

test('Armenian uses Google Sans Bold while Latin retains WB Sans, including Figma runs', async () => {
  const { measureFigmaBanner } = await import('../app/utils/figma-export.ts')
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  try {
    const wb = (await readFile(new URL('../app/assets/WBSans-Medium.otf', import.meta.url))).toString('base64')
    const armenian = (await readFile(new URL('../app/assets/GoogleSans-Bold.ttf', import.meta.url))).toString('base64')
    await page.setContent(`<style>
      @font-face{font-family:WBSans;src:url(data:font/otf;base64,${wb});font-weight:500}
      @font-face{font-family:WBSans;src:url(data:font/ttf;base64,${armenian});font-weight:500;unicode-range:U+0530-058F,U+FB13-FB17}
      #stage,.slot-panel{width:520px;height:650px} .slot-slide{background:rgb(255,0,255)}
      h2{font-family:WBSans;font-size:30px;font-weight:500}
    </style><div id="stage"><div class="slot-panel"><article class="slot-slide is-active"><div class="slide-content"><h2>Բարև WB</h2></div></article></div></div>`)
    await page.evaluate(() => document.fonts.ready)
    const session = await page.context().newCDPSession(page)
    await session.send('DOM.enable')
    await session.send('CSS.enable')
    const document = await session.send('DOM.getDocument')
    const { nodeId } = await session.send('DOM.querySelector', { nodeId: document.root.nodeId, selector: 'h2' })
    const { fonts } = await session.send('CSS.getPlatformFontsForNode', { nodeId })
    assert.ok(fonts.some(font => /GoogleSans.*Bold/.test(font.postScriptName) && font.glyphCount > 0), JSON.stringify(fonts))
    assert.ok(fonts.some(font => /WBSans.*Medium/i.test(font.postScriptName) && font.glyphCount > 0))
    await page.addScriptTag({ content: `window.measureBanner = ${measureFigmaBanner.toString()}` })
    const output = await page.evaluate(() => (window as Window & { measureBanner: typeof measureFigmaBanner }).measureBanner(document.querySelector<HTMLElement>('#stage')!, 520, 650))
    const blocks = output.panels[0]!.layers.filter(layer => layer.type === 'text')
    assert.equal(blocks.length,1)
    const runs = blocks.flatMap(layer=>layer.runs.map((run:any)=>({...run,text:layer.text.slice(run.start,run.end)})))
    assert.ok(runs.some(run => run.text.includes('Բարև') && run.font.family === 'Google Sans' && run.font.weight === 700))
    assert.ok(runs.some(run => run.text.includes('WB') && run.font.family === 'WBSans' && run.font.weight === 500))
  } finally { await browser.close() }
})

test('current-slide snapshots exclude other slides and scope the final packshot correctly', async () => {
  const { currentSlideSnapshot } = await import('../app/utils/current-slide-snapshot.ts')
  const source = { panelSlides:{left:[{heading:'First'},{heading:'Second'},{heading:'Last'}],right:[{heading:'A'},{heading:'B'},{heading:'C'}]},selectedIndex:1,requestedSlideCount:3,showPackshotOnFinalSlide:true,sharedContentSlides:[{heading:'One'},{heading:'Two'},{heading:'Three'}],aspectSlideSettings:{'1:1':{left:[{heading:'X'},{heading:'Y'},{heading:'Z'}],right:[{}, {}, {}]}} }
  const middle = currentSlideSnapshot(source,1)
  assert.equal(middle.panelSlides.left.length,1)
  assert.equal(middle.panelSlides.left[0]!.heading,'Second')
  assert.equal(middle.panelSlides.right[0]!.heading,'B')
  assert.equal(middle.sharedContentSlides![0]!.heading,'Two')
  assert.equal(middle.aspectSlideSettings!['1:1']!.left[0]!.heading,'Y')
  assert.equal(middle.selectedIndex,0)
  assert.equal(middle.requestedSlideCount,1)
  assert.equal(middle.showPackshotOnFinalSlide,false)
  assert.equal(currentSlideSnapshot(source,2).showPackshotOnFinalSlide,true)
  middle.panelSlides.left[0]!.heading='Changed'
  assert.equal(source.panelSlides.left[1]!.heading,'Second')
  assert.throws(()=>currentSlideSnapshot(source,3),/valid slide/)
})

test('visible packshots export as a frozen SVG or canvas asset, hidden packshots are omitted', async () => {
  const { measureFigmaBanner } = await import('../app/utils/figma-export.ts')
  const browser = await chromium.launch({ headless:true })
  const page = await browser.newPage()
  try {
    await page.setContent(`<style>#stage{position:relative;width:520px;height:650px}.slot-panel,.slot-slide{width:520px;height:650px;background:rgb(255,0,255)}.packshot-overlay{position:absolute;left:100px;top:200px;width:100px;height:80px}</style><div id="stage"><div class="slot-panel"><div class="slot-slide is-active"></div></div><div class="packshot-overlay"><svg width="100" height="80" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="80" fill="red"/></svg></div></div>`)
    await page.addScriptTag({content:`window.measureBanner = ${measureFigmaBanner.toString()}`})
    const measure = () => page.evaluate(() => (window as Window & {measureBanner:typeof measureFigmaBanner}).measureBanner(document.querySelector<HTMLElement>('#stage')!,520,650))
    const svg = await measure()
    assert.equal(svg.panels.at(-1)!.name,'Packshot')
    assert.equal(svg.panels.at(-1)!.layers[0].type,'svg')
    assert.equal(svg.panels.at(-1)!.x,100)
    await page.locator('.packshot-overlay').evaluate(el=>{el.innerHTML='<canvas width="100" height="80"></canvas>'})
    const canvas = await measure()
    assert.equal(canvas.panels.at(-1)!.layers[0].type,'image')
    assert.ok(canvas.warnings.some(warning=>warning.includes('Canvas packshot')))
    await page.locator('.packshot-overlay').evaluate(el=>{el.style.opacity='0'})
    assert.ok(!(await measure()).panels.some(panel=>panel.name==='Packshot'))
  } finally { await browser.close() }
})

test('copy stagger finishes within the slide transition, including long and subheading-only copy', async () => {
  const { copyAnimationTiming } = await import('../app/utils/copy-animation.ts')
  for (const [heading,subheading,total] of [[4,8,650],[40,30,100],[0,5,200],[1,0,650],[0,0,650]]) {
    const timing = copyAnimationTiming(heading!,subheading!,total!)
    const delays = [...timing.heading,...timing.subheading]
    assert.ok(timing.duration > 0)
    assert.ok(delays.every(delay=>delay>=0&&delay+timing.duration<=total!+.001))
    assert.ok(delays.every((delay,index)=>index===0||delay>=delays[index-1]!))
    if(!heading&&subheading)assert.equal(timing.subheading[0],0)
  }
})

test('copy stagger groups rendered lines, including soft wraps and explicit breaks', async () => {
  const { copyLineIndices, copyAnimationTiming } = await import('../app/utils/copy-animation.ts')
  const indices = copyLineIndices([20,20,20,75,75,130])
  assert.deepEqual(indices,[0,0,0,1,1,2])
  assert.deepEqual(copyLineIndices([20,21,75,76]),[0,0,1,1])
  const timing = copyAnimationTiming(3,2,650)
  const delays = indices.map(line=>timing.heading[line])
  assert.equal(delays[0],delays[2])
  assert.ok(delays[3]! > delays[2]!)
  assert.ok(delays[5]! > delays[4]!)
  assert.ok([...timing.heading,...timing.subheading].every(delay=>delay+timing.duration<=650))
})


test('legal export preserves tight CSS leading and Roboto Flex axes at output scale', async () => {
  const { measureFigmaBanner } = await import('../app/utils/figma-export.ts')
  const browser = await chromium.launch({ headless:true })
  const page = await browser.newPage()
  try {
    const font = (await readFile(new URL('../app/assets/RobotoFlex.ttf', import.meta.url))).toString('base64')
    await page.setContent(`<style>
      @font-face{font-family:"Roboto Flex";src:url(data:font/ttf;base64,${font});font-weight:100 1000;font-stretch:25% 151%}
      #stage,.slot-panel{width:520px;height:650px}.slot-slide{background:white}
      .slide-legal{margin:0;font-family:"Roboto Flex";font-size:20px;line-height:18px;text-shadow:0 1px 3px rgba(0,0,0,.35);font-variation-settings:"opsz" 50,"wdth" 25,"wght" 400}
    </style><div id="stage"><div class="slot-panel"><div class="slot-slide is-active"><div class="slide-content"><p class="slide-legal">WB TAXI<br>LEGAL TEXT</p></div></div></div></div>`)
    await page.addScriptTag({content:`window.measureBanner = ${measureFigmaBanner.toString()}`})
    const output = await page.evaluate(() => (window as Window & {measureBanner:typeof measureFigmaBanner}).measureBanner(document.querySelector<HTMLElement>('#stage')!,1040,1300))
    const lines = output.panels[0]!.layers.filter(layer=>layer.type==='text')
    assert.equal(lines.length,1)
    assert.equal(lines[0]!.text,'WB TAXI\nLEGAL TEXT')
    assert.ok(lines.every(line=>line.fontSize===40 && line.lineHeight===36))
    assert.equal(lines[0]!.font.variations.wdth,25)
    assert.equal(lines[0]!.font.variations.opsz,50)
    assert.equal(lines[0]!.height,72)
    assert.deepEqual(lines[0]!.shadows,[{color:{r:0,g:0,b:0,a:.35},x:0,y:2,blur:6}])
    assert.ok(Math.abs(lines[0]!.y)<.05,'first line starts at the CSS line box')
  } finally { await browser.close() }
})


test('animated word spans become a single editable heading with spaces and line breaks', async () => {
  const { measureFigmaBanner } = await import('../app/utils/figma-export.ts')
  const browser = await chromium.launch({headless:true})
  try {
    const page = await browser.newPage()
    const font = (await readFile(new URL('../app/assets/WBSans-Medium.otf',import.meta.url))).toString('base64')
    await page.setContent(`<style>@font-face{font-family:Test;src:url(data:font/otf;base64,${font})}#stage,.slot-panel{width:520px;height:650px}.slot-slide{background:white}h2{font:20px/24px Test;margin:0}span{display:inline-block;margin-right:5px}</style><div id="stage"><div class="slot-panel"><div class="slot-slide is-active"><div class="slide-content"><h2><span>Great</span><span>rides</span><br><span>every</span><span>day</span></h2></div></div></div></div>`)
    await page.addScriptTag({content:`window.measureBanner = ${measureFigmaBanner.toString()}`})
    const output = await page.evaluate(()=>(window as any).measureBanner(document.querySelector('#stage'),520,650))
    const blocks=output.panels[0].layers.filter((l:any)=>l.type==='text')
    assert.equal(blocks.length,1)
    assert.equal(blocks[0].text,'Great rides\nevery day')
    assert.equal(blocks[0].runs.length,4)
  } finally {await browser.close()}
})


test('copy entrance waits briefly without delaying exit or exceeding the transition', async () => {
  const { copyAnimationTiming } = await import('../app/utils/copy-animation.ts')
  for (const total of [100,650,1200]) {
    const timing = copyAnimationTiming(3,2,total)
    assert.equal(timing.enterDelay,total*.4)
    assert.equal(timing.heading[0],0,'exit starts without the entrance pause')
    assert.ok(timing.enterDuration>0)
    for (const delay of [...timing.heading,...timing.subheading]) {
      assert.ok(delay+timing.enterDelay+timing.enterDuration<=total+.001)
    }
  }
  assert.equal(copyAnimationTiming(2,1,650).enterDelay,260)
})

test('background placement swaps occupied panels and preserves legacy swapped layouts', async () => {
  const {defaultContentPlacement,normalizeContentPlacement,updateContentPlacement,backgroundSource}=await import('../app/utils/content-placement.ts')
  const initial=defaultContentPlacement(360,640)
  assert.equal(normalizeContentPlacement({copy:'hidden'},360,640).copy,'first')
  assert.deepEqual(updateContentPlacement(initial,'copy','hidden'),initial)
  const swapped=updateContentPlacement(initial,'background2','first')
  assert.equal(swapped.background1,'second')
  assert.equal(backgroundSource(swapped,'first'),'right')
  assert.equal(backgroundSource(swapped,'second'),'left')
  assert.equal(swapped.copy,initial.copy)
  const hidden=updateContentPlacement(swapped,'background2','hidden')
  assert.deepEqual(hidden,swapped)
  const restored=normalizeContentPlacement({background1:'hidden',background2:'first'},360,640)
  assert.equal(restored.background1,'second')
  assert.equal(restored.background2,'first')
  const bothHidden=normalizeContentPlacement({background1:'hidden',background2:'hidden'},360,640)
  assert.equal(bothHidden.background1,'first')
  assert.equal(bothHidden.background2,'second')
  const legacy=normalizeContentPlacement({copy:'first'},360,640,true)
  assert.equal(legacy.background1,'second')
  assert.equal(legacy.background2,'first')
})

test('heading auto-fit balances whole words within width, height and the size cap', async () => {
  const {fitHeading}=await import('../app/utils/heading-fit.ts')
  const words=[50,120,20,100,140].map(width=>({width,gap:10,breakAfter:false}))
  const fitted=fitHeading(words,240,70,40)
  assert.ok(fitted.scale>0 && fitted.scale<=1)
  assert.deepEqual(fitted.lines.flat(),[0,1,2,3,4])
  assert.ok(fitted.lines.length*40*fitted.scale<=70+.001)
  for(const line of fitted.lines) {
    const width=line.reduce((sum,index,i)=>sum+words[index]!.width+(i?10:0),0)*fitted.scale
    assert.ok(width<=240+.001)
  }
  assert.deepEqual(fitHeading(words.slice(0,2),240,100,40).lines,[[0,1]],'short words can join longer words')
  assert.equal(fitHeading(words.slice(0,2),1000,1000,40).scale,1,'never enlarge beyond the slider cap')
  const forced=fitHeading([{width:50,gap:10,breakAfter:true},{width:50,gap:10,breakAfter:false}],500,100,40)
  assert.deepEqual(forced.lines,[[0],[1]],'manual line breaks remain mandatory')
  assert.equal(fitHeading(words,240,0,40).scale,0,'no overflow when other content consumes the panel')
})

test('Figma importer reports font resolution and exact width diagnostics without resizing text', async () => {
  const {runInNewContext}=await import('node:vm')
  const source=await readFile(new URL('../figma-plugin/importer.js',import.meta.url),'utf8')
  const importBanner=runInNewContext(source+'\nimportBanner')
  let id=0
  const node=()=>({id:String(++id),width:125,height:20,x:0,y:0,resize(width:number,height:number){this.width=width;this.height=height},appendChild(){},remove(){}})
  const font={family:'Roboto Flex',weight:400,variations:{opsz:50}}
  const figma={
    listAvailableFontsAsync:async()=>[{fontName:{family:'Roboto Flex',style:'Regular'}}],
    getFontFamilyVariationAxes:async()=>['wght'],loadFontAsync:async()=>{},
    createFrame:node,createText:()=>({...node(),getStyledTextSegments:()=>[{start:0,end:3,fontName:{family:'Roboto Flex',style:'Regular',variationSettings:{wght:400}},fontSize:20}]}),
    currentPage:{children:[]},viewport:{scrollAndZoomIntoView(){}}
  }
  const result=await importBanner(figma,{version:1,name:'Test',width:100,height:100,panels:[{name:'First panel',width:100,height:100,x:0,y:0,color:{r:1,g:1,b:1,a:1},layers:[{type:'text',name:'Legal',text:'ABC',font,fontSize:20,lineHeight:18,letterSpacing:0,width:100,x:0,y:0,color:{r:0,g:0,b:0,a:1},opacity:1}]}]})
  assert.equal(result.status,'needs-review')
  assert.equal(result.fontDiagnostics[0].unsupportedAxes.join(','),'opsz')
  assert.equal(result.textDiagnostics[0].browserWidth,100)
  assert.equal(result.textDiagnostics[0].figmaWidth,125)
  assert.equal(result.textDiagnostics[0].widthError,25)
  assert.equal(result.textDiagnostics[0].resolvedFonts[0].fontSize,20)
})

test('heading highlights export editable backgrounds and colored text at output scale', async () => {
  const {measureFigmaBanner}=await import('../app/utils/figma-export.ts')
  const browser=await chromium.launch({headless:true})
  try {
    const page=await browser.newPage()
    const font=(await readFile(new URL('../app/assets/WBSans-Medium.otf',import.meta.url))).toString('base64')
    await page.setContent(`<style>
      @font-face{font-family:Test;src:url(data:font/otf;base64,${font})}
      #stage,.slot-panel{width:520px;height:650px}.slot-slide{background:rgb(255,0,255)}
      h2{font:20px/24px Test;margin:0}.animated-copy-word{display:inline-block;position:relative}
      .has-heading-highlight--white-pink{color:rgb(255,0,255)}
      .has-heading-highlight--purple-white{color:white}
      .animated-copy-word::before{position:absolute;inset:-.02em -.18em;border-radius:.24em;content:'';background:white}
      .has-heading-highlight--purple-white::before{background:rgb(127,48,227)}
    </style><div id="stage"><div class="slot-panel"><div class="slot-slide is-active"><div class="slide-content"><h2><span class="animated-copy-word has-heading-highlight--white-pink">Great</span> <span class="animated-copy-word has-heading-highlight--purple-white">rides</span></h2></div></div></div></div>`)
    await page.addScriptTag({content:`window.measureBanner=${measureFigmaBanner.toString()}`})
    const output=await page.evaluate(()=>(window as any).measureBanner(document.querySelector('#stage'),1040,1300))
    const layers=output.panels[0].layers
    const highlights=layers.filter((l:any)=>l.name==='Heading highlight')
    assert.equal(highlights.length,2)
    assert.deepEqual(highlights[0].color,{r:1,g:1,b:1,a:1})
    assert.deepEqual(highlights[1].color,{r:127/255,g:48/255,b:227/255,a:1})
    assert.ok(Math.abs(highlights[0].radius-9.6)<.1)
    assert.ok(Math.abs(highlights[0].x+7.2)<.1)
    assert.ok(Math.abs(highlights[0].y+.8)<.1)
    const text=layers.find((l:any)=>l.type==='text')
    assert.equal(text.text,'Great rides')
    assert.deepEqual(text.runs[0].color,{r:1,g:0,b:1,a:1})
    assert.deepEqual(text.runs.at(-1).color,{r:1,g:1,b:1,a:1})
    assert.ok(layers.indexOf(highlights[0])<layers.indexOf(text))
  } finally {await browser.close()}
})

test('pasted banner text flattens whitespace and removes invisible copying artifacts', async () => {
  const {cleanPastedText}=await import('../app/utils/text-paste.ts')
  assert.equal(cleanPastedText('\uFEFF  Great\r\n\r\nrides\t\u00A0small  prices\u200B '),'Great rides small prices')
  assert.equal(cleanPastedText('выбирайте\nмаршрут'),'выбирайте маршрут')
  assert.equal(cleanPastedText('կյանքը\nգեղեցիկ է'),'կյանքը գեղեցիկ է')
  assert.equal(cleanPastedText('👨‍👩‍👧‍👦'),'👨‍👩‍👧‍👦','preserve meaningful emoji joiners')
})

test('Apply to all sets narrow logo defaults only when copying from regular banners', async () => {
  const {logoWidthForApplyAll}=await import('../app/utils/logo-width.ts')
  assert.equal(logoWidthForApplyAll(1080,1350,'728x90',57),30)
  assert.equal(logoWidthForApplyAll(1080,1350,'8:1',57),30)
  assert.equal(logoWidthForApplyAll(1080,1350,'120x600',57),100)
  assert.equal(logoWidthForApplyAll(1080,1350,'1:4',57),100)
  assert.equal(logoWidthForApplyAll(1080,1350,'1920x1080',57),57)
  assert.equal(logoWidthForApplyAll(728,90,'728x90',42),42)
  assert.equal(logoWidthForApplyAll(120,600,'728x90',42),42)
})

test('legal glyph metrics follow variable axes and match rendered capital ink height', async () => {
  const {measureGlyphRatio}=await import('../app/utils/glyph-metrics.ts')
  const browser=await chromium.launch({headless:true})
  try {
    const page=await browser.newPage({deviceScaleFactor:1})
    const font=(await readFile(new URL('../app/assets/RobotoFlex.ttf',import.meta.url))).toString('base64')
    const wb=(await readFile(new URL('../app/assets/WBSans-Medium.otf',import.meta.url))).toString('base64')
    await page.setContent('<div id="probe" style="position:absolute;left:0;top:0;width:200px;height:180px;background:white;color:black">H</div>')
    await page.addScriptTag({content:`const metricFaces=new Map();let metricFaceId=0;window.glyphRatio=${measureGlyphRatio.toString()}`})
    const result=await page.evaluate(async({font,wb})=>{
      const source=`data:font/ttf;base64,${font}`, wbSource=`data:font/otf;base64,${wb}`
      const variation='"opsz" 50,"wdth" 25,"YTUC" 760'
      const measure=(window as any).glyphRatio
      const small=await measure(source,'400','"opsz" 50,"wdth" 25,"YTUC" 528','H')
      const tall=await measure(source,'400',variation,'H')
      const x=await measure(wbSource,'500','normal','x'),cap=await measure(wbSource,'500','normal','H')
      const face=new FontFace('RenderedLegal',`url(${source})`,{weight:'400'})
      await face.load();document.fonts.add(face)
      const probe=document.querySelector<HTMLElement>('#probe')!
      probe.style.font='400 100px/150px RenderedLegal';probe.style.fontVariationSettings=variation
      return {small,tall,x,cap}
    },{font,wb})
    assert.ok(result.tall>result.small,'custom YTUC axis must affect measured capitals')
    assert.ok(result.cap>result.x,'heading x-height and cap height are distinct')
    const sharp=(await import('sharp')).default
    const pixels=await sharp(await page.locator('#probe').screenshot()).ensureAlpha().raw().toBuffer({resolveWithObject:true})
    let top=180,bottom=-1
    for(let y=0;y<180;y++)for(let x=0;x<200;x++){
      const i=(y*200+x)*4
      if(pixels.data[i]!<128&&pixels.data[i+1]!<128&&pixels.data[i+2]!<128){top=Math.min(top,y);bottom=Math.max(bottom,y)}
    }
    assert.ok(Math.abs(bottom-top+1-result.tall*100)<1.5,'measured cap height matches actual CSS-rendered glyph ink')
  } finally {await browser.close()}
})

test('relative subheading metrics recover from zero and tiny rendered font sizes', async () => {
  const {measureLoadedGlyphRatio}=await import('../app/utils/glyph-metrics.ts')
  const browser=await chromium.launch({headless:true})
  try {
    const page=await browser.newPage()
    const font=(await readFile(new URL('../app/assets/WBSans-Medium.otf',import.meta.url))).toString('base64')
    await page.evaluate(async font=>{
      const face=new FontFace('SubheadingMetricTest',`url(data:font/otf;base64,${font})`,{weight:'500'})
      await face.load();document.fonts.add(face)
    },font)
    await page.addScriptTag({content:`window.measureLoadedGlyphRatio=${measureLoadedGlyphRatio.toString()}`})
    const ratios=await page.evaluate(async()=>Promise.all([0,.1,1,20,100].map(size=>(window as any).measureLoadedGlyphRatio('SubheadingMetricTest','500',size,'H'))))
    for(const ratio of ratios){assert.ok(Number.isFinite(ratio)&&ratio>0);assert.ok(Math.abs(ratio-ratios[0])<.0001)}
  } finally {await browser.close()}
})

test('relative logo measures the original b outline without altering logo geometry', async () => {
  const {measureLogoB}=await import('../app/utils/logo-glyph-metrics.ts')
  const svg=await readFile(new URL('../app/assets/wb taxi.svg',import.meta.url),'utf8')
  const browser=await chromium.launch({headless:true})
  try {
    const page=await browser.newPage()
    await page.addScriptTag({content:`window.measureLogoB=${measureLogoB.toString()}`})
    const metrics=await page.evaluate(svg=>(window as any).measureLogoB(svg),svg)
    assert.equal(metrics.width,290)
    assert.equal(metrics.height,83)
    assert.ok(Math.abs(metrics.bHeight-57.17574)<.001)
    const headingCap=40
    const logoWidth=headingCap*metrics.width/metrics.bHeight
    const logoHeight=headingCap*metrics.height/metrics.bHeight
    assert.ok(Math.abs(logoWidth/logoHeight-290/83)<.00001)
    assert.ok(Math.abs(logoHeight*metrics.bHeight/83-headingCap)<.00001)
    assert.equal(await page.locator('svg').count(),0,'measurement removes its temporary SVG')
  } finally {await browser.close()}
})

test('Figma plugin imports pack banners sequentially and keeps individual review results', async () => {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  try {
    const html = await readFile(new URL('../figma-plugin/ui.html', import.meta.url), 'utf8')
    await page.setContent('<iframe></iframe>')
    await page.evaluate(html => {
      ;(window as any).imports = []
      window.addEventListener('message', event => {
        if (event.data.pluginMessage?.type === 'import') (window as any).imports.push(event.data.pluginMessage.data.name)
      })
      document.querySelector('iframe')!.srcdoc = html
    }, html)
    const frame = page.frameLocator('iframe')
    await frame.locator('#file').setInputFiles({ name: 'pack.figma.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ type: 'pack', banners: [{ name: 'Portrait' }, { name: 'Landscape' }] })) })
    await page.waitForFunction(() => (window as any).imports.length === 1)
    assert.deepEqual(await page.evaluate(() => (window as any).imports), ['Portrait'])
    await page.evaluate(() => document.querySelector('iframe')!.contentWindow!.postMessage({ pluginMessage: { result: { warnings: [], status: 'needs-visual-comparison' } } }, '*'))
    await page.waitForFunction(() => (window as any).imports.length === 2)
    await page.evaluate(() => document.querySelector('iframe')!.contentWindow!.postMessage({ pluginMessage: { result: { warnings: ['Missing reference'], status: 'needs-review' } } }, '*'))
    await frame.locator('#file').waitFor()
    await page.waitForFunction(() => !(document.querySelector('iframe')!.contentDocument!.querySelector('#file') as HTMLInputElement).disabled)
    const result = JSON.parse(await frame.locator('#status').innerText())
    assert.deepEqual(result.banners.map((banner: any) => banner.name), ['Portrait', 'Landscape'])
    assert.equal(result.banners[1].status, 'needs-review')
    assert.match(result.banners[0].comparison, /Missing browser reference/)
  } finally { await browser.close() }
})

test('Figma imports start in the current viewport and accept stable pack positions', async () => {
  const { runInNewContext } = await import('node:vm')
  const source = await readFile(new URL('../figma-plugin/importer.js', import.meta.url), 'utf8')
  const importBanner = runInNewContext(source + '\nimportBanner')
  const frames: any[] = []
  const figma = {
    listAvailableFontsAsync: async () => [],
    createFrame: () => { const frame = {id:String(frames.length), x:0, y:0, width:0, height:0, resize(w:number,h:number){this.width=w;this.height=h}, remove(){}}; frames.push(frame); return frame },
    viewport: {center:{x:2500,y:-1000}, scrollAndZoomIntoView(){}},
    currentPage: {children:[{id:'existing',x:100000,width:500}]}
  }
  const data = {version:1,width:400,height:600,panels:[]}
  await importBanner(figma, data)
  assert.equal(frames[0].x,2300)
  assert.equal(frames[0].y,-1300)
  figma.viewport.center = {x:0,y:0}
  await importBanner(figma, data, {}, {x:2780,y:-1300})
  assert.equal(frames[1].x,2780)
  assert.equal(frames[1].y,-1300)
})

test('fixed legal font preserves variable-font widths and cap heights at the original axes', async () => {
  const browser = await chromium.launch({headless:true})
  const page = await browser.newPage()
  try {
    const variable = (await readFile(new URL('../app/assets/RobotoFlex.ttf',import.meta.url))).toString('base64')
    const fixed = (await readFile(new URL('../app/assets/WBResizerLegal-Regular.ttf',import.meta.url))).toString('base64')
    const result = await page.evaluate(async ({variable,fixed}) => {
      const axes='"opsz" 50,"wght" 400,"GRAD" 0,"wdth" 25,"slnt" 0,"XOPQ" 96,"YOPQ" 79,"XTRA" 468,"YTUC" 712,"YTLC" 514,"YTAS" 750,"YTDE" -203,"YTFI" 738'
      const original=new FontFace('OriginalLegal',`url(data:font/ttf;base64,${variable})`,{weight:'400',variationSettings:axes})
      const frozen=new FontFace('FrozenLegal',`url(data:font/ttf;base64,${fixed})`,{weight:'400'})
      document.fonts.add(await original.load());document.fonts.add(await frozen.load())
      const context=document.createElement('canvas').getContext('2d')!
      return [11,24,50,79,100].map(size=>{
        const measure=(family:string)=>{
          context.font=`400 ${size}px ${family}`
          const caps=context.measureText('H')
          const widths=['WB TAXI IS A TAXI BOOKING SERVICE.','WB TAXI — СЕРВИС ДЛЯ ЗАКАЗА ТАКСИ.','HTTPS://CLC.LI/ELHAE'].map(text=>context.measureText(text).width)
          return {cap:caps.actualBoundingBoxAscent+caps.actualBoundingBoxDescent,widths}
        }
        return {size,original:measure('OriginalLegal'),fixed:measure('FrozenLegal')}
      })
    },{variable,fixed})
    for(const sample of result){
      assert.ok(Math.abs(sample.original.cap-sample.fixed.cap)<.05,JSON.stringify(sample))
      sample.original.widths.forEach((width,index)=>assert.ok(Math.abs(width-sample.fixed.widths[index]!)<width*.0005+.02,JSON.stringify(sample)))
    }
  }finally{await browser.close()}
})

test('Inter subheading export preserves layout optical size at doubled output resolution', async()=>{
  const {measureFigmaBanner}=await import('../app/utils/figma-export.ts')
  const browser=await chromium.launch({headless:true});const page=await browser.newPage()
  try{
    const font=(await readFile(new URL('../app/assets/InterVariable.ttf',import.meta.url))).toString('base64')
    await page.setContent(`<style>@font-face{font-family:InterVariable;src:url(data:font/ttf;base64,${font});font-weight:100 900}#stage,.slot-panel{width:520px;height:260px}.slot-panel{position:relative}.slot-slide{position:absolute;inset:0;background:rgb(255,0,255)}.slide-subheading{font-family:InterVariable;font-weight:550;font-size:27px;font-optical-sizing:auto}</style><div id="stage"><div class="slot-panel"><div class="slot-slide is-active"><div class="slide-content"><p class="slide-subheading">чтобы видеться с близкими чаще</p></div></div></div></div>`)
    await page.addScriptTag({content:`window.measureBanner=${measureFigmaBanner.toString()}`})
    const banner=await page.evaluate(()=>(window as any).measureBanner(document.querySelector('#stage'),1040,520))
    const text=banner.panels[0].layers.find((layer:any)=>layer.name==='Subheading')
    assert.equal(text.fontSize,54)
    assert.equal(text.font.variations.opsz,27)
    assert.equal(text.font.family,'InterVariable')
  }finally{await browser.close()}
})

test('Inter web alias resolves to the bundled Inter Variable family, not legacy Inter',async()=>{
  const {runInNewContext}=await import('node:vm')
  const source=await readFile(new URL('../figma-plugin/importer.js',import.meta.url),'utf8')
  const importBanner=runInNewContext(source+'\nimportBanner')
  const node=()=>({id:'frame',x:0,y:0,width:100,height:20,resize(){},appendChild(){},getStyledTextSegments:()=>[],remove(){}})
  const figma={listAvailableFontsAsync:async()=>[],getFontFamilyVariationAxes:async(family:string)=>family==='Inter Variable'?['wght','opsz']:null,loadFontAsync:async()=>{},createFrame:node,createText:node,viewport:{center:{x:0,y:0},scrollAndZoomIntoView(){}},currentPage:{children:[]}}
  const result=await importBanner(figma,{version:1,width:100,height:100,panels:[{name:'Panel',width:100,height:100,x:0,y:0,color:{r:1,g:1,b:1,a:1},layers:[{type:'text',name:'Subheading',text:'ABC',font:{family:'InterVariable',weight:550,variations:{opsz:27}},fontSize:54,lineHeight:65,letterSpacing:0,width:100,x:0,y:0,color:{r:0,g:0,b:0,a:1},opacity:1}]}]})
  assert.equal(result.fontDiagnostics[0].resolved.family,'Inter Variable')
  assert.equal(result.fontDiagnostics[0].resolved.variationSettings.opsz,27)
  assert.equal(result.fontDiagnostics[0].resolved.variationSettings.wght,550)
})


test('placement is shared by aspect ratio across packs and migrates exact-size settings', async()=>{
  const {placementRatioKey,placementKey,migratePlacementRatios,defaultContentPlacement}=await import('../app/utils/content-placement.ts')
  assert.equal(placementRatioKey(1080,1080),placementRatioKey(300,300))
  assert.equal(placementRatioKey(1920,1080),placementRatioKey(1280,720))
  assert.notEqual(placementRatioKey(1080,1920),placementRatioKey(1920,1080))
  assert.notEqual(placementKey(300,300),placementKey(1080,1080))
  const a={...defaultContentPlacement(1080,1080),logo:'second' as const}
  const b={...a,logo:'first' as const}
  assert.equal(migratePlacementRatios({'300x300':b,'1080x1080':a},1080,1080)['1:1']!.logo,'second')
  assert.equal(migratePlacementRatios({'1080x1080':a,'1:1':b},1080,1080)['1:1']!.logo,'first')
})


test('banner typography and background settings migrate to shared aspect-ratio keys',async()=>{
  const {migrateRatioSettings,placementRatioKey}=await import('../app/utils/content-placement.ts')
  const square={headingSize:150,logoWidth:40,backgroundImageX:35,textAlign:'center'}
  const settings=migrateRatioSettings({'1080x1080':square,'300x300':{...square,headingSize:100},'1920x1080':{...square,headingSize:75}},1080,1080)
  assert.equal(settings[placementRatioKey(250,250)]!.headingSize,150)
  assert.equal(settings[placementRatioKey(300,300)]!.textAlign,'center')
  assert.equal(settings[placementRatioKey(1280,720)]!.headingSize,75)
  assert.equal(settings[placementRatioKey(250,250)]!.backgroundImageX,35)
  assert.deepEqual(Object.keys(settings).sort(),['16:9','1:1'])
})
