import{test}from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'
import{stripTypeScriptTypes}from'node:module'
import{runInNewContext}from'node:vm'

test('fresh Space presses keep toggling when a previous keyup is missing',async()=>{
 const source=await readFile(new URL('../app/pages/index.vue',import.meta.url),'utf8')
 const handlers=source.slice(source.indexOf('let playbackSpaceHeld ='),source.indexOf('\nfunction installPlaybackShortcut()'))
 let toggles=0
 const onKey=runInNewContext(stripTypeScriptTypes(handlers+'\nhandlePlaybackShortcut'),{isSlideCapture:{value:false},sessionLoaded:true,togglePlayback:()=>toggles++})
 const event=(overrides:any={})=>({type:'keydown',code:'Space',key:' ',repeat:false,target:{closest:()=>null,isContentEditable:false},preventDefault(){},stopImmediatePropagation(){},...overrides})
 onKey(event());onKey(event())
 assert.equal(toggles,2)
 onKey(event({repeat:true}));assert.equal(toggles,2)
 onKey(event({target:{closest:()=>({readOnly:true}),isContentEditable:false}}));assert.equal(toggles,3)
 onKey(event({target:{closest:()=>({readOnly:false,disabled:false}),isContentEditable:false}}));assert.equal(toggles,3)
})
