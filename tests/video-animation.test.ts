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
