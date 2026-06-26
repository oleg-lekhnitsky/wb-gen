<script setup lang="ts">
import type { AnimationItem } from 'lottie-web'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import packshotAnimationData from '~/assets/packshot.json'

type Slide = {
  backgroundImage: string
  backgroundColor: string
  backgroundPreset: 'solid' | 'split'
  splitAngle: number
  heading: string
  headingSize: number
  subheading: string
  logo: string
  logoWidth: number
  logoHeight: number
  legalText: string
}

type PanelSide = 'left' | 'right'
type PackshotRenderer = 'canvas' | 'svg'
type PackshotPlayback = 'once' | 'loop'
type AspectPreset = {
  label: string
  width: number
  height: number
  exportWidth: number
  exportHeight: number
}

type PersistedSettings = {
  panelSlides: Record<PanelSide, Slide[]>
  selectedPanel: PanelSide
  selectedIndex: number
  requestedSlideCount: number
  transitionSeconds: number
  pauseSeconds: number
  firstPauseSeconds: number
  curve: {
    x1: number
    y1: number
    x2: number
    y2: number
  }
  exportWidth: number
  exportHeight: number
  exportFps: number
  exportPrefix: string
  exportFormat: 'png' | 'mp4'
  aspectWidth: number
  aspectHeight: number
  reverseDirections: boolean
  swapVerticalPanels: boolean
  loopSlides: boolean
  showPackshotOnFinalSlide: boolean
  packshotWidth: number
  packshotRenderer: PackshotRenderer
  packshotPlayback: PackshotPlayback
  packshotStartFrame: number
  packshotEndFrame: number
  packshotStartOffsetSeconds: number
  packshotDurationSeconds: number
  previewWidth?: number
  previewHeight?: number
  previewViewportWidth?: number
  previewViewportHeight?: number
}

declare global {
  interface Window {
    __packshotAnimation?: AnimationItem | null
  }
}

const panelSides: PanelSide[] = ['left', 'right']
const aspectPresets: AspectPreset[] = [
  { label: '16:9', width: 16, height: 9, exportWidth: 1920, exportHeight: 1080 },
  { label: '4:3', width: 4, height: 3, exportWidth: 1600, exportHeight: 1200 },
  { label: '3:2', width: 3, height: 2, exportWidth: 1800, exportHeight: 1200 },
  { label: '1:1', width: 1, height: 1, exportWidth: 1080, exportHeight: 1080 },
  { label: '4:5', width: 4, height: 5, exportWidth: 1080, exportHeight: 1350 },
  { label: '9:16', width: 9, height: 16, exportWidth: 1080, exportHeight: 1920 }
]
const storageKey = 'slot-animation-generator-settings-v1'
const panelSlides = ref<Record<PanelSide, Slide[]>>({
  left: [
    {
      backgroundImage: '',
      backgroundColor: '#ff00ff',
      backgroundPreset: 'solid',
      splitAngle: 90,
      heading: 'Новый уровень',
      headingSize: 100,
      subheading: 'Быстро и удобно',
      logo: 'WB',
      logoWidth: 40,
      logoHeight: 52,
      legalText: 'Реклама · 18+'
    },
    {
      backgroundImage: '',
      backgroundColor: '#7f30e3',
      backgroundPreset: 'solid',
      splitAngle: 90,
      heading: 'Ваш город',
      headingSize: 100,
      subheading: 'Выбирайте маршрут',
      logo: 'WB',
      logoWidth: 40,
      logoHeight: 52,
      legalText: ''
    },
    {
      backgroundImage: '',
      backgroundColor: '#ff00ff',
      backgroundPreset: 'solid',
      splitAngle: 90,
      heading: 'Ваш ритм',
      headingSize: 100,
      subheading: 'Свободный график',
      logo: 'WB',
      logoWidth: 40,
      logoHeight: 52,
      legalText: 'Подробности на сайте'
    },
    {
      backgroundImage: '',
      backgroundColor: '#7f30e3',
      backgroundPreset: 'solid',
      splitAngle: 90,
      heading: 'Поехали',
      headingSize: 100,
      subheading: 'Всё готово',
      logo: 'WB',
      logoWidth: 40,
      logoHeight: 52,
      legalText: ''
    }
  ],
  right: [
    {
      backgroundImage: '',
      backgroundColor: '#7f30e3',
      backgroundPreset: 'solid',
      splitAngle: 90,
      heading: 'Движение каждый день',
      headingSize: 100,
      subheading: 'Новые возможности',
      logo: 'Taxi',
      logoWidth: 40,
      logoHeight: 52,
      legalText: ''
    },
    {
      backgroundImage: '',
      backgroundColor: '#ff00ff',
      backgroundPreset: 'solid',
      splitAngle: 90,
      heading: 'Ваши правила',
      headingSize: 100,
      subheading: 'Начинайте поездку',
      logo: 'Taxi',
      logoWidth: 40,
      logoHeight: 52,
      legalText: 'Условия действуют в приложении'
    },
    {
      backgroundImage: '',
      backgroundColor: '#7f30e3',
      backgroundPreset: 'solid',
      splitAngle: 90,
      heading: 'Понятные условия',
      headingSize: 100,
      subheading: 'Работайте с комфортом',
      logo: 'Taxi',
      logoWidth: 40,
      logoHeight: 52,
      legalText: ''
    },
    {
      backgroundImage: '',
      backgroundColor: '#ff00ff',
      backgroundPreset: 'solid',
      splitAngle: 90,
      heading: 'Начните сейчас',
      headingSize: 100,
      subheading: 'Один шаг до старта',
      logo: 'Taxi',
      logoWidth: 40,
      logoHeight: 52,
      legalText: '18+'
    }
  ]
})

const selectedPanel = ref<PanelSide>('left')
const selectedIndex = ref(0)
const activeIndex = ref(0)
const leavingIndex = ref<number | null>(null)
const isSnappingSlides = ref(false)
const isPlaying = ref(true)
const requestedSlideCount = ref(4)
const transitionSeconds = ref(0.65)
const pauseSeconds = ref(2.35)
const firstPauseSeconds = ref(2.35)
const curve = ref({
  x1: 0.76,
  y1: 0,
  x2: 0.24,
  y2: 1
})
const exportWidth = ref(1920)
const exportHeight = ref(1080)
const exportFps = ref(30)
const exportPrefix = ref('slot-animation')
const exportFormat = ref<'png' | 'mp4'>('mp4')
const aspectWidth = ref(16)
const aspectHeight = ref(9)
const reverseDirections = ref(false)
const swapVerticalPanels = ref(false)
const loopSlides = ref(true)
const showPackshotOnFinalSlide = ref(false)
const packshotWidth = ref(28)
const packshotRenderer = ref<PackshotRenderer>('canvas')
const packshotPlayback = ref<PackshotPlayback>('once')
const packshotStartFrame = ref(0)
const packshotEndFrame = ref(30)
const packshotStartOffsetSeconds = ref(0.45)
const packshotDurationSeconds = ref(1)
const packshotIsVisible = ref(false)
const isExporting = ref(false)
const exportProgress = ref(0)
const exportStatus = ref('Preparing render')
const exportError = ref('')
const controlsPanel = ref<HTMLElement | null>(null)
const curveGraph = ref<SVGSVGElement | null>(null)
const packshotContainer = ref<HTMLElement | null>(null)
let controlsScrollTop = 0
let activeCurveHandle: 'first' | 'second' | null = null
let packshotAnimation: AnimationItem | null = null
let packshotTransitionFrame: number | undefined
let packshotStartTimer: ReturnType<typeof setTimeout> | undefined
let packshotAnimationReady = false

let autoplayTimer: ReturnType<typeof setInterval> | undefined
let transitionTimer: ReturnType<typeof setTimeout> | undefined
let saveTimer: ReturnType<typeof setTimeout> | undefined
let exportProgressTimer: ReturnType<typeof setInterval> | undefined

const slideCount = computed(() => panelSlides.value.left.length)
const transitionDuration = computed(() => transitionSeconds.value * 1000)
const intervalDuration = computed(
  () => (
    transitionSeconds.value
    + (activeIndex.value === 0 ? firstPauseSeconds.value : pauseSeconds.value)
  ) * 1000
)
const totalDuration = computed(
  () => {
    const transitionCount = loopSlides.value
      ? slideCount.value
      : Math.max(0, slideCount.value - 1)

    return (
      firstPauseSeconds.value
      + pauseSeconds.value * Math.max(0, slideCount.value - 1)
      + transitionSeconds.value * transitionCount
    )
  }
)
const exportFrameCount = computed(
  () => Math.max(1, Math.round(totalDuration.value * exportFps.value))
)
const isPortrait = computed(() => aspectHeight.value >= aspectWidth.value)
const shouldShowPackshot = computed(
  () =>
    showPackshotOnFinalSlide.value
    && packshotIsVisible.value
    && activeIndex.value === slideCount.value - 1
)
const activeAspectLabel = computed(() => {
  const preset = aspectPresets.find(
    item => item.width === aspectWidth.value && item.height === aspectHeight.value
  )
  return preset?.label || 'Custom'
})
const panelLabel = computed(() => {
  if (!isPortrait.value) return selectedPanel.value
  return selectedPanel.value === 'left' ? 'top' : 'bottom'
})
const easingValue = computed(
  () => `cubic-bezier(${curve.value.x1}, ${curve.value.y1}, ${curve.value.x2}, ${curve.value.y2})`
)
const curvePath = computed(() => {
  const { x1, y1, x2, y2 } = curve.value
  return `M 12 108 C ${12 + x1 * 96} ${108 - y1 * 96}, ${12 + x2 * 96} ${108 - y2 * 96}, 108 12`
})
const firstHandle = computed(() => ({
  x: 12 + curve.value.x1 * 96,
  y: 108 - curve.value.y1 * 96
}))
const secondHandle = computed(() => ({
  x: 12 + curve.value.x2 * 96,
  y: 108 - curve.value.y2 * 96
}))
const selectedSlide = computed(
  () => panelSlides.value[selectedPanel.value][selectedIndex.value]
)

function setAspectRatio(preset: AspectPreset) {
  aspectWidth.value = preset.width
  aspectHeight.value = preset.height
  exportWidth.value = preset.exportWidth
  exportHeight.value = preset.exportHeight
}

function normalizeAspectRatio() {
  exportWidth.value = Math.max(320, Math.min(3840, Math.round(exportWidth.value || 320)))
  exportHeight.value = Math.max(180, Math.min(3840, Math.round(exportHeight.value || 180)))
  aspectWidth.value = exportWidth.value
  aspectHeight.value = exportHeight.value
}

function updateExportWidth() {
  exportWidth.value = Math.max(320, Math.min(3840, Math.round(exportWidth.value || 320)))
  exportHeight.value = Math.max(
    180,
    Math.min(3840, Math.round(exportWidth.value * aspectHeight.value / aspectWidth.value))
  )
}

function updateExportHeight() {
  exportHeight.value = Math.max(180, Math.min(3840, Math.round(exportHeight.value || 180)))
  exportWidth.value = Math.max(
    320,
    Math.min(3840, Math.round(exportHeight.value * aspectWidth.value / aspectHeight.value))
  )
}

function createSlide(side: PanelSide, index: number): Slide {
  return {
    backgroundImage: '',
    backgroundColor: (index + (side === 'right' ? 1 : 0)) % 2 === 0
      ? '#ff00ff'
      : '#7f30e3',
    backgroundPreset: 'solid',
    splitAngle: 90,
    heading: `${side === 'left' ? 'Left' : 'Right'} slide ${index + 1}`,
    headingSize: 100,
    subheading: '',
    logo: '',
    logoWidth: 40,
    logoHeight: 52,
    legalText: ''
  }
}

function updateSlideCount(value: number) {
  const nextCount = Math.max(1, Math.min(20, Math.round(value || 1)))
  requestedSlideCount.value = nextCount

  for (const side of panelSides) {
    const slides = panelSlides.value[side]

    if (slides.length > nextCount) {
      slides.splice(nextCount)
    } else {
      while (slides.length < nextCount) {
        slides.push(createSlide(side, slides.length))
      }
    }
  }

  clearTimeout(transitionTimer)
  leavingIndex.value = null
  activeIndex.value = Math.min(activeIndex.value, nextCount - 1)
  selectedIndex.value = Math.min(selectedIndex.value, nextCount - 1)
  restartAutoplay()
}

function showSlide(index: number) {
  if (index === activeIndex.value || leavingIndex.value !== null) return

  const previousIndex = activeIndex.value
  leavingIndex.value = activeIndex.value
  activeIndex.value = index
  schedulePackshotPlayback(previousIndex, index)

  clearTimeout(transitionTimer)
  transitionTimer = setTimeout(() => {
    leavingIndex.value = null
  }, transitionDuration.value)
}

function showNextSlide() {
  if (!loopSlides.value && activeIndex.value >= slideCount.value - 1) {
    finishPlayback()
    return
  }

  showSlide((activeIndex.value + 1) % slideCount.value)
}

function restartAutoplay() {
  clearTimeout(autoplayTimer)

  if (!isPlaying.value) return

  autoplayTimer = setTimeout(() => {
    showNextSlide()
    restartAutoplay()
  }, intervalDuration.value)
}

function togglePlayback() {
  if (isPlaying.value) {
    stopPlayback()
  } else {
    startPlayback()
  }
}

function startPlayback() {
  if (!loopSlides.value && activeIndex.value >= slideCount.value - 1) {
    snapToFirstSlide()
  }
  isPlaying.value = true
  restartAutoplay()
}

function stopPlayback() {
  isPlaying.value = false
  clearTimeout(autoplayTimer)
  clearTimeout(transitionTimer)
  clearTimeout(packshotStartTimer)
  if (packshotTransitionFrame) cancelAnimationFrame(packshotTransitionFrame)
  snapToFirstSlide()
}

function finishPlayback() {
  isPlaying.value = false
  clearTimeout(autoplayTimer)
  clearTimeout(transitionTimer)
  snapToFirstSlide()
}

function snapToFirstSlide() {
  isSnappingSlides.value = true
  leavingIndex.value = null
  activeIndex.value = 0
  packshotIsVisible.value = false
  packshotAnimation?.pause()
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      isSnappingSlides.value = false
    })
  })
}

function handlePlaybackShortcut(event: KeyboardEvent) {
  if (event.code !== 'Space' || event.repeat) return

  const target = event.target as HTMLElement | null
  const isEditing = target?.matches(
    'input, textarea, select, button, [contenteditable="true"]'
  )

  if (isEditing) return

  event.preventDefault()
  togglePlayback()
}

function selectSlide(index: number) {
  selectedIndex.value = index
  showSlide(index)
  restartAutoplay()
}

function selectPanel(side: PanelSide) {
  selectedPanel.value = side
}

function handleAssetUpload(
  event: Event,
  field: 'backgroundImage' | 'logo'
) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  const restoreScroll = () => {
    input.blur()
    requestAnimationFrame(() => {
      controlsPanel.value?.scrollTo({ top: controlsScrollTop })
      window.scrollTo(0, 0)
    })
  }

  if (!file || !selectedSlide.value) {
    restoreScroll()
    return
  }

  const reader = new FileReader()
  reader.addEventListener('load', () => {
    if (selectedSlide.value && typeof reader.result === 'string') {
      selectedSlide.value[field] = reader.result
    }
    restoreScroll()
  })
  reader.readAsDataURL(file)
  input.value = ''
}

function rememberControlsScroll() {
  controlsScrollTop = controlsPanel.value?.scrollTop || 0
}

function clearAsset(field: 'backgroundImage' | 'logo') {
  if (selectedSlide.value) selectedSlide.value[field] = ''
}

function rotateSplitDirection() {
  if (!selectedSlide.value) return
  selectedSlide.value.splitAngle = (selectedSlide.value.splitAngle + 90) % 360
}

function normalizeKeyValue(value: number | number[]) {
  return Array.isArray(value) ? value : [value]
}

function getKeyStartValue(key: { s?: number[] }) {
  return normalizeKeyValue(key.s || [0])
}

function interpolateValues(start: number[], end: number[], progress: number) {
  return start.map((value, index) => value + ((end[index] ?? value) - value) * progress)
}

function sampleBaseKeyframes(
  keyframes: Array<{ t: number, s?: number[] }>,
  frame: number
) {
  if (!keyframes.length) return [0]
  if (frame <= keyframes[0].t) return getKeyStartValue(keyframes[0])

  for (let index = 0; index < keyframes.length - 1; index += 1) {
    const current = keyframes[index]
    const next = keyframes[index + 1]
    if (frame >= current.t && frame <= next.t) {
      const span = Math.max(0.0001, next.t - current.t)
      return interpolateValues(
        getKeyStartValue(current),
        getKeyStartValue(next),
        (frame - current.t) / span
      )
    }
  }

  return getKeyStartValue(keyframes[keyframes.length - 1])
}

function previousKeyIndex(
  keyframes: Array<{ t: number }>,
  frame: number
) {
  let index = -1
  for (let keyIndex = 0; keyIndex < keyframes.length; keyIndex += 1) {
    if (keyframes[keyIndex].t <= frame) index = keyIndex
    else break
  }
  return index
}

function velocityBeforeKey(
  keyframes: Array<{ t: number, s?: number[] }>,
  keyIndex: number,
  fps: number
) {
  if (keyIndex <= 0) return getKeyStartValue(keyframes[Math.max(0, keyIndex)]).map(() => 0)

  const previous = keyframes[keyIndex - 1]
  const current = keyframes[keyIndex]
  const durationSeconds = Math.max(0.0001, (current.t - previous.t) / fps)
  const previousValue = getKeyStartValue(previous)
  const currentValue = getKeyStartValue(current)

  return currentValue.map((value, index) => (
    value - (previousValue[index] ?? value)
  ) / durationSeconds)
}

function bakeInertialBounceExpression(
  property: { a?: number, k?: Array<{ t: number, s?: number[] }>, x?: string } | undefined,
  fps: number,
  endFrame: number
) {
  if (!property?.a || !Array.isArray(property.k) || typeof property.x !== 'string') return

  const originalKeyframes = [...property.k].sort((a, b) => a.t - b.t)
  const firstFrame = Math.max(0, Math.floor(originalKeyframes[0]?.t || 0))
  const finalKeyframe = originalKeyframes[originalKeyframes.length - 1]
  const lastFrame = Math.min(
    Math.ceil(finalKeyframe?.t || endFrame),
    Math.max(endFrame, Math.ceil(finalKeyframe?.t || endFrame))
  )
  const amp = 0.2
  const freq = 2.5
  const decay = 5
  const baked = []

  for (let frame = firstFrame; frame <= lastFrame; frame += 1) {
    const baseValue = sampleBaseKeyframes(originalKeyframes, frame)
    const keyIndex = previousKeyIndex(originalKeyframes, frame)
    const key = originalKeyframes[keyIndex]
    const secondsSinceKey = key ? Math.max(0, (frame - key.t) / fps) : 0
    const velocity = velocityBeforeKey(originalKeyframes, keyIndex, fps)
    const bounceFactor = keyIndex > 0
      ? amp * Math.sin(freq * secondsSinceKey * 2 * Math.PI) / Math.exp(decay * secondsSinceKey)
      : 0
    const value = baseValue.map((item, index) => item + (velocity[index] || 0) * bounceFactor)

    baked.push({
      t: frame,
      s: value,
      e: value,
      i: { x: 1, y: 1 },
      o: { x: 0, y: 0 }
    })
  }

  if (baked.length > 0) {
    delete property.x
    property.k = baked
  }
}

function bakePackshotExpressions(data: {
  fr?: number
  op?: number
  layers?: Array<{ nm?: string, ks?: Record<string, unknown> }>
}) {
  const fps = Number(data.fr || 30)
  const endFrame = Math.ceil(Number(data.op || 81))

  for (const layer of data.layers || []) {
    if (layer.nm !== 'w 2' && layer.nm !== 'b 2') continue

    const transform = layer.ks as {
      p?: { a?: number, k?: Array<{ t: number, s?: number[] }>, x?: string }
      r?: { a?: number, k?: Array<{ t: number, s?: number[] }>, x?: string }
    }
    bakeInertialBounceExpression(transform.p, fps, endFrame)
    bakeInertialBounceExpression(transform.r, fps, endFrame)
  }
}

function createPackshotAnimationData() {
  const data = JSON.parse(JSON.stringify(packshotAnimationData))
  bakePackshotExpressions(data)
  const animatedParentIds = new Set(
    data.layers
      ?.filter((layer: { nm?: string }) => layer.nm === 'w' || layer.nm === 'b')
      .map((layer: { parent?: number }) => layer.parent)
      .filter((parent: number | undefined): parent is number => typeof parent === 'number')
  )

  for (const layer of data.layers || []) {
    if (!animatedParentIds.has(layer.ind)) continue

    layer.ty = 3
    layer.hd = false
    delete layer.shapes
    delete layer.hasMask
    delete layer.masksProperties
  }

  return data
}

async function initPackshotAnimation() {
  if (!packshotContainer.value) return

  const { default: lottie } = await import('lottie-web')
  packshotAnimation?.destroy()
  packshotContainer.value.innerHTML = ''
  packshotAnimationReady = false
  packshotAnimation = lottie.loadAnimation({
    container: packshotContainer.value,
    renderer: packshotRenderer.value,
    loop: packshotPlayback.value === 'loop',
    autoplay: false,
    animationData: createPackshotAnimationData(),
    rendererSettings: {
      clearCanvas: true,
      progressiveLoad: false,
      hideOnTransparent: false,
      preserveAspectRatio: 'xMidYMid meet'
    }
  })
  packshotAnimation.setSubframe(true)
  packshotAnimation.addEventListener('data_ready', () => {
    packshotAnimationReady = true
    syncPackshotState()
  })
  packshotAnimation.addEventListener('DOMLoaded', () => {
    packshotAnimationReady = true
    syncPackshotState()
  })
  window.__packshotAnimation = packshotAnimation
  syncPackshotState()
}

function setPackshotProgress(progress: number) {
  if (!packshotAnimation || !packshotAnimationReady) return

  const totalFrames = Math.max(1, packshotAnimation.totalFrames || 1)
  const start = Math.max(0, Math.min(totalFrames - 1, packshotStartFrame.value))
  const end = Math.max(start, Math.min(totalFrames - 1, packshotEndFrame.value))
  const frame = start + Math.max(0, Math.min(1, progress)) * (end - start)
  packshotAnimation.goToAndStop(frame, true)
}

function syncPackshotState() {
  if (!packshotAnimation) return

  const isVisible = showPackshotOnFinalSlide.value && shouldShowPackshot.value

  if (!isVisible) {
    packshotAnimation.pause()
    return
  }

  if (packshotPlayback.value === 'loop') {
    packshotAnimation.play()
    return
  }

  packshotAnimation.pause()
  setPackshotProgress(0)
}

function schedulePackshotPlayback(previousIndex: number, nextIndex: number) {
  if (packshotTransitionFrame) cancelAnimationFrame(packshotTransitionFrame)
  clearTimeout(packshotStartTimer)
  packshotIsVisible.value = false

  if (
    !showPackshotOnFinalSlide.value
    || nextIndex !== slideCount.value - 1
  ) {
    return
  }

  packshotAnimation?.pause()
  setPackshotProgress(0)

  packshotStartTimer = setTimeout(() => {
    if (!showPackshotOnFinalSlide.value || activeIndex.value !== slideCount.value - 1) return

    packshotIsVisible.value = true
    if (packshotPlayback.value === 'loop') {
      packshotAnimation?.play()
      return
    }

    playPackshotOnce()
  }, Math.max(0, packshotStartOffsetSeconds.value) * 1000)
}

function playPackshotOnce() {
  if (packshotTransitionFrame) cancelAnimationFrame(packshotTransitionFrame)

  const startedAt = performance.now()
  const duration = Math.max(1, packshotDurationSeconds.value * 1000)
  const tick = (time: number) => {
    const linearProgress = Math.min(1, (time - startedAt) / duration)
    setPackshotProgress(linearProgress)

    if (linearProgress < 1) {
      packshotTransitionFrame = requestAnimationFrame(tick)
    } else {
      packshotTransitionFrame = undefined
    }
  }

  packshotAnimation?.pause()
  setPackshotProgress(0)
  packshotTransitionFrame = requestAnimationFrame(tick)
}

function setCurve(x1: number, y1: number, x2: number, y2: number) {
  curve.value = { x1, y1, x2, y2 }
}

function updateCurveFromPointer(event: PointerEvent) {
  if (!activeCurveHandle || !curveGraph.value) return

  const rect = curveGraph.value.getBoundingClientRect()
  const graphX = (event.clientX - rect.left) / rect.width * 120
  const graphY = (event.clientY - rect.top) / rect.height * 120
  const x = Math.max(0, Math.min(1, (graphX - 12) / 96))
  const y = Math.max(-1, Math.min(2, (108 - graphY) / 96))

  if (activeCurveHandle === 'first') {
    curve.value.x1 = Number(x.toFixed(3))
    curve.value.y1 = Number(y.toFixed(3))
  } else {
    curve.value.x2 = Number(x.toFixed(3))
    curve.value.y2 = Number(y.toFixed(3))
  }
}

function stopCurveDrag() {
  activeCurveHandle = null
  window.removeEventListener('pointermove', updateCurveFromPointer)
  window.removeEventListener('pointerup', stopCurveDrag)
  window.removeEventListener('pointercancel', stopCurveDrag)
}

function startCurveDrag(handle: 'first' | 'second', event: PointerEvent) {
  event.preventDefault()
  activeCurveHandle = handle
  updateCurveFromPointer(event)
  window.addEventListener('pointermove', updateCurveFromPointer)
  window.addEventListener('pointerup', stopCurveDrag)
  window.addEventListener('pointercancel', stopCurveDrag)
}

function cubicBezierAt(progress: number) {
  const { x1, y1, x2, y2 } = curve.value
  const sample = (t: number, a1: number, a2: number) => {
    const c = 3 * a1
    const b = 3 * (a2 - a1) - c
    const a = 1 - c - b
    return ((a * t + b) * t + c) * t
  }
  const slope = (t: number) => {
    const c = 3 * x1
    const b = 3 * (x2 - x1) - c
    const a = 1 - c - b
    return 3 * a * t * t + 2 * b * t + c
  }

  let t = progress
  for (let index = 0; index < 8; index += 1) {
    const difference = sample(t, x1, x2) - progress
    const currentSlope = slope(t)
    if (Math.abs(difference) < 0.00001 || Math.abs(currentSlope) < 0.00001) break
    t -= difference / currentSlope
  }

  if (t < 0 || t > 1) {
    let start = 0
    let end = 1
    t = progress
    for (let index = 0; index < 12; index += 1) {
      const value = sample(t, x1, x2)
      if (value < progress) start = t
      else end = t
      t = (start + end) / 2
    }
  }

  return sample(Math.max(0, Math.min(1, t)), y1, y2)
}

function loadRenderImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', reject)
    image.src = source
  })
}

function copyComputedStyles(source: Element, target: Element) {
  const computed = getComputedStyle(source)
  const targetElement = target as HTMLElement

  for (const property of computed) {
    targetElement.style.setProperty(
      property,
      computed.getPropertyValue(property),
      computed.getPropertyPriority(property)
    )
  }

  const sourceChildren = Array.from(source.children)
  const targetChildren = Array.from(target.children)
  sourceChildren.forEach((child, index) => {
    const targetChild = targetChildren[index]
    if (targetChild) copyComputedStyles(child, targetChild)
  })
}

function getTextLines(element: HTMLElement) {
  const textNode = [...element.childNodes].find(
    node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim()
  )
  if (!textNode?.textContent) return []

  const lines: Array<{ text: string, rect: DOMRect }> = []
  let currentText = ''
  let currentRect: DOMRect | null = null

  for (let index = 0; index < textNode.textContent.length; index += 1) {
    const range = document.createRange()
    range.setStart(textNode, index)
    range.setEnd(textNode, index + 1)
    const rect = range.getBoundingClientRect()
    const character = textNode.textContent[index]

    if (
      currentRect
      && rect.width + rect.height > 0
      && Math.abs(rect.top - currentRect.top) > 1
    ) {
      lines.push({ text: currentText.trimEnd(), rect: currentRect })
      currentText = ''
      currentRect = null
    }

    currentText += character
    if (rect.width + rect.height > 0) {
      currentRect = currentRect
        ? new DOMRect(
            Math.min(currentRect.left, rect.left),
            Math.min(currentRect.top, rect.top),
            Math.max(currentRect.right, rect.right) - Math.min(currentRect.left, rect.left),
            Math.max(currentRect.bottom, rect.bottom) - Math.min(currentRect.top, rect.top)
          )
        : rect
    }
  }

  if (currentText.trim() && currentRect) {
    lines.push({ text: currentText.trimEnd(), rect: currentRect })
  }

  return lines
}

function drawDomText(
  context: CanvasRenderingContext2D,
  element: HTMLElement,
  rootRect: DOMRect,
  scaleX: number,
  scaleY: number
) {
  const computed = getComputedStyle(element)
  const fontSize = Number.parseFloat(computed.fontSize) * scaleY
  context.save()
  context.fillStyle = computed.color
  context.font = [
    computed.fontStyle,
    computed.fontVariant,
    computed.fontWeight,
    `${fontSize}px`,
    computed.fontFamily
  ].join(' ')
  context.textAlign = 'left'
  context.textBaseline = 'alphabetic'
  context.globalAlpha = Number.parseFloat(computed.opacity) || 1

  const canvasWithSpacing = context as CanvasRenderingContext2D & {
    letterSpacing?: string
  }
  if ('letterSpacing' in canvasWithSpacing) {
    canvasWithSpacing.letterSpacing = `${Number.parseFloat(computed.letterSpacing) * scaleX || 0}px`
  }

  for (const line of getTextLines(element)) {
    const metrics = context.measureText(line.text)
    const ascent = metrics.actualBoundingBoxAscent || fontSize * 0.8
    const descent = metrics.actualBoundingBoxDescent || fontSize * 0.2
    const lineTop = (line.rect.top - rootRect.top) * scaleY
    const lineHeight = line.rect.height * scaleY
    const baseline = lineTop + (lineHeight - ascent - descent) / 2 + ascent
    context.fillText(
      line.text,
      (line.rect.left - rootRect.left) * scaleX,
      baseline
    )
  }
  context.restore()
}

function drawCoverImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number
) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight)
  const renderedWidth = image.naturalWidth * scale
  const renderedHeight = image.naturalHeight * scale
  context.drawImage(
    image,
    (width - renderedWidth) / 2,
    (height - renderedHeight) / 2,
    renderedWidth,
    renderedHeight
  )
}

function drawSafeSlideBackground(
  context: CanvasRenderingContext2D,
  slide: Slide,
  width: number,
  height: number,
  images: Map<string, HTMLImageElement>
) {
  context.fillStyle = slide.backgroundColor
  context.fillRect(0, 0, width, height)

  if (slide.backgroundPreset === 'split' && !slide.backgroundImage) {
    const radians = slide.splitAngle * Math.PI / 180
    const dx = Math.sin(radians)
    const dy = -Math.cos(radians)
    const length = Math.abs(width * dx) + Math.abs(height * dy)
    const gradient = context.createLinearGradient(
      width / 2 - dx * length / 2,
      height / 2 - dy * length / 2,
      width / 2 + dx * length / 2,
      height / 2 + dy * length / 2
    )
    gradient.addColorStop(0, '#ff00ff')
    gradient.addColorStop(0.5, '#ff00ff')
    gradient.addColorStop(0.5001, '#7f30e3')
    gradient.addColorStop(1, '#7f30e3')
    context.fillStyle = gradient
    context.fillRect(0, 0, width, height)
  }

  const backgroundImage = images.get(slide.backgroundImage)
  if (backgroundImage) drawCoverImage(context, backgroundImage, width, height)
}

function renderSlideSnapshot(
  element: HTMLElement,
  slide: Slide,
  width: number,
  height: number,
  images: Map<string, HTMLImageElement>
) {
  const panel = element.parentElement as HTMLElement
  const panelRect = panel.getBoundingClientRect()
  const clone = element.cloneNode(true) as HTMLElement
  copyComputedStyles(element, clone)
  clone.style.position = 'relative'
  clone.style.inset = 'auto'
  clone.style.width = `${panelRect.width}px`
  clone.style.height = `${panelRect.height}px`
  clone.style.opacity = '1'
  clone.style.transform = 'none'
  clone.style.transformOrigin = 'center'
  clone.style.transition = 'none'

  const host = document.createElement('div')
  host.style.position = 'fixed'
  host.style.left = '-100000px'
  host.style.top = '0'
  host.style.width = `${panelRect.width}px`
  host.style.height = `${panelRect.height}px`
  host.style.overflow = 'hidden'
  host.style.pointerEvents = 'none'
  host.append(clone)
  document.body.append(host)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) {
    host.remove()
    throw new Error('Canvas rendering is not supported.')
  }

  try {
    const rootRect = clone.getBoundingClientRect()
    const scaleX = width / rootRect.width
    const scaleY = height / rootRect.height
    drawSafeSlideBackground(context, slide, width, height, images)

    const logoImageElement = clone.querySelector<HTMLImageElement>('.slide-logo img')
    if (logoImageElement) {
      const image = images.get(slide.logo)
      if (image) {
        const rect = logoImageElement.getBoundingClientRect()
        context.drawImage(
          image,
          (rect.left - rootRect.left) * scaleX,
          (rect.top - rootRect.top) * scaleY,
          rect.width * scaleX,
          rect.height * scaleY
        )
      }
    }

    const textElements = clone.querySelectorAll<HTMLElement>(
      '.slide-logo span, .slide-subheading, .slide-copy h2, .slide-legal'
    )
    for (const textElement of textElements) {
      drawDomText(context, textElement, rootRect, scaleX, scaleY)
    }
    return canvas
  } finally {
    host.remove()
  }
}

function createSlideSnapshots(
  width: number,
  height: number,
  images: Map<string, HTMLImageElement>
) {
  const snapshots = new Map<string, HTMLCanvasElement>()
  const panelWidth = isPortrait.value ? width : width / 2
  const panelHeight = isPortrait.value ? height / 2 : height

  for (const side of panelSides) {
    const panel = document.querySelector<HTMLElement>(`.slot-panel--${side}`)
    if (!panel) throw new Error(`Unable to find the ${side} preview panel.`)

    const elements = panel.querySelectorAll<HTMLElement>('.slot-slide')

    for (const [index, element] of [...elements].entries()) {
      snapshots.set(
        `${side}-${index}`,
        renderSlideSnapshot(
          element,
          panelSlides.value[side][index],
          panelWidth,
          panelHeight,
          images
        )
      )
    }
  }

  return snapshots
}

function drawScaledPanelSlide(
  context: CanvasRenderingContext2D,
  slide: CanvasImageSource,
  side: PanelSide,
  scale: number,
  origin: 'start' | 'end',
  width: number,
  height: number
) {
  if (scale <= 0) return
  const portrait = isPortrait.value
  const panelWidth = portrait ? width : width / 2
  const panelHeight = portrait ? height / 2 : height
  const x = portrait ? 0 : side === 'left' ? 0 : panelWidth
  const y = portrait ? side === 'left' ? 0 : panelHeight : 0
  const originX = origin === 'start' ? x : x + panelWidth
  const originY = origin === 'start' ? y : y + panelHeight

  context.save()
  context.beginPath()
  context.rect(x, y, panelWidth, panelHeight)
  context.clip()
  if (portrait) {
    context.translate(originX, 0)
    context.scale(scale, 1)
    context.translate(-originX, 0)
  } else {
    context.translate(0, originY)
    context.scale(1, scale)
    context.translate(0, -originY)
  }
  context.drawImage(slide, x, y, panelWidth, panelHeight)
  context.restore()
}

function canvasToPng(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error('Unable to encode PNG frame.')),
      'image/png'
    )
  })
}

function writeUint16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true)
}

function writeUint32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value >>> 0, true)
}

function crc32(data: Uint8Array) {
  let crc = 0xffffffff
  for (const byte of data) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function concatBytes(chunks: Uint8Array[]) {
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0)
  const output = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    output.set(chunk, offset)
    offset += chunk.length
  }
  return output
}

function createZip(files: Array<{ name: string, data: Uint8Array }>) {
  const encoder = new TextEncoder()
  const localChunks: Uint8Array[] = []
  const centralChunks: Uint8Array[] = []
  let localOffset = 0

  for (const file of files) {
    const name = encoder.encode(file.name)
    const checksum = crc32(file.data)
    const local = new Uint8Array(30 + name.length)
    const localView = new DataView(local.buffer)
    writeUint32(localView, 0, 0x04034b50)
    writeUint16(localView, 4, 20)
    writeUint16(localView, 6, 0x0800)
    writeUint16(localView, 8, 0)
    writeUint32(localView, 14, checksum)
    writeUint32(localView, 18, file.data.length)
    writeUint32(localView, 22, file.data.length)
    writeUint16(localView, 26, name.length)
    local.set(name, 30)
    localChunks.push(local, file.data)

    const central = new Uint8Array(46 + name.length)
    const centralView = new DataView(central.buffer)
    writeUint32(centralView, 0, 0x02014b50)
    writeUint16(centralView, 4, 20)
    writeUint16(centralView, 6, 20)
    writeUint16(centralView, 8, 0x0800)
    writeUint16(centralView, 10, 0)
    writeUint32(centralView, 16, checksum)
    writeUint32(centralView, 20, file.data.length)
    writeUint32(centralView, 24, file.data.length)
    writeUint16(centralView, 28, name.length)
    writeUint32(centralView, 42, localOffset)
    central.set(name, 46)
    centralChunks.push(central)
    localOffset += local.length + file.data.length
  }

  const centralData = concatBytes(centralChunks)
  const end = new Uint8Array(22)
  const endView = new DataView(end.buffer)
  writeUint32(endView, 0, 0x06054b50)
  writeUint16(endView, 8, files.length)
  writeUint16(endView, 10, files.length)
  writeUint32(endView, 12, centralData.length)
  writeUint32(endView, 16, localOffset)

  return new Blob([...localChunks, centralData, end], { type: 'application/zip' })
}

async function downloadPngZip(
  files: Array<{ name: string, data: Uint8Array }>,
  prefix: string
) {
  const zip = createZip(files)
  const url = URL.createObjectURL(zip)
  const link = document.createElement('a')
  link.href = url
  link.download = `${prefix}-png-sequence.zip`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function downloadMp4(
  files: Array<{ name: string, data: Uint8Array }>,
  prefix: string,
  fps: number
) {
  const formData = new FormData()
  formData.set('fps', String(fps))
  formData.set('prefix', prefix)
  for (const file of files) {
    formData.append(
      'frames',
      new Blob([file.data], { type: 'image/png' }),
      file.name
    )
  }

  const response = await fetch('/api/render-mp4', {
    method: 'POST',
    body: formData
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || 'MP4 conversion failed.')
  }

  const mp4 = await response.blob()
  const url = URL.createObjectURL(mp4)
  const link = document.createElement('a')
  link.href = url
  link.download = `${prefix}.mp4`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function renderSequence() {
  if (isExporting.value) return

  exportError.value = ''
  const width = Math.max(320, Math.min(3840, Math.round(exportWidth.value)))
  const height = Math.max(180, Math.min(3840, Math.round(exportHeight.value)))
  const fps = Math.max(1, Math.min(60, Math.round(exportFps.value)))
  exportWidth.value = width
  exportHeight.value = height
  exportFps.value = fps
  const frameCount = Math.max(1, Math.round(totalDuration.value * fps))

  if (frameCount > 1200 || width * height * frameCount > 900_000_000) {
    exportError.value = 'Export is too large. Reduce resolution, FPS, duration, or slide count.'
    return
  }

  isExporting.value = true
  exportProgress.value = 0
  exportStatus.value = 'Preparing browser'
  const wasPlaying = isPlaying.value
  isPlaying.value = false
  restartAutoplay()

  try {
    const prefix = exportPrefix.value.trim().replace(/[^\w-]+/g, '-') || 'frame'
    const previewStage = document.querySelector<HTMLElement>('.slot-stage')
    const previewRect = previewStage?.getBoundingClientRect()
    const settings: PersistedSettings = {
      panelSlides: panelSlides.value,
      selectedPanel: selectedPanel.value,
      selectedIndex: selectedIndex.value,
      requestedSlideCount: requestedSlideCount.value,
      transitionSeconds: transitionSeconds.value,
      pauseSeconds: pauseSeconds.value,
      firstPauseSeconds: firstPauseSeconds.value,
      curve: curve.value,
      exportWidth: width,
      exportHeight: height,
      exportFps: fps,
      exportPrefix: prefix,
      exportFormat: exportFormat.value,
      aspectWidth: aspectWidth.value,
      aspectHeight: aspectHeight.value,
      reverseDirections: reverseDirections.value,
      swapVerticalPanels: swapVerticalPanels.value,
      loopSlides: loopSlides.value,
      showPackshotOnFinalSlide: showPackshotOnFinalSlide.value,
      packshotWidth: packshotWidth.value,
      packshotRenderer: packshotRenderer.value,
      packshotPlayback: packshotPlayback.value,
      packshotStartFrame: packshotStartFrame.value,
      packshotEndFrame: packshotEndFrame.value,
      packshotStartOffsetSeconds: packshotStartOffsetSeconds.value,
      packshotDurationSeconds: packshotDurationSeconds.value,
      previewWidth: Math.max(1, Math.round(previewRect?.width || width)),
      previewHeight: Math.max(1, Math.round(previewRect?.height || height)),
      previewViewportWidth: window.innerWidth,
      previewViewportHeight: window.innerHeight
    }
    const formData = new FormData()
    formData.set(
      'settings',
      new Blob([JSON.stringify(settings)], { type: 'application/json' }),
      'settings.json'
    )
    exportProgress.value = 0.05
    exportStatus.value = `Rendering ${frameCount} frames`
    const estimatedRenderSeconds = Math.max(8, frameCount * 0.08)
    const progressStartedAt = Date.now()
    clearInterval(exportProgressTimer)
    exportProgressTimer = setInterval(() => {
      const elapsed = (Date.now() - progressStartedAt) / 1000
      const estimated = 0.05 + Math.min(0.85, elapsed / estimatedRenderSeconds * 0.85)
      exportProgress.value = Math.max(exportProgress.value, estimated)
    }, 250)

    const response = await fetch('/api/render-browser', {
      method: 'POST',
      body: formData
    })
    clearInterval(exportProgressTimer)
    exportProgress.value = 0.95
    exportStatus.value = exportFormat.value === 'mp4'
      ? 'Finalizing MP4'
      : 'Packaging PNG files'

    if (!response.ok) {
      const message = await response.text()
      throw new Error(message || 'Browser render failed.')
    }

    const output = await response.blob()
    const url = URL.createObjectURL(output)
    const link = document.createElement('a')
    link.href = url
    link.download = exportFormat.value === 'mp4'
      ? `${prefix}.mp4`
      : `${prefix}-png-sequence.zip`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    exportProgress.value = 1
    exportStatus.value = 'Complete'
  } catch (error) {
    exportError.value = error instanceof Error ? error.message : 'Browser render failed.'
  } finally {
    clearInterval(exportProgressTimer)
    isExporting.value = false
    isPlaying.value = wasPlaying
    restartAutoplay()
  }
}

function isValidSlide(value: unknown): value is Slide {
  if (!value || typeof value !== 'object') return false
  const slide = value as Partial<Slide>

  return (
    typeof slide.backgroundImage === 'string'
    && typeof slide.backgroundColor === 'string'
    && (slide.backgroundPreset === undefined || slide.backgroundPreset === 'solid' || slide.backgroundPreset === 'split')
    && (slide.splitAngle === undefined || typeof slide.splitAngle === 'number')
    && typeof slide.heading === 'string'
    && (slide.headingSize === undefined || typeof slide.headingSize === 'number')
    && typeof slide.subheading === 'string'
    && typeof slide.logo === 'string'
    && (slide.logoWidth === undefined || typeof slide.logoWidth === 'number')
    && (slide.logoHeight === undefined || typeof slide.logoHeight === 'number')
    && typeof slide.legalText === 'string'
  )
}

function normalizeSlide(slide: Slide): Slide {
  return {
    ...slide,
    backgroundPreset: slide.backgroundPreset === 'split' ? 'split' : 'solid',
    splitAngle: typeof slide.splitAngle === 'number' ? slide.splitAngle : 90,
    headingSize:
      typeof slide.headingSize === 'number'
        ? Math.max(25, Math.min(200, slide.headingSize))
        : 100,
    logoWidth:
      typeof slide.logoWidth === 'number'
        ? slide.logoWidth > 100
          ? Math.max(1, Math.min(100, slide.logoWidth / 4.5))
          : Math.max(1, Math.min(100, slide.logoWidth))
        : 40,
    logoHeight: typeof slide.logoHeight === 'number' ? slide.logoHeight : 52
  }
}

function loadSettings() {
  try {
    const saved = localStorage.getItem(storageKey)
    if (!saved) return

    const settings = JSON.parse(saved) as Partial<PersistedSettings>
    const leftSlides = settings.panelSlides?.left
    const rightSlides = settings.panelSlides?.right

    if (
      Array.isArray(leftSlides)
      && Array.isArray(rightSlides)
      && leftSlides.length > 0
      && leftSlides.length === rightSlides.length
      && leftSlides.every(isValidSlide)
      && rightSlides.every(isValidSlide)
    ) {
      panelSlides.value = {
        left: leftSlides.map(normalizeSlide),
        right: rightSlides.map(normalizeSlide)
      }
      requestedSlideCount.value = leftSlides.length
    }

    if (settings.selectedPanel === 'left' || settings.selectedPanel === 'right') {
      selectedPanel.value = settings.selectedPanel
    }

    if (typeof settings.selectedIndex === 'number') {
      selectedIndex.value = Math.max(
        0,
        Math.min(Math.round(settings.selectedIndex), panelSlides.value.left.length - 1)
      )
      activeIndex.value = selectedIndex.value
    }

    if (typeof settings.transitionSeconds === 'number') {
      transitionSeconds.value = Math.max(0.1, Math.min(3, settings.transitionSeconds))
    }

    if (typeof settings.pauseSeconds === 'number') {
      pauseSeconds.value = Math.max(0, Math.min(10, settings.pauseSeconds))
    }
    if (typeof settings.firstPauseSeconds === 'number') {
      firstPauseSeconds.value = Math.max(0, Math.min(10, settings.firstPauseSeconds))
    } else {
      firstPauseSeconds.value = pauseSeconds.value
    }

    if (
      settings.curve
      && ['x1', 'y1', 'x2', 'y2'].every(
        key => typeof settings.curve?.[key as keyof typeof settings.curve] === 'number'
      )
    ) {
      curve.value = { ...settings.curve }
    }

    if (typeof settings.exportWidth === 'number') {
      exportWidth.value = Math.max(320, Math.min(3840, Math.round(settings.exportWidth)))
    }
    if (typeof settings.exportHeight === 'number') {
      exportHeight.value = Math.max(180, Math.min(3840, Math.round(settings.exportHeight)))
    }
    if (typeof settings.exportFps === 'number') {
      exportFps.value = Math.max(1, Math.min(60, Math.round(settings.exportFps)))
    }
    if (typeof settings.exportPrefix === 'string') {
      exportPrefix.value = settings.exportPrefix
    }
    if (settings.exportFormat === 'png' || settings.exportFormat === 'mp4') {
      exportFormat.value = settings.exportFormat
    }
    if (
      typeof settings.aspectWidth === 'number'
      && typeof settings.aspectHeight === 'number'
      && settings.aspectWidth > 0
      && settings.aspectHeight > 0
    ) {
      aspectWidth.value = settings.aspectWidth
      aspectHeight.value = settings.aspectHeight
    }
    if (typeof settings.reverseDirections === 'boolean') {
      reverseDirections.value = settings.reverseDirections
    }
    if (typeof settings.swapVerticalPanels === 'boolean') {
      swapVerticalPanels.value = settings.swapVerticalPanels
    }
    if (typeof settings.loopSlides === 'boolean') {
      loopSlides.value = settings.loopSlides
    }
    if (typeof settings.showPackshotOnFinalSlide === 'boolean') {
      showPackshotOnFinalSlide.value = settings.showPackshotOnFinalSlide
    }
    if (typeof settings.packshotWidth === 'number') {
      packshotWidth.value = Math.max(5, Math.min(100, Math.round(settings.packshotWidth)))
    }
    if (settings.packshotRenderer === 'canvas' || settings.packshotRenderer === 'svg') {
      packshotRenderer.value = settings.packshotRenderer
    }
    const savedPackshotPlayback = settings.packshotPlayback as string | undefined
    if (savedPackshotPlayback === 'once' || savedPackshotPlayback === 'loop') {
      packshotPlayback.value = savedPackshotPlayback
    } else if (savedPackshotPlayback === 'transition') {
      packshotPlayback.value = 'once'
    }
    if (typeof settings.packshotStartFrame === 'number') {
      packshotStartFrame.value = Math.max(0, Math.min(80, Math.round(settings.packshotStartFrame)))
    }
    if (typeof settings.packshotEndFrame === 'number') {
      packshotEndFrame.value = Math.max(
        packshotStartFrame.value + 1,
        Math.min(80, Math.round(settings.packshotEndFrame))
      )
    }
    if (typeof settings.packshotStartOffsetSeconds === 'number') {
      packshotStartOffsetSeconds.value = Math.max(
        0,
        Math.min(10, settings.packshotStartOffsetSeconds)
      )
    }
    if (typeof settings.packshotDurationSeconds === 'number') {
      packshotDurationSeconds.value = Math.max(
        0.1,
        Math.min(10, settings.packshotDurationSeconds)
      )
    }
  } catch {
    localStorage.removeItem(storageKey)
  }
}

function saveSettings() {
  const settings: PersistedSettings = {
    panelSlides: panelSlides.value,
    selectedPanel: selectedPanel.value,
    selectedIndex: selectedIndex.value,
    requestedSlideCount: requestedSlideCount.value,
    transitionSeconds: transitionSeconds.value,
    pauseSeconds: pauseSeconds.value,
    firstPauseSeconds: firstPauseSeconds.value,
    curve: curve.value,
    exportWidth: exportWidth.value,
    exportHeight: exportHeight.value,
    exportFps: exportFps.value,
    exportPrefix: exportPrefix.value,
    exportFormat: exportFormat.value,
    aspectWidth: aspectWidth.value,
    aspectHeight: aspectHeight.value,
    reverseDirections: reverseDirections.value,
    swapVerticalPanels: swapVerticalPanels.value,
    loopSlides: loopSlides.value,
    showPackshotOnFinalSlide: showPackshotOnFinalSlide.value,
    packshotWidth: packshotWidth.value,
    packshotRenderer: packshotRenderer.value,
    packshotPlayback: packshotPlayback.value,
    packshotStartFrame: packshotStartFrame.value,
    packshotEndFrame: packshotEndFrame.value,
    packshotStartOffsetSeconds: packshotStartOffsetSeconds.value,
    packshotDurationSeconds: packshotDurationSeconds.value
  }

  try {
    localStorage.setItem(storageKey, JSON.stringify(settings))
  } catch (error) {
    console.warn('Unable to save animation settings to localStorage.', error)
  }
}

function scheduleSave() {
  clearTimeout(saveTimer)
  clearInterval(exportProgressTimer)
  saveTimer = setTimeout(saveSettings, 250)
}

onMounted(() => {
  loadSettings()
  initPackshotAnimation()
  restartAutoplay()
  window.addEventListener('keydown', handlePlaybackShortcut)

  watch(
    [
      panelSlides,
      selectedPanel,
      selectedIndex,
      requestedSlideCount,
      transitionSeconds,
      pauseSeconds,
      firstPauseSeconds,
      curve,
      exportWidth,
      exportHeight,
      exportFps,
      exportPrefix,
      exportFormat,
      aspectWidth,
      aspectHeight,
      reverseDirections,
      swapVerticalPanels,
      loopSlides,
      showPackshotOnFinalSlide,
      packshotWidth,
      packshotRenderer,
      packshotPlayback,
      packshotStartFrame,
      packshotEndFrame,
      packshotStartOffsetSeconds,
      packshotDurationSeconds
    ],
    scheduleSave,
    { deep: true }
  )
})

onBeforeUnmount(() => {
  clearInterval(autoplayTimer)
  clearTimeout(transitionTimer)
  clearTimeout(saveTimer)
  clearTimeout(packshotStartTimer)
  if (packshotTransitionFrame) cancelAnimationFrame(packshotTransitionFrame)
  stopCurveDrag()
  packshotAnimation?.destroy()
  packshotAnimation = null
  window.__packshotAnimation = null
  window.removeEventListener('keydown', handlePlaybackShortcut)
  saveSettings()
})

watch([transitionSeconds, pauseSeconds, firstPauseSeconds], restartAutoplay)
watch([packshotRenderer, packshotPlayback], () => {
  void initPackshotAnimation()
})
watch([showPackshotOnFinalSlide, activeIndex, leavingIndex, slideCount], syncPackshotState)
</script>

<template>
  <main class="animation-generator">
    <section class="animation-preview" aria-label="Animation preview">
      <div
        class="slot-stage"
        :class="{
          'is-portrait': isPortrait,
          'is-reversed': reverseDirections,
          'is-swapped': isPortrait && swapVerticalPanels,
          'is-snapping': isSnappingSlides
        }"
        :style="{
          '--transition-duration': `${transitionSeconds}s`,
          '--transition-curve': easingValue,
          aspectRatio: `${aspectWidth} / ${aspectHeight}`
        }"
      >
        <div
          v-for="side in panelSides"
          :key="side"
          class="slot-panel"
          :class="`slot-panel--${side}`"
        >
          <article
            v-for="(slide, index) in panelSlides[side]"
            :key="index"
            class="slot-slide"
            :class="{
              'is-active': activeIndex === index,
              'is-leaving': leavingIndex === index
            }"
            :style="{
              backgroundColor: slide.backgroundColor,
              backgroundImage: slide.backgroundImage
                ? `url(${slide.backgroundImage})`
                : slide.backgroundPreset === 'split'
                  ? `linear-gradient(${(slide.splitAngle + (isPortrait ? 270 : 0)) % 360}deg, #ff00ff 0 50%, #7f30e3 50% 100%)`
                  : 'none'
            }"
            :aria-hidden="activeIndex !== index"
          >
            <div class="slide-content">
              <div class="slide-logo">
                <img
                  v-if="slide.logo.startsWith('data:')"
                  :src="slide.logo"
                  :style="{
                    width: `${slide.logoWidth}%`,
                    height: 'auto'
                  }"
                  alt=""
                >
                <span v-else-if="slide.logo">{{ slide.logo }}</span>
              </div>

              <div class="slide-copy">
                <p v-if="slide.subheading" class="slide-subheading">
                  {{ slide.subheading }}
                </p>
                <h2
                  v-if="slide.heading"
                  :style="{ '--heading-scale': slide.headingSize / 100 }"
                >
                  {{ slide.heading }}
                </h2>
              </div>

              <p v-if="slide.legalText" class="slide-legal">
                {{ slide.legalText }}
              </p>
            </div>
          </article>
        </div>

        <div
          class="packshot-overlay"
          :class="{ 'is-visible': shouldShowPackshot }"
          :style="{ width: `${packshotWidth}%` }"
          aria-hidden="true"
        >
          <div ref="packshotContainer" class="packshot-animation" />
        </div>
      </div>

      <div class="preview-toolbar">
        <button type="button" class="play-button" @click="togglePlayback">
          {{ isPlaying ? 'Stop' : 'Play' }}
        </button>

        <div class="slide-progress" aria-label="Slides">
          <button
            v-for="(_, index) in panelSlides.left"
            :key="index"
            type="button"
            :class="{ 'is-current': activeIndex === index }"
            :aria-label="`Show slide ${index + 1}`"
            @click="selectSlide(index)"
          />
        </div>
      </div>
    </section>

    <aside ref="controlsPanel" class="animation-controls">
      <header class="controls-title">
        <p>Animation generator</p>
        <h1>{{ panelLabel }} panel</h1>
      </header>

      <div class="control-field aspect-control">
        <label>Aspect ratio <span>{{ activeAspectLabel }}</span></label>
        <div class="aspect-presets">
          <button
            v-for="preset in aspectPresets"
            :key="preset.label"
            type="button"
            :class="{
              'is-selected':
                aspectWidth === preset.width
                && aspectHeight === preset.height
            }"
            @click="setAspectRatio(preset)"
          >
            <span
              class="aspect-icon"
              :style="{ aspectRatio: `${preset.width} / ${preset.height}` }"
            />
            {{ preset.label }}
          </button>
        </div>
        <div class="custom-aspect">
          <label>
            Width, px
            <input
              v-model.number="exportWidth"
              type="number"
              min="320"
              max="3840"
              step="1"
              @change="normalizeAspectRatio"
            >
          </label>
          <span>×</span>
          <label>
            Height, px
            <input
              v-model.number="exportHeight"
              type="number"
              min="180"
              max="3840"
              step="1"
              @change="normalizeAspectRatio"
            >
          </label>
        </div>
        <button
          v-if="isPortrait"
          type="button"
          class="swap-panels-button"
          @click="swapVerticalPanels = !swapVerticalPanels"
        >
          Swap Top / Bottom
        </button>
      </div>

      <div class="control-field slide-count-control">
        <label for="slide-count">Total slides</label>
        <div class="number-stepper">
          <button
            type="button"
            aria-label="Remove one slide"
            :disabled="requestedSlideCount <= 1"
            @click="updateSlideCount(requestedSlideCount - 1)"
          >
            −
          </button>
          <input
            id="slide-count"
            v-model.number="requestedSlideCount"
            type="number"
            min="1"
            max="20"
            @change="updateSlideCount(requestedSlideCount)"
          >
          <button
            type="button"
            aria-label="Add one slide"
            :disabled="requestedSlideCount >= 20"
            @click="updateSlideCount(requestedSlideCount + 1)"
          >
            +
          </button>
        </div>
      </div>

      <div class="panel-tabs" aria-label="Select panel to edit">
        <button
          v-for="side in panelSides"
          :key="side"
          type="button"
          :class="{ 'is-selected': selectedPanel === side }"
          @click="selectPanel(side)"
        >
          {{
            isPortrait
              ? side === 'left' ? 'top' : 'bottom'
              : side
          }}
        </button>
      </div>

      <div class="slide-tabs" aria-label="Select slide to edit">
        <button
          v-for="(_, index) in panelSlides[selectedPanel]"
          :key="index"
          type="button"
          :class="{ 'is-selected': selectedIndex === index }"
          @click="selectSlide(index)"
        >
          {{ index + 1 }}
        </button>
      </div>

      <template v-if="selectedSlide">
        <div class="control-field">
          <label for="heading">Heading <span>optional</span></label>
          <input
            id="heading"
            v-model="selectedSlide.heading"
            placeholder="Add heading"
          >
          <div class="heading-size-control">
            <label>
              <span>Heading size</span>
              <div class="range-row">
                <input
                  v-model.number="selectedSlide.headingSize"
                  type="range"
                  min="25"
                  max="200"
                  step="1"
                >
                <output>{{ Math.round(selectedSlide.headingSize) }}%</output>
              </div>
            </label>
          </div>
        </div>

        <div class="control-field">
          <label for="subheading">Subheading <span>optional</span></label>
          <input
            id="subheading"
            v-model="selectedSlide.subheading"
            placeholder="Add subheading"
          >
        </div>

        <div class="control-field">
          <label for="legal">Legal text <span>optional</span></label>
          <textarea
            id="legal"
            v-model="selectedSlide.legalText"
            placeholder="Add legal text"
          />
        </div>

        <div class="control-field">
          <label>Background color</label>
          <div class="color-control">
            <button
              type="button"
              class="color-preset color-preset--pink"
              :class="{ 'is-selected': selectedSlide.backgroundColor.toLowerCase() === '#ff00ff' }"
              aria-label="Use #FF00FF"
              @click="selectedSlide.backgroundColor = '#ff00ff'; selectedSlide.backgroundPreset = 'solid'"
            >
              <span>#FF00FF</span>
            </button>
            <button
              type="button"
              class="color-preset color-preset--purple"
              :class="{ 'is-selected': selectedSlide.backgroundColor.toLowerCase() === '#7f30e3' }"
              aria-label="Use #7F30E3"
              @click="selectedSlide.backgroundColor = '#7f30e3'; selectedSlide.backgroundPreset = 'solid'"
            >
              <span>#7F30E3</span>
            </button>
            <label class="custom-color">
              <input
                v-model="selectedSlide.backgroundColor"
                type="color"
                aria-label="Custom background color"
                @input="selectedSlide.backgroundPreset = 'solid'"
              >
              <span>Custom</span>
            </label>
          </div>

          <button
            type="button"
            class="split-preset"
            :class="{ 'is-selected': selectedSlide.backgroundPreset === 'split' }"
            @click="selectedSlide.backgroundPreset = 'split'"
          >
            <span class="split-preset-swatch" />
            <span>Half brand colors</span>
          </button>

          <div v-if="selectedSlide.backgroundPreset === 'split'" class="split-direction">
            <label for="split-angle">Direction</label>
            <div class="range-row">
              <input
                id="split-angle"
                v-model.number="selectedSlide.splitAngle"
                type="range"
                min="0"
                max="359"
                step="1"
              >
              <output>{{ selectedSlide.splitAngle }}°</output>
            </div>
            <button type="button" @click="rotateSplitDirection">
              Rotate 90°
            </button>
          </div>
        </div>

        <div class="control-field">
          <label for="background">Background image <span>optional</span></label>
          <div class="asset-control">
            <label
              class="upload-button"
              for="background"
              @pointerdown="rememberControlsScroll"
            >
              {{ selectedSlide.backgroundImage ? 'Replace image' : 'Choose image' }}
            </label>
            <button
              v-if="selectedSlide.backgroundImage"
              type="button"
              class="clear-button"
              @click="clearAsset('backgroundImage')"
            >
              Remove
            </button>
          </div>
          <div
            v-if="selectedSlide.logo.startsWith('data:')"
            class="logo-size-control"
          >
            <label>
              <span>Width</span>
              <div class="range-row">
                <input
                  v-model.number="selectedSlide.logoWidth"
                  type="range"
                  min="1"
                  max="100"
                  step="1"
                >
                <output>{{ Math.round(selectedSlide.logoWidth) }}%</output>
              </div>
            </label>
          </div>
          <input
            id="background"
            class="visually-hidden"
            type="file"
            accept="image/*"
            @change="handleAssetUpload($event, 'backgroundImage')"
          >
        </div>

        <div class="control-field">
          <label for="logo">Logo <span>optional</span></label>
          <input
            v-if="!selectedSlide.logo.startsWith('data:')"
            id="logo-text"
            v-model="selectedSlide.logo"
            placeholder="Logo text"
          >
          <div v-else class="logo-upload-status">
            Uploaded logo
          </div>
          <div class="asset-control">
            <label
              class="upload-button"
              for="logo"
              @pointerdown="rememberControlsScroll"
            >
              Upload logo
            </label>
            <button
              v-if="selectedSlide.logo"
              type="button"
              class="clear-button"
              @click="clearAsset('logo')"
            >
              Clear
            </button>
          </div>
          <input
            id="logo"
            class="visually-hidden"
            type="file"
            accept="image/*"
            @change="handleAssetUpload($event, 'logo')"
          >
        </div>
      </template>

      <section class="packshot-control">
        <label class="direction-toggle">
          <span>
            <strong>Packshot on final slide</strong>
            <small>Use assets/packshot.json centered above the slots</small>
          </span>
          <input v-model="showPackshotOnFinalSlide" type="checkbox">
        </label>

        <div v-if="showPackshotOnFinalSlide" class="control-field">
          <label for="packshot-width">Packshot width</label>
          <div class="range-row">
            <input
              id="packshot-width"
              v-model.number="packshotWidth"
              type="range"
              min="5"
              max="100"
              step="1"
            >
            <output>{{ Math.round(packshotWidth) }}%</output>
          </div>
        </div>

        <div v-if="showPackshotOnFinalSlide" class="export-grid packshot-settings-grid">
          <label>
            Renderer
            <select v-model="packshotRenderer">
              <option value="canvas">Canvas · smoother</option>
              <option value="svg">SVG · editable vectors</option>
            </select>
          </label>
          <label>
            Timing
            <select v-model="packshotPlayback">
              <option value="once">Play once</option>
              <option value="loop">Loop on final slide</option>
            </select>
          </label>
          <label>
            Start offset, s
            <input
              v-model.number="packshotStartOffsetSeconds"
              type="number"
              min="0"
              max="10"
              step="0.05"
            >
          </label>
          <label>
            Duration, s
            <input
              v-model.number="packshotDurationSeconds"
              type="number"
              min="0.1"
              max="10"
              step="0.05"
            >
          </label>
          <label>
            Start frame
            <input
              v-model.number="packshotStartFrame"
              type="number"
              min="0"
              max="80"
              step="1"
              @change="packshotStartFrame = Math.max(0, Math.min(packshotEndFrame - 1, Math.round(packshotStartFrame || 0))); syncPackshotState()"
            >
          </label>
          <label>
            End frame
            <input
              v-model.number="packshotEndFrame"
              type="number"
              min="1"
              max="80"
              step="1"
              @change="packshotEndFrame = Math.max(packshotStartFrame + 1, Math.min(80, Math.round(packshotEndFrame || 30))); syncPackshotState()"
            >
          </label>
        </div>
      </section>

      <section class="timing-control">
        <div class="timing-summary">
          <span>Total duration</span>
          <strong>{{ totalDuration.toFixed(2) }}s</strong>
        </div>

        <label class="direction-toggle">
          <span>
            <strong>Reverse directions</strong>
            <small>Swap movement between both sides</small>
          </span>
          <input v-model="reverseDirections" type="checkbox">
        </label>

        <label class="direction-toggle">
          <span>
            <strong>Loop slides</strong>
            <small>Restart from slide 1 after the final slide</small>
          </span>
          <input v-model="loopSlides" type="checkbox">
        </label>

        <div class="control-field">
          <label for="transition-time">Slide transition timing</label>
          <div class="range-row">
            <input
              id="transition-time"
              v-model.number="transitionSeconds"
              type="range"
              min="0.1"
              max="3"
              step="0.05"
            >
            <output>{{ transitionSeconds.toFixed(2) }}s</output>
          </div>
        </div>

        <div class="control-field">
          <label for="first-pause-time">First slide pause</label>
          <div class="range-row">
            <input
              id="first-pause-time"
              v-model.number="firstPauseSeconds"
              type="range"
              min="0"
              max="10"
              step="0.05"
            >
            <output>{{ firstPauseSeconds.toFixed(2) }}s</output>
          </div>
        </div>

        <div class="control-field">
          <label for="pause-time">Pause timing</label>
          <div class="range-row">
            <input
              id="pause-time"
              v-model.number="pauseSeconds"
              type="range"
              min="0"
              max="10"
              step="0.05"
            >
            <output>{{ pauseSeconds.toFixed(2) }}s</output>
          </div>
        </div>

        <div class="control-field curve-control">
          <label>Transition curve</label>
          <div class="curve-presets">
            <button type="button" @click="setCurve(0.25, 0.1, 0.25, 1)">Ease</button>
            <button type="button" @click="setCurve(0.42, 0, 0.58, 1)">In out</button>
            <button type="button" @click="setCurve(0.76, 0, 0.24, 1)">Snappy</button>
          </div>

          <div class="curve-editor">
            <svg
              ref="curveGraph"
              viewBox="0 0 120 120"
              role="img"
              aria-label="Cubic bezier curve graph"
            >
              <path class="curve-grid" d="M12 12V108H108 M12 60H108 M60 12V108" />
              <path
                class="curve-handle-line"
                :d="`M12 108 L${firstHandle.x} ${firstHandle.y} M108 12 L${secondHandle.x} ${secondHandle.y}`"
              />
              <path class="curve-path" :d="curvePath" />
              <circle
                class="curve-handle"
                :cx="firstHandle.x"
                :cy="firstHandle.y"
                r="6"
                @pointerdown="startCurveDrag('first', $event)"
              />
              <circle
                class="curve-handle"
                :cx="secondHandle.x"
                :cy="secondHandle.y"
                r="6"
                @pointerdown="startCurveDrag('second', $event)"
              />
            </svg>

            <div class="curve-values">
              <label>
                X1
                <input v-model.number="curve.x1" type="number" min="0" max="1" step="0.01">
              </label>
              <label>
                Y1
                <input v-model.number="curve.y1" type="number" min="-1" max="2" step="0.01">
              </label>
              <label>
                X2
                <input v-model.number="curve.x2" type="number" min="0" max="1" step="0.01">
              </label>
              <label>
                Y2
                <input v-model.number="curve.y2" type="number" min="-1" max="2" step="0.01">
              </label>
            </div>
          </div>
          <code>{{ easingValue }}</code>
        </div>
      </section>

      <section class="export-control">
        <div class="export-heading">
          <div>
            <p>Render</p>
            <h2>{{ exportFormat === 'mp4' ? 'MP4 video' : 'PNG sequence' }}</h2>
          </div>
          <strong>{{ exportFrameCount }} frames</strong>
        </div>

        <div class="export-grid">
          <label class="export-format">
            Format
            <select v-model="exportFormat">
              <option value="mp4">MP4 · H.264</option>
              <option value="png">PNG sequence · ZIP</option>
            </select>
          </label>
          <label>
            Width
            <input
              v-model.number="exportWidth"
              type="number"
              min="320"
              max="3840"
              step="1"
              @change="updateExportWidth"
            >
          </label>
          <label>
            Height
            <input
              v-model.number="exportHeight"
              type="number"
              min="180"
              max="3840"
              step="1"
              @change="updateExportHeight"
            >
          </label>
          <label>
            Frame rate
            <select v-model.number="exportFps">
              <option :value="12">12 fps</option>
              <option :value="24">24 fps</option>
              <option :value="25">25 fps</option>
              <option :value="30">30 fps</option>
              <option :value="50">50 fps</option>
              <option :value="60">60 fps</option>
            </select>
          </label>
          <label>
            Filename
            <input v-model="exportPrefix" type="text" placeholder="slot-animation">
          </label>
        </div>

        <div class="export-summary">
          <span>{{ exportWidth }} × {{ exportHeight }} px</span>
          <span>{{ totalDuration.toFixed(2) }}s at {{ exportFps }} fps</span>
        </div>

        <button
          type="button"
          class="render-button"
          :disabled="isExporting"
          @click="renderSequence"
        >
          {{
            isExporting
              ? `${exportStatus} · ${Math.round(exportProgress * 100)}%`
              : exportFormat === 'mp4'
                ? 'Render MP4'
                : 'Render PNG sequence'
          }}
        </button>
        <progress v-if="isExporting" :value="exportProgress" max="1" />
        <p v-if="exportError" class="export-error">{{ exportError }}</p>
        <p class="export-note">
          {{
            exportFormat === 'mp4'
              ? 'Frames are converted to H.264 MP4 by the local server. FFmpeg is required on the deployment host.'
              : 'Downloads a ZIP containing numbered PNG frames.'
          }}
          Large resolutions and frame rates use significant memory.
        </p>
      </section>
    </aside>
  </main>
</template>
