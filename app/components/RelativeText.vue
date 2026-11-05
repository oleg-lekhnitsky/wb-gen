<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import logoSvg from '~/assets/wb taxi.svg?raw'
import { measureLogoB } from '~/utils/logo-glyph-metrics'
import { measureGlyphRatio, measureLoadedGlyphRatio } from '~/utils/glyph-metrics'
import wbMedium from '~/assets/WBSans-Medium.otf?url'
import wbBold from '~/assets/WBSans-Bold.otf?url'
import roboto from '~/assets/WBResizerLegalCondensed-Regular.ttf?url'
import armenian from '~/assets/GoogleSans-Bold.ttf?url'
const props = defineProps<{ relative?: boolean, ratio?: number, headingSize?: number, kind?: 'legal' | 'subheading' | 'logo' }>()
const root = ref<HTMLElement | null>(null)
const measuredFontSize = ref<string>()
const measuredLogoWidth = ref<string>()
let logoMetrics: ReturnType<typeof measureLogoB> | undefined
let observer: MutationObserver | undefined
let resize: ResizeObserver | undefined
let frame = 0, revision = 0
async function update(version: number) {
  const element = root.value
  if (!element) return
  if (!props.relative) {
    measuredFontSize.value = undefined
    measuredLogoWidth.value = undefined
    delete element.dataset.relativeLogoWidthRatio
    delete element.dataset.legalMetricError
    delete element.dataset.relativeLegalReady
    delete element.dataset.relativeFontRatio
    return
  }
  const stage = element.closest('.slot-stage')
  const ownSlide = element.closest('.slot-slide')
  const ownPanel = ownSlide?.parentElement
  const index = ownPanel && ownSlide ? Array.from(ownPanel.children).filter(node => node.classList.contains('slot-slide')).indexOf(ownSlide) : -1
  // Match the same slide in both panels, including premeasured inactive slides.
  // Animated transforms and another slide becoming active must not change sizes.
  const matchingSlides = Array.from(stage?.querySelectorAll('.slot-panel') || []).map(panel =>
    Array.from(panel.children).filter(node => node.classList.contains('slot-slide'))[index])
  const heading = matchingSlides.flatMap(slide => Array.from(slide?.querySelectorAll<HTMLElement>('.slide-copy h2:not(.word-fit-heading__source)') || []))
    .find(node => node.offsetWidth > 0 && getComputedStyle(node).display !== 'none')
  const text = heading?.querySelector<HTMLElement>('.animated-copy-word') || heading
  const headingStyle = text ? getComputedStyle(text) : undefined
  const legalStyle = getComputedStyle(element)
  const subheading = props.kind === 'subheading'
  const size = headingStyle ? parseFloat(headingStyle.fontSize)
    : (stage?.classList.contains('is-ultra-narrow') ? 32 : 56) * (props.headingSize ?? 100) / 100
  const hasArmenian = (value: string) => /[\u0530-\u058F\uFB13-\uFB17]/.test(value)
  const hasOther = (value: string) => /[A-Za-z\u0400-\u052F]/.test(value) || !hasArmenian(value)
  const headingText = heading?.textContent || ''
  const legalText = element.textContent || ''
  const references: Promise<number>[] = [], capitals: Promise<number>[] = []
  if (hasArmenian(headingText)) references.push(measureGlyphRatio(armenian, '700', 'normal', 'Ա'))
  if (hasOther(headingText)) {
    const weight = Number(headingStyle?.fontWeight || 500) >= 700 ? '700' : '500'
    references.push(measureGlyphRatio(weight === '700' ? wbBold : wbMedium, weight, 'normal', 'H'))
  }
  if (props.kind !== 'logo' && hasArmenian(legalText)) capitals.push(measureGlyphRatio(armenian, '700', 'normal', 'Ա'))
  if (props.kind !== 'logo' && hasOther(legalText)) {
    if (subheading) {
      const family = legalStyle.fontFamily.split(',')[0]!.trim().replace(/^["']|["']$/g, '')
      capitals.push(measureLoadedGlyphRatio(family, legalStyle.fontWeight, parseFloat(legalStyle.fontSize), 'H'))
    } else capitals.push(measureGlyphRatio(roboto, legalStyle.fontWeight, legalStyle.fontVariationSettings, 'H'))
  }
  try {
    const [referenceRatios, capitalRatios] = await Promise.all([Promise.all(references), Promise.all(capitals)])
    if (version !== revision || !root.value) return
    // Mixed scripts use the tallest heading reference and shortest legal caps.
    const referenceHeight = size * Math.max(...referenceRatios)
    if (props.kind === 'logo') {
      logoMetrics ||= measureLogoB(logoSvg)
      const referenceRatio = Math.max(...referenceRatios)
      const widthRatio = referenceRatio * logoMetrics.width / logoMetrics.bHeight
      measuredLogoWidth.value = `${size * widthRatio}px`
      element.dataset.relativeFontRatio = String(referenceRatio * logoMetrics.height / logoMetrics.bHeight)
      element.dataset.relativeLogoWidthRatio = String(widthRatio)
      element.dataset.headingReferenceHeight = String(referenceHeight)
      element.dataset.logoBHeight = String(referenceHeight)
      element.dataset.relativeLegalReady = 'true'
      delete element.dataset.legalMetricError
      return
    }
    const capRatio = Math.min(...capitalRatios)
    const coefficient = Math.max(...referenceRatios) * (props.ratio ?? 50) / 100 / capRatio
    element.dataset.relativeFontRatio = String(coefficient)
    const fontSize = Math.ceil(size * coefficient * 100) / 100
    const value = `${fontSize}px`
    if (measuredFontSize.value !== value) measuredFontSize.value = value
    element.dataset.headingReferenceHeight = String(referenceHeight)
    element.dataset.legalCapHeight = String(fontSize * capRatio)
    element.dataset.relativeLegalReady = 'true'
    delete element.dataset.legalMetricError
  } catch (error) {
    if (version !== revision) return
    element.dataset.legalMetricError = error instanceof Error ? error.message : 'Relative legal measurement failed.'
  }
}
function schedule() {
  ++revision
  if (props.relative && root.value) root.value.dataset.relativeLegalReady = 'false'
  // Coalesce updates without repeatedly cancelling the next measurement frame.
  if (frame) return
  frame = requestAnimationFrame(() => { frame = 0; void update(revision) })
}
watch(() => [props.relative, props.ratio, props.headingSize], schedule)
function observeHeading() {
  observer?.disconnect(); resize?.disconnect()
  const stage = root.value?.closest('.slot-stage')
  if (!props.relative || !stage) { schedule(); return }
  root.value!.dataset.relativeLegalReady = 'false'
  observer = new MutationObserver(records => {
    if (records.some(record => {
      const target = record.target instanceof Element ? record.target : record.target.parentElement
      if (!target || (target === root.value && record.type === 'attributes')) return false
      // Lottie updates SVG styles every animation frame. Those changes have no
      // bearing on heading metrics and must not invalidate pending measurements.
      return !!target.closest('.slide-copy') || target.matches('.slot-stage, .slot-slide, .slide-content')
        || (target === root.value && record.type !== 'attributes')
    })) schedule()
  })
  observer.observe(stage, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['style', 'class'] })
  resize = new ResizeObserver(schedule); resize.observe(stage)
  schedule()
}
watch(() => props.relative, observeHeading)
onMounted(() => { observeHeading(); document.fonts.ready.then(schedule) })
onBeforeUnmount(() => { ++revision; observer?.disconnect(); resize?.disconnect(); cancelAnimationFrame(frame) })
</script>
<template>
  <component :is="kind === 'logo' ? 'div' : 'p'" ref="root"
    :data-relative-legal="relative && kind !== 'logo' && kind !== 'subheading' ? 'true' : undefined"
    :class="kind === 'logo' ? 'slide-logo' : kind === 'subheading' ? 'slide-subheading' : 'slide-legal'"
    :style="{ fontSize: relative ? measuredFontSize : undefined, '--relative-logo-width': relative ? measuredLogoWidth : undefined }"><slot /></component>
</template>
