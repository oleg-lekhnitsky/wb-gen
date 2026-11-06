import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {stripTypeScriptTypes} from 'node:module'
import {chromium} from 'playwright'

test('video uses delayed line entrance and staggered highlight timing independently of capture speed',async()=>{
  const source=await readFile(new URL('../server/api/render-browser.post.ts',import.meta.url),'utf8')
  const helpers=stripTypeScriptTypes(source.slice(source.indexOf('          const clamp ='),source.indexOf('          const setCtaTransition =')))
  const browser=await chromium.launch({headless:true});const page=await browser.newPage()
  try{
    await page.setContent(`<style>.slide-content{color:white}.animated-copy-word{--copy-enter-delay:260ms;--copy-enter-duration:65ms;--copy-duration:325ms;--word-delay:0ms;--highlight-delay:650ms;--heading-highlight-color:#ff00ff}.second{--word-delay:80ms;--highlight-stagger:120ms}</style><div class="slot-slide"><div class="slide-content"><span class="animated-copy-word has-heading-highlight--white-pink">One</span><span class="animated-copy-word has-heading-highlight--white-pink second" style="--word-delay:80ms">Two</span></div></div>`)
    await page.addScriptTag({content:`window.seekVideo=(ms)=>{const rawProgress=0,transitionSeconds=.65,textLineTransition=true,portrait=false,curve={x1:.76,y1:0,x2:.24,y2:1},copyUnitSelector='.animated-copy-word';${helpers};setCopyUnits(document.querySelector('.slot-slide'),'entering',ms/650)}`})
    const sample=(ms:number)=>page.evaluate(ms=>{(window as any).seekVideo(ms);return [...document.querySelectorAll<HTMLElement>('.animated-copy-word')].map(el=>({opacity:Number(el.style.opacity),highlight:Number(el.style.getPropertyValue('--video-highlight-progress'))}))},ms)
    assert.equal((await sample(200))[0]!.opacity,0)
    const stagger=await sample(300)
    assert.ok(stagger[0]!.opacity>0)
    assert.equal(stagger[1]!.opacity,0)
    const highlights=await sample(750)
    assert.ok(highlights[0]!.highlight>0)
    assert.equal(highlights[1]!.highlight,0)
    assert.deepEqual(await sample(750),highlights,'seeking backwards and forwards must be deterministic')
    assert.ok((await sample(1200)).every(unit=>unit.opacity===1&&unit.highlight===1))
  }finally{await browser.close()}
})

test('video regular logo honors its entrance delay for motion and opacity',async()=>{
  const {runInNewContext}=await import('node:vm')
  const source=await readFile(new URL('../server/api/render-browser.post.ts',import.meta.url),'utf8')
  const helpers=stripTypeScriptTypes(source.slice(source.indexOf('          const clamp ='),source.indexOf('          const setCtaTransition =')))
  let progress=0
  const logo={style:{opacity:''},__seekBrandLogo:(value:number)=>{progress=value}}
  const values:Record<string,string>={'--logo-enter-delay':'120ms','--logo-animation-duration':'1400ms','--logo-enter-duration':'840ms'}
  const seek=runInNewContext(helpers+'\nsetBrandLogos',{rawProgress:0,transitionSeconds:1.4,curve:{x1:.76,y1:0,x2:.073,y2:1.012},getComputedStyle:()=>({getPropertyValue:(key:string)=>values[key]||''})})
  const slide={querySelectorAll:()=>[logo]}
  seek(slide,'entering',100/1400)
  assert.equal(progress,0)
  assert.equal(Number(logo.style.opacity),0)
  seek(slide,'entering',200/1400)
  assert.ok(Math.abs(progress-80/1400)<1e-10)
  assert.ok(Number(logo.style.opacity)>0)
  seek(slide,'entering',1520/1400)
  assert.ok(Math.abs(progress-1)<1e-10)
})
