import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

test('default layouts retain the supplied three-slide pack and use generic copy',async()=>{
  const settings=JSON.parse(await readFile(new URL('../app/assets/default-layout-settings.json',import.meta.url),'utf8'))
  assert.equal(settings.panelSlides.left.length,3)
  assert.equal(settings.panelSlides.right.length,3)
  assert.equal(settings.sharedContentSlides.length,3)
  assert.equal(settings.selectedIndex,1)
  assert.equal(settings.showPackshotOnFinalSlide,true)
  assert.ok(Object.keys(settings.aspectSlideSettings).length>=20)
  assert.equal(settings.sharedContentSlides[1].heading,'write something nice here')
  assert.equal(settings.sharedContentSlides[1].subheading,'and right here')
  assert.equal(settings.sharedContentSlides[2].heading,'')
  assert.equal(settings.sharedContentSlides[2].subheading,'')
  assert.equal(settings.panelSlides.right[1].backgroundImage,'__defaultLayoutPhoto__')
  for(const group of [settings.panelSlides,...Object.values(settings.aspectSlideSettings) as any[]]){
    for(const slides of Object.values(group) as any[][])for(const slide of slides){
      assert.ok(['','write something nice here'].includes(slide.heading))
      assert.ok(['','and right here'].includes(slide.subheading))
      assert.ok(!(slide.backgroundImage||'').startsWith('data:'))
    }
  }
  const photo=await readFile(new URL('../app/assets/default-layout-photo.png',import.meta.url))
  assert.equal(photo.subarray(1,4).toString(),'PNG')
})
