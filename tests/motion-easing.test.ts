import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {stripTypeScriptTypes} from 'node:module'
import {runInNewContext} from 'node:vm'
import {motionEasingPresets,defaultMotionCurve} from '../app/utils/motion-easing.ts'

test('Smooth uses the approved curve with a subtle settle',async()=>{
  assert.deepEqual(motionEasingPresets.map(preset=>preset.label),['Smooth'])
  assert.deepEqual([...motionEasingPresets[0].values],[.76,0,.073,1.012])
  const source=await readFile(new URL('../server/api/render-browser.post.ts',import.meta.url),'utf8')
  const fn=source.slice(source.indexOf('function cubicBezier('),source.indexOf('\nexport default defineEventHandler'))
  const sample=runInNewContext(stripTypeScriptTypes(fn+'\ncubicBezier'))
  const values=Array.from({length:1001},(_,index)=>sample(index/1000,defaultMotionCurve))
  assert.ok(Math.abs(values[0]!)<1e-10)
  assert.ok(Math.abs(values.at(-1)!-1)<1e-10)
  assert.ok(Math.min(...values)>=0)
  assert.ok(Math.max(...values)>1&&Math.max(...values)<1.025)
  const settings=JSON.parse(await readFile(new URL('../app/assets/default-layout-settings.json',import.meta.url),'utf8'))
  assert.deepEqual(settings.curve,defaultMotionCurve)
})
