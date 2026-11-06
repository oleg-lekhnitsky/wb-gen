<script setup lang="ts">
import type { AnimationItem } from 'lottie-web'
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
const props = defineProps<{ src:string, animationData:()=>object, tone:'default'|'white'|'purple', duration:number }>()
const root = ref<HTMLElement|null>(null)
const canvas = ref<HTMLElement|null>(null)
const playing = ref(false)
let animation:AnimationItem|undefined
let observer:MutationObserver|undefined
const logoEnterDelayMs = 120
let entranceTimer: ReturnType<typeof setTimeout> | undefined
let active = false
let disposed = false
function fitArtwork() {
  if(!animation?.isLoaded)return
  animation.goToAndStop(30,true)
  const svg=canvas.value?.querySelector('svg')
  const box=svg?.getBBox()
  if(svg && box && box.width>0 && box.height>0)svg.setAttribute('viewBox',`${box.x} ${box.y} ${box.width} ${box.height}`)
}
function sync() {
  if ((window as any).__slotAnimationVideoCapture) { animation?.pause(); return }
  const slide=root.value?.closest('.slot-slide')
  const snapping=Boolean(root.value?.closest('.is-snapping, .aspect-preview-card__design'))
  if(snapping) {
    clearTimeout(entranceTimer)
    // Capture can interrupt the entrance on any frame. Freeze the underlying
    // SVG too: capture tools may inspect it even while the fallback is visible.
    fitArtwork()
    playing.value=false
    active=false
    return
  }
  const next=Boolean(slide?.classList.contains('is-active')) && !snapping
  if(next && !active && animation?.isLoaded) {
    // Hidden panels have no measurable artwork at mount. Fit after they enter.
    fitArtwork()
    playing.value=true
    clearTimeout(entranceTimer)
    animation.goToAndStop(0,true)
    entranceTimer=setTimeout(()=>{
      if(disposed || !active)return
      animation!.setSpeed(1 / Math.max(.1,props.duration))
      animation!.playSegments([0,30],true)
    },logoEnterDelayMs)
  } else if(!next) {
    clearTimeout(entranceTimer)
    // Hold the animated artwork throughout the outgoing slide transition.
    // Restore the fallback only once the slide is fully offscreen.
    const leaving=Boolean(slide?.classList.contains('is-leaving')) && !snapping
    if(!leaving)playing.value=false
    animation?.pause()
  }
  active=next
}
onMounted(async()=>{
  const {default:lottie}=await import('lottie-web')
  if(disposed || !canvas.value)return
  const data=props.animationData() as any
  // The outer slide already provides entrance movement. Keep the logo's
  // horizontal parent at its settled position while its letters animate.
  const parent=data.layers?.find((layer:any)=>layer.nm==='Null 1')
  const position=parent?.ks?.p
  if(position?.a && Array.isArray(position.k)) {
    const final=position.k.at(-1)
    position.a=0
    position.k=[...(final.s || position.k.at(-2)?.e || position.k.at(-2)?.s)]
    delete position.x
  }
  // Apply the same palette inversion as the static SVG.
  function recolor(value:any) {
    if(!value || typeof value!=='object')return
    if(value.ty==='fl' && Array.isArray(value.c?.k)) {
      const c=value.c.k
      const white=c[0]===1 && c[1]===1 && c[2]===1
      const pink=c[0]===1 && c[1]===0 && c[2]===1
      if(props.tone==='white')value.c.k=white?[1,0,1]:pink?[1,1,1]:c
      if(props.tone==='purple' && pink)value.c.k=[127/255,48/255,227/255]
    }
    for(const child of Object.values(value))recolor(child)
  }
  recolor(data)
  animation=lottie.loadAnimation({container:canvas.value,renderer:'svg',autoplay:false,loop:false,animationData:data,rendererSettings:{preserveAspectRatio:'xMinYMax meet'}})
  animation.addEventListener('DOMLoaded',()=>{
    if(disposed)return
    // Align the animation's settled artwork to the static logo bounds.
    fitArtwork()
    animation!.addEventListener('complete',()=>{animation!.goToAndStop(30,true)})
    if ((window as any).__slotAnimationVideoCapture && root.value) {
      playing.value=true
      ;(root.value as any).__seekBrandLogo=(progress:number)=>{
        fitArtwork()
        animation!.goToAndStop(30*Math.max(0,Math.min(1,progress)),true)
      }
      root.value.dataset.logoReady='true'
    }
    active=false
    sync()
  })
  observer=new MutationObserver(sync)
  const stage=root.value?.closest('.slot-stage')
  if(stage)observer.observe(stage,{attributes:true,attributeFilter:['class'],subtree:true})
})
watch(()=>props.src,()=>{playing.value=false})
onBeforeUnmount(()=>{disposed=true;clearTimeout(entranceTimer);observer?.disconnect();animation?.destroy()})
</script>

<template>
  <div ref="root" class="animated-brand-logo" :class="{'is-playing':playing}"
    :style="{'--logo-enter-delay': `${logoEnterDelayMs}ms`, '--logo-enter-duration': `${duration * 600}ms`, '--logo-animation-duration': `${duration * 1000}ms`}">
    <img :src="src" alt="">
    <div ref="canvas" class="animated-brand-logo__motion" aria-hidden="true" />
  </div>
</template>

<style scoped>
.animated-brand-logo{position:relative;max-width:100%;opacity:0}
.slot-slide.is-active .animated-brand-logo{
  opacity:1;
  transition:opacity var(--logo-enter-duration) var(--transition-curve,cubic-bezier(.76,0,.24,1)) var(--logo-enter-delay);
}
.slot-slide.is-leaving .animated-brand-logo{opacity:1;transition:none}
.is-snapping .animated-brand-logo{opacity:1;transition:none}
.animated-brand-logo>img{width:100%;height:auto;display:block}
.animated-brand-logo__motion{position:absolute;inset:0;visibility:hidden;pointer-events:none}
.animated-brand-logo.is-playing>img{visibility:hidden}
.animated-brand-logo.is-playing .animated-brand-logo__motion{visibility:visible}
.is-snapping .animated-brand-logo>img{visibility:visible}
.is-snapping .animated-brand-logo__motion{visibility:hidden}
@media(prefers-reduced-motion:reduce){.animated-brand-logo{opacity:1;transition:none!important}.animated-brand-logo.is-playing>img{visibility:visible}.animated-brand-logo.is-playing .animated-brand-logo__motion{visibility:hidden}}
</style>
