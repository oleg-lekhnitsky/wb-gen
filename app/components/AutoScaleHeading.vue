<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { fitHeading, headingFitsAtScale } from '~/utils/heading-fit'

type CopyWord = {
  text: string
  start: number
  end: number
  animationIndex: number
  breakAfter: boolean
  highlightIndex?: number
  highlight?: 'white-pink' | 'purple-white'
}

type FittedLine = {
  words: CopyWord[]
}

const props = defineProps<{
  words: CopyWord[]
  headingSize: number
  delays: number[]
}>()

const createFallbackLines = (words: CopyWord[]): FittedLine[] => (
  words.map(word => ({ words: [word] }))
)

const source = ref<HTMLElement | null>(null)
const sourceWords = ref<HTMLElement[]>([])
const fittedLines = ref<HTMLElement[]>([])
const lines = ref<FittedLine[]>(createFallbackLines(props.words))
const headingScale = ref(1)
let resizeObserver: ResizeObserver | undefined
let measureFrame = 0
let measureVersion = 0
let mutationObserver: MutationObserver | undefined

function getLayoutWidth(element: HTMLElement) {
  const computedWidth = Number.parseFloat(getComputedStyle(element).width)
  if (Number.isFinite(computedWidth) && computedWidth > 0) return computedWidth
  return element.offsetWidth
}

function setSourceWord(element: unknown, index: number) {
  if (element instanceof HTMLElement) sourceWords.value[index] = element
}

function setFittedLine(element: unknown, index: number) {
  if (element instanceof HTMLElement) fittedLines.value[index] = element
}

function relativeHeight(element: HTMLElement, headingSize: number) {
  const ratio = Number(element.dataset.relativeFontRatio)
  const style = getComputedStyle(element)
  if (style.display === 'none' || style.position === 'absolute') return 0
  if (!(ratio > 0)) return element.offsetHeight
  if (element.dataset.relativeLogoWidthRatio) return headingSize * ratio
  const fontSize = Math.ceil(headingSize * ratio * 100) / 100
  if (fontSize <= 0) return 0
  // Measure wrapping outside the stage so probes never retrigger Vue observers.
  const probe = element.cloneNode(true) as HTMLElement
  probe.removeAttribute('id')
  probe.className = ''
  probe.style.cssText = ''
  for (const property of ['font-family','font-weight','font-style','font-stretch','font-variation-settings','font-feature-settings','letter-spacing','text-transform','white-space','word-break','overflow-wrap']) {
    probe.style.setProperty(property, style.getPropertyValue(property))
  }
  Object.assign(probe.style, { position:'fixed', visibility:'hidden', pointerEvents:'none', left:'0', top:'0', display:'block',
    width:`${parseFloat(style.width)}px`, height:'auto', margin:'0', padding:'0', border:'0',
    fontSize:`${fontSize}px`, lineHeight:style.lineHeight === 'normal' ? 'normal' : String(parseFloat(style.lineHeight) / parseFloat(style.fontSize) || 1) })
  document.body.appendChild(probe)
  const height = probe.offsetHeight
  probe.remove()
  return height
}

function availableHeadingHeight(sourceElement: HTMLElement, headingSize?: number) {
  const copy = sourceElement.closest<HTMLElement>('.slide-copy')
  const panel = copy?.closest<HTMLElement>('.slide-content')
  if (!copy || !panel) return 0
  const css = getComputedStyle(panel)
  const extent = (element: HTMLElement) => {
    const style = getComputedStyle(element)
    if (style.display === 'none' || style.position === 'absolute') return 0
    return (headingSize === undefined ? element.offsetHeight : relativeHeight(element, headingSize)) + (parseFloat(style.marginTop) || 0) + (parseFloat(style.marginBottom) || 0)
  }
  const subheading = copy.querySelector<HTMLElement>('.slide-subheading')
  let height: number
  if (css.display === 'grid') {
    // Narrow banners place the copy and logo beside each other in row one.
    height = parseFloat(css.gridTemplateRows) || 0
  } else {
    const footer = Array.from(panel.children).filter(child => child !== copy)
      .reduce((sum, child) => sum + extent(child as HTMLElement), 0)
    height = panel.clientHeight - (parseFloat(css.paddingTop) || 0)
      - (parseFloat(css.paddingBottom) || 0) - footer
  }
  return Math.max(0, height - (subheading ? extent(subheading) : 0) - 1)
}

function measureLines() {
  const version = ++measureVersion
  cancelAnimationFrame(measureFrame)
  measureFrame = requestAnimationFrame(async () => {
    await nextTick()
    if (version !== measureVersion) return
    const sourceElement = source.value
    const elements = sourceWords.value.slice(0, props.words.length)
    if (!sourceElement || elements.length !== props.words.length || !elements.length) return
    const width = sourceElement.clientWidth
    if (width <= 0) return
    const height = availableHeadingHeight(sourceElement)
    const lineHeight = parseFloat(getComputedStyle(sourceElement).lineHeight)
    const measured = elements.map((element, index) => ({
      width: getLayoutWidth(element),
      gap: parseFloat(getComputedStyle(element).marginRight) || 0,
      breakAfter: props.words[index]!.breakAfter
    }))
    if (measured.some(word => word.width <= 0)) return
    const panel = sourceElement.closest('.slide-content')
    const hasRelative = Array.from(panel?.querySelectorAll<HTMLElement>('[data-relative-font-ratio]') || [])
      .some(element => getComputedStyle(element).display !== 'none')
    let fittedHeight = height, fittedWidth = width, scaleLimit = 1
    if (hasRelative) {
      const maximumFont = parseFloat(getComputedStyle(sourceElement).fontSize)
      const grid = panel && getComputedStyle(panel).display === 'grid'
      const logo = panel?.querySelector<HTMLElement>('.slide-logo[data-relative-logo-width-ratio]')
      const budgetWidth = (scale: number) => grid && logo && getComputedStyle(logo).display !== 'none'
        ? Math.max(0, width + logo.offsetWidth - maximumFont * scale * Number(logo.dataset.relativeLogoWidthRatio)) : width
      let low = 0, high = 1
      for (let iteration = 0; iteration < 18; iteration++) {
        const scale = (low + high) / 2
        const budget = availableHeadingHeight(sourceElement, maximumFont * scale)
        const logoFits = Array.from(panel?.querySelectorAll<HTMLElement>('[data-relative-logo-width-ratio]') || [])
          .filter(element => getComputedStyle(element).display !== 'none')
          .every(element => grid
            ? maximumFont * scale * Number(element.dataset.relativeFontRatio) <= (parseFloat(getComputedStyle(panel!).gridTemplateRows) || 0)
            : maximumFont * scale * Number(element.dataset.relativeLogoWidthRatio) <= element.clientWidth)
        if (logoFits && headingFitsAtScale(measured, budgetWidth(scale), budget, lineHeight, scale)) low = scale
        else high = scale
      }
      scaleLimit = low
      fittedHeight = availableHeadingHeight(sourceElement, maximumFont * scaleLimit)
      fittedWidth = budgetWidth(scaleLimit)
    }
    const fitted = fitHeading(measured, fittedWidth, fittedHeight, lineHeight)
    lines.value = fitted.lines.map(indices => ({ words: indices.map(index => props.words[index]!) }))
    headingScale.value = Math.min(scaleLimit, fitted.scale)
    // Correct rounding against final browser layout without exceeding the cap.
    for (let pass = 0; pass < 2; pass++) {
      await nextTick()
      if (version !== measureVersion) return
      const rendered = fittedLines.value.slice(0, fitted.lines.length)
      const widest = Math.max(0, ...rendered.map(getLayoutWidth))
      const heading = rendered[0]?.closest<HTMLElement>('h2')
      const actualHeight = heading?.offsetHeight || 0
      const correction = Math.min(1, widest > 0 ? fittedWidth / widest : 1,
        actualHeight > 0 ? fittedHeight / actualHeight : 1)
      if (correction >= 1) break
      headingScale.value *= correction
    }
  })
}

function observeLayout() {
  resizeObserver?.disconnect()
  if (source.value) resizeObserver?.observe(source.value)
  const panel = source.value?.closest('.slide-content')
  if (!panel) return
  resizeObserver?.observe(panel)
  panel.querySelectorAll<HTMLElement>('.slide-logo, .slide-cta, .slide-legal, .slide-subheading')
    .forEach(element => resizeObserver?.observe(element))
}

watch(
  () => props.words,
  (words) => {
    lines.value = createFallbackLines(words)
    headingScale.value = 1
    measureLines()
  },
  { deep: true }
)

watch(() => props.headingSize, measureLines)

onMounted(() => {
  resizeObserver = new ResizeObserver(measureLines)
  observeLayout()
  mutationObserver = new MutationObserver(() => { observeLayout(); measureLines() })
  const copy = source.value?.closest('.slide-copy')
  const panel = copy?.closest('.slide-content')
  if (panel) mutationObserver.observe(panel, { attributes: true, attributeFilter: ['class', 'style'], childList: true })
  if (copy) mutationObserver.observe(copy, { childList: true })
  document.fonts?.ready.then(measureLines)
  measureLines()
})

onBeforeUnmount(() => {
  ++measureVersion
  mutationObserver?.disconnect()
  resizeObserver?.disconnect()
  cancelAnimationFrame(measureFrame)
})
</script>

<template>
  <h2
    ref="source"
    class="animated-copy-block word-fit-heading__source"
    :style="{ '--heading-scale': headingSize / 100 }"
    aria-hidden="true"
  >
    <span
      v-for="(word, index) in words"
      :key="`source-${index}`"
      :ref="element => setSourceWord(element, index)"
      class="word-fit-heading__source-word"
      :class="{ 'has-word-gap': !word.breakAfter }"
    >{{ word.text }}<br v-if="word.breakAfter"></span>
  </h2>

  <h2
    class="animated-copy-block word-fit-heading"
    :style="{
      '--heading-scale': headingSize / 100,
      '--word-fit-scale': headingScale
    }"
  >
    <span
      v-for="(line, lineIndex) in lines"
      :key="`line-${lineIndex}`"
      :ref="element => setFittedLine(element, lineIndex)"
      class="word-fit-heading__line"
    >
      <span
        v-for="(word, wordIndex) in line.words"
        :key="`heading-${word.start}-${word.end}`"
        class="animated-copy-word"
        :class="[
          { 'has-word-gap': wordIndex < line.words.length - 1 },
          word.highlight ? `has-heading-highlight--${word.highlight}` : ''
        ]"
        :style="{ '--word-delay': `${delays[word.animationIndex] ?? 0}ms`, '--highlight-stagger': `${(word.highlightIndex ?? 0) * 120}ms` }"
      >{{ word.text }}</span>
    </span>
  </h2>
</template>
