import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {runInNewContext} from 'node:vm'
import {stripTypeScriptTypes} from 'node:module'

async function sessionHarness(options: {read?:()=>Promise<string|null>, failApply?:boolean} = {}) {
  const source=await readFile(new URL('../app/pages/index.vue',import.meta.url),'utf8')
  const load=source.slice(source.indexOf('async function loadSettings()'),source.indexOf('\nfunction getCurrentSettings()'))
  const save=source.slice(source.indexOf('async function saveSettings()'),source.indexOf('\nfunction createPresetPayload()'))
  const writes:string[]=[], removed:string[]=[], applied:unknown[]=[]
  const api=runInNewContext(stripTypeScriptTypes(`let sessionLoaded=false,sessionRestoreFailed=false;${load}\n${save}\n({loadSettings,saveSettings})`),{
    window:{},storageKey:'session',
    readSettingsFromIndexedDb:options.read||(()=>Promise.resolve('{"name":"saved"}')),
    writeSettingsToIndexedDb:async(value:string)=>{writes.push(value)},
    applySettings:(value:unknown)=>{if(options.failApply)throw Error('restore failed');applied.push(value)},
    getCurrentSettings:()=>({name:'current'}),createLocalStorageFallbackSettings:(value:unknown)=>value,
    localStorage:{getItem:()=>null,setItem:(_key:string,value:string)=>writes.push(value),removeItem:(key:string)=>removed.push(key)},
    console:{error:()=>{}},JSON
  })
  return {api,writes,removed,applied}
}

test('unmount save cannot overwrite a session while IndexedDB restore is pending',async()=>{
  let resolve!:(value:string)=>void
  const h=await sessionHarness({read:()=>new Promise(done=>{resolve=done})})
  const loading=h.api.loadSettings()
  await h.api.saveSettings()
  assert.equal(h.writes.length,0)
  resolve('{"name":"saved"}')
  await loading
  assert.equal((h.applied[0] as any).name,'saved')
  await h.api.saveSettings()
  assert.equal(h.writes.length,2)
})

test('restore failures preserve stored data and block default-state autosaves',async()=>{
  const h=await sessionHarness({failApply:true})
  await h.api.loadSettings()
  await h.api.saveSettings()
  assert.deepEqual(h.removed,[])
  assert.deepEqual(h.writes,[])
})
