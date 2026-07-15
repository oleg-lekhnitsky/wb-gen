<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  text?: string
  size?: number
  pulse?: boolean
  animate?: boolean
  align?: 'left' | 'right'
  bottomMargin?: boolean
}>(), {
  text: '',
  size: 100,
  pulse: false,
  animate: true,
  align: 'right',
  bottomMargin: false
})

const element = ref<HTMLElement | null>(null)
const fittedWidth = ref<string>()
let animationFrame: number | undefined
let resizeObserver: ResizeObserver | undefined
let observedParent: HTMLElement | null = null
let observedParentWidth = 0

function observeParent() {
  const parent = element.value?.parentElement
  if (!parent || parent === observedParent) return
  resizeObserver?.disconnect()
  observedParent = parent
  observedParentWidth = parent.getBoundingClientRect().width
  resizeObserver?.observe(parent)
}

async function fitWrappedText() {
  fittedWidth.value = undefined
  await nextTick()
  if (animationFrame !== undefined) cancelAnimationFrame(animationFrame)

  animationFrame = requestAnimationFrame(() => {
    animationFrame = undefined
    const target = element.value
    if (!target) return
    observeParent()

    const range = document.createRange()
    range.selectNodeContents(target)
    const lines = [...range.getClientRects()].filter(rect => rect.width > 0)
    if (lines.length < 2) return

    const computed = getComputedStyle(target)
    const horizontalPadding = Number.parseFloat(computed.paddingLeft)
      + Number.parseFloat(computed.paddingRight)
    const longestLine = Math.max(...lines.map(line => line.width))
    fittedWidth.value = `${Math.ceil(longestLine + horizontalPadding)}px`
  })
}

watch(() => [props.text, props.size], fitWrappedText)

onMounted(() => {
  resizeObserver = new ResizeObserver((entries) => {
    const nextWidth = entries[0]?.contentRect.width || 0
    if (Math.abs(nextWidth - observedParentWidth) < 0.5) return
    observedParentWidth = nextWidth
    void fitWrappedText()
  })
  void document.fonts.ready.then(fitWrappedText)
  void fitWrappedText()
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  if (animationFrame !== undefined) cancelAnimationFrame(animationFrame)
})
</script>

<template>
  <span
    v-if="text"
    ref="element"
    class="slide-cta"
    :class="{
      'is-pulsing': pulse,
      'has-transition': animate,
      'is-aligned-left': align === 'left',
      'is-aligned-right': align === 'right',
      'has-bottom-margin': bottomMargin
    }"
    :style="{
      '--cta-scale': size / 100,
      width: fittedWidth
    }"
  >
    {{ text }}
  </span>
</template>
