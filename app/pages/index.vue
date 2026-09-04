<script setup lang="ts">
import type { AnimationItem } from 'lottie-web'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AnimatedSlideCopy from '~/components/AnimatedSlideCopy.vue'
import AspectPreviewGrid from '~/components/AspectPreviewGrid.vue'
import BackgroundSelector from '~/components/BackgroundSelector.vue'
import CopySlidePng from '~/components/CopySlidePng.vue'
import CtaControls from '~/components/CtaControls.vue'
import DraggableBackground from '~/components/DraggableBackground.vue'
import LayoutControls from '~/components/LayoutControls.vue'
import LogoControls from '~/components/LogoControls.vue'
import PresetControls from '~/components/PresetControls.vue'
import SlideEditActions from '~/components/SlideEditActions.vue'
import SlideSelector from '~/components/SlideSelector.vue'
import SlideCta from '~/components/SlideCta.vue'
import SlideTimeline from '~/components/SlideTimeline.vue'
import StageZoomControl from '~/components/StageZoomControl.vue'
import TextControls from '~/components/TextControls.vue'
import UndoShortcut from '~/components/UndoShortcut.vue'
import packshotAnimationData from '~/assets/packshot.json'
import defaultLogo from '~/assets/wb taxi.svg'
import defaultLogoSvg from '~/assets/wb taxi.svg?raw'

type HeadingHighlight = {
  start: number
  end: number
  preset: 'white-pink' | 'purple-white'
}

type Slide = {
  backgroundImage: string
  backgroundImageX?: number
  backgroundImageY?: number
  backgroundImageScale?: number
  backgroundColor: string
  backgroundPreset: 'solid' | 'split' | 'checker'
  splitAngle: number
  checkerCells: number
  bottomFade?: boolean
  heading: string
  headingHighlights?: HeadingHighlight[]
  headingSize: number
  headingAutoScale?: boolean
  subheading: string
  subheadingSize: number
  ctaText?: string
  ctaSize?: number
  ctaPulse?: boolean
  ctaAlign?: 'left' | 'right'
  ctaBottomMargin?: boolean
  logo: string
  logoWidth: number
  logoHeight: number
  legalText: string
  legalSize: number
  legalOpacity: number
  legalShadow: boolean
  legalShadowOpacity: number
}

type PanelSide = 'left' | 'right'
type AspectSlideFields = Pick<
  Slide,
  | 'heading'
  | 'headingHighlights'
  | 'headingSize'
  | 'headingAutoScale'
  | 'subheading'
  | 'subheadingSize'
  | 'ctaText'
  | 'ctaSize'
  | 'ctaPulse'
  | 'ctaAlign'
  | 'ctaBottomMargin'
  | 'logo'
  | 'logoWidth'
  | 'logoHeight'
  | 'legalText'
  | 'legalSize'
  | 'legalOpacity'
  | 'legalShadow'
  | 'legalShadowOpacity'
  | 'backgroundImageX'
  | 'backgroundImageY'
  | 'backgroundImageScale'
  | 'bottomFade'
> & Partial<Pick<Slide, 'backgroundColor' | 'backgroundPreset' | 'splitAngle' | 'checkerCells'>>
type AspectSlideSettings = Record<PanelSide, AspectSlideFields[]>
type PackshotRenderer = 'canvas' | 'svg'
type PackshotPlayback = 'once' | 'loop'
type ContentLayoutPreset = 'stacked' | 'adaptive-split'
type AspectPreset = {
  label: string
  width: number
  height: number
  exportWidth: number
  exportHeight: number
  pack?: string
  custom?: boolean
}

type AspectPack = {
  id: string
  label: string
  editable?: boolean
}

type PersistedSettings = {
  panelSlides: Record<PanelSide, Slide[]>
  aspectWorkspaceVersion?: number
  aspectSlideSettings?: Record<string, AspectSlideSettings>
  aspectPackshotWidths?: Record<string, number>
  customAspectPresets?: AspectPreset[]
  customAspectPacks?: AspectPack[]
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
  narrowHorizontalAnimation?: boolean
  textLineTransition?: boolean
  motionBlur?: boolean
  motionBlurIntensity?: number
  contentLayoutPreset?: ContentLayoutPreset
  swapVerticalPanels: boolean
  swapHorizontalPanels?: boolean
  swapUltraNarrowPanels?: boolean
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
    __slotAnimationRenderSettings?: Partial<PersistedSettings>
    __slotAnimationRenderSettingsLoaded?: boolean
  }
}

const panelSides: PanelSide[] = ['left', 'right']
const quickAspectPresets: AspectPreset[] = [
  { label: '16:9', width: 16, height: 9, exportWidth: 1920, exportHeight: 1080 },
  { label: '4:3', width: 4, height: 3, exportWidth: 1600, exportHeight: 1200 },
  { label: '3:2', width: 3, height: 2, exportWidth: 1800, exportHeight: 1200 },
  { label: '1:1', width: 1, height: 1, exportWidth: 1080, exportHeight: 1080 },
  { label: '4:5', width: 4, height: 5, exportWidth: 1080, exportHeight: 1350 },
  { label: '9:16', width: 9, height: 16, exportWidth: 1080, exportHeight: 1920 }
]
const aspectPacks: AspectPack[] = [
  { id: 'google', label: 'Google' },
  { id: 'yandex', label: 'Yandex' }
]
const defaultCustomAspectPacks: AspectPack[] = [
  { id: 'custom', label: 'Custom', editable: true }
]
const defaultCustomAspectPresets: AspectPreset[] = quickAspectPresets.map(preset => ({
  ...preset,
  pack: 'custom',
  custom: true
}))
const createAdAspectPreset = (width: number, height: number, pack: string): AspectPreset => ({
  label: `${width}x${height}`,
  width,
  height,
  exportWidth: width,
  exportHeight: height,
  pack
})
const googleAspectSizes: Array<[number, number]> = [
  [120, 600],
  [160, 600],
  [250, 250],
  [300, 1050],
  [300, 50],
  [300, 100],
  [300, 250],
  [300, 600],
  [320, 320],
  [320, 50],
  [320, 100],
  [320, 480],
  [336, 280],
  [360, 592],
  [360, 640],
  [375, 667],
  [468, 60],
  [728, 90],
  [800, 250],
  [970, 250],
  [970, 90]
]
const yandexAspectSizes: Array<[number, number]> = [
  [160, 600],
  [240, 400],
  [240, 600],
  [300, 250],
  [300, 300],
  [480, 320],
  [336, 280],
  [300, 500],
  [320, 480],
  [300, 600],
  [970, 250],
  [1000, 120],
  [728, 90],
  [320, 100],
  [320, 50]
]
const aspectPresets: AspectPreset[] = [
  ...googleAspectSizes.map(([width, height]) => createAdAspectPreset(width, height, 'google')),
  ...yandexAspectSizes.map(([width, height]) => createAdAspectPreset(width, height, 'yandex'))
]
const aspectWorkspaceVersion = 1
const storageKey = 'slot-animation-generator-settings-v1'
const localRendererPreferenceKey = 'resizer-use-local-renderer-v1'
const localRendererOrigin = 'http://127.0.0.1:3000'
const runtimeConfig = useRuntimeConfig()
const remoteRendererOrigin = String(runtimeConfig.public.rendererOrigin || '')
  .trim()
  .replace(/\/$/, '')
const settingsDatabaseName = 'slot-animation-generator'
const settingsStoreName = 'settings'
const settingsRecordKey = 'current'
const minExportDimension = 1
const maxExportDimension = 3840
const invertedDefaultLogo = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  defaultLogoSvg
    .replaceAll('fill="#FF00FF"', 'fill="__BRAND_PINK__"')
    .replaceAll('fill="white"', 'fill="#FF00FF"')
    .replaceAll('fill="__BRAND_PINK__"', 'fill="white"')
)}`
const purpleLetterDefaultLogo = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  defaultLogoSvg.replaceAll('fill="#FF00FF"', 'fill="#7f30e3"')
)}`
const panelSlides = ref<Record<PanelSide, Slide[]>>({
  left: [
    {
      backgroundImage: '',
      backgroundColor: '#ff00ff',
      backgroundPreset: 'solid',
      splitAngle: 90,
      checkerCells: 6,
      heading: 'Left slide 1',
      headingSize: 100,
      subheading: 'Subheading',
      subheadingSize: 100,
      logo: 'Logo',
      logoWidth: 40,
      logoHeight: 52,
      legalText: 'Legal text',
      legalSize: 100,
      legalOpacity: 72,
      legalShadow: false,
      legalShadowOpacity: 35
    },
    {
      backgroundImage: '',
      backgroundColor: '#7f30e3',
      backgroundPreset: 'solid',
      splitAngle: 90,
      checkerCells: 6,
      heading: 'Left slide 2',
      headingSize: 100,
      subheading: 'Subheading',
      subheadingSize: 100,
      logo: 'Logo',
      logoWidth: 40,
      logoHeight: 52,
      legalText: 'Legal text',
      legalSize: 100,
      legalOpacity: 72,
      legalShadow: false,
      legalShadowOpacity: 35
    },
    {
      backgroundImage: '',
      backgroundColor: '#ff00ff',
      backgroundPreset: 'solid',
      splitAngle: 90,
      checkerCells: 6,
      heading: 'Left slide 3',
      headingSize: 100,
      subheading: 'Subheading',
      subheadingSize: 100,
      logo: 'Logo',
      logoWidth: 40,
      logoHeight: 52,
      legalText: 'Legal text',
      legalSize: 100,
      legalOpacity: 72,
      legalShadow: false,
      legalShadowOpacity: 35
    },
    {
      backgroundImage: '',
      backgroundColor: '#7f30e3',
      backgroundPreset: 'solid',
      splitAngle: 90,
      checkerCells: 6,
      heading: 'Left slide 4',
      headingSize: 100,
      subheading: 'Subheading',
      subheadingSize: 100,
      logo: 'Logo',
      logoWidth: 40,
      logoHeight: 52,
      legalText: 'Legal text',
      legalSize: 100,
      legalOpacity: 72,
      legalShadow: false,
      legalShadowOpacity: 35
    }
  ],
  right: [
    {
      backgroundImage: '',
      backgroundColor: '#7f30e3',
      backgroundPreset: 'solid',
      splitAngle: 90,
      checkerCells: 6,
      heading: 'Right slide 1',
      headingSize: 100,
      subheading: 'Subheading',
      subheadingSize: 100,
      logo: 'Logo',
      logoWidth: 40,
      logoHeight: 52,
      legalText: 'Legal text',
      legalSize: 100,
      legalOpacity: 72,
      legalShadow: false,
      legalShadowOpacity: 35
    },
    {
      backgroundImage: '',
      backgroundColor: '#ff00ff',
      backgroundPreset: 'solid',
      splitAngle: 90,
      checkerCells: 6,
      heading: 'Right slide 2',
      headingSize: 100,
      subheading: 'Subheading',
      subheadingSize: 100,
      logo: 'Logo',
      logoWidth: 40,
      logoHeight: 52,
      legalText: 'Legal text',
      legalSize: 100,
      legalOpacity: 72,
      legalShadow: false,
      legalShadowOpacity: 35
    },
    {
      backgroundImage: '',
      backgroundColor: '#7f30e3',
      backgroundPreset: 'solid',
      splitAngle: 90,
      checkerCells: 6,
      heading: 'Right slide 3',
      headingSize: 100,
      subheading: 'Subheading',
      subheadingSize: 100,
      logo: 'Logo',
      logoWidth: 40,
      logoHeight: 52,
      legalText: 'Legal text',
      legalSize: 100,
      legalOpacity: 72,
      legalShadow: false,
      legalShadowOpacity: 35
    },
    {
      backgroundImage: '',
      backgroundColor: '#ff00ff',
      backgroundPreset: 'solid',
      splitAngle: 90,
      checkerCells: 6,
      heading: 'Right slide 4',
      headingSize: 100,
      subheading: 'Subheading',
      subheadingSize: 100,
      logo: 'Logo',
      logoWidth: 40,
      logoHeight: 52,
      legalText: 'Legal text',
      legalSize: 100,
      legalOpacity: 72,
      legalShadow: false,
      legalShadowOpacity: 35
    }
  ]
})
const aspectSlideSettings = ref<Record<string, AspectSlideSettings>>({})
const aspectPackshotWidths = ref<Record<string, number>>({})
const customAspectPresets = ref<AspectPreset[]>(defaultCustomAspectPresets.map(preset => ({ ...preset })))
const customAspectPacks = ref<AspectPack[]>(defaultCustomAspectPacks.map(pack => ({ ...pack })))

const selectedPanel = ref<PanelSide>('left')
const selectedIndex = ref(0)
const activeIndex = ref(0)
const leavingIndex = ref<number | null>(null)
const isSnappingSlides = ref(false)
const isResettingTextAnimation = ref(false)
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
const narrowHorizontalAnimation = ref(false)
const textLineTransition = ref(false)
const motionBlur = ref(false)
const motionBlurIntensity = ref(50)
const contentLayoutPreset = ref<ContentLayoutPreset>('stacked')
const swapVerticalPanels = ref(false)
const swapHorizontalPanels = ref(false)
const swapUltraNarrowPanels = ref(false)
const loopSlides = ref(false)
const showPackshotOnFinalSlide = ref(false)
const packshotWidth = ref(28)
const packshotRenderer = ref<PackshotRenderer>('canvas')
const packshotPlayback = ref<PackshotPlayback>('once')
const packshotStartFrame = ref(0)
const packshotEndFrame = ref(30)
const packshotStartOffsetSeconds = ref(0.45)
const packshotDurationSeconds = ref(1)
const previewZoom = ref(100)
const packshotIsVisible = ref(false)
const isExporting = ref(false)
const isRenderingAspectGroup = ref(false)
const exportProgress = ref(0)
const exportStatus = ref('Preparing render')
const exportError = ref('')
const useLocalRenderer = ref(false)
const localRendererStatus = ref<'idle' | 'checking' | 'connected' | 'unavailable'>('idle')
const remoteRendererStatus = ref<'idle' | 'checking' | 'connected' | 'unavailable'>('idle')
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
let textAnimationResetFrame: number | undefined
let textAnimationPlayFrame: number | undefined
let saveTimer: ReturnType<typeof setTimeout> | undefined
let undoSnapshotTimer: ReturnType<typeof setTimeout> | undefined
let exportProgressTimer: ReturnType<typeof setInterval> | undefined
const undoHistory: string[] = []
const maxUndoHistory = 30
const motionTrailSampleCount = 16

const slideCount = computed(() => panelSlides.value.left.length)
const hasPulsingCta = computed(() => panelSides.some(side => (
  panelSlides.value[side].some(slide => Boolean(slide.ctaText && slide.ctaPulse))
)))
const hasCta = computed(() => panelSides.some(side => (
  panelSlides.value[side].some(slide => Boolean(slide.ctaText))
)))
const transitionDuration = computed(() => transitionSeconds.value * 1000)
const motionBlurStrength = computed(() => (
  Math.max(0, Math.min(100, motionBlurIntensity.value)) / 100
))
const motionTrailDelayMs = computed(() => 1 + motionBlurStrength.value * 2)
const motionTrailOpacity = computed(() => motionBlurStrength.value * 0.08)
const intervalDuration = computed(
  () => (
    (leavingIndex.value !== null ? transitionSeconds.value : 0)
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
const isUltraNarrow = computed(
  () => !isPortrait.value && aspectWidth.value / aspectHeight.value >= 4
)
const activePanelSwap = computed(() => (
  isPortrait.value
    ? swapVerticalPanels.value
    : isUltraNarrow.value
      ? swapUltraNarrowPanels.value
      : swapHorizontalPanels.value
))
const stagePanelSides = computed<PanelSide[]>(() => (
  !isPortrait.value && activePanelSwap.value
    ? ['right', 'left']
    : panelSides
))

function getVisualStartSide(): PanelSide {
  if (isPortrait.value) return activePanelSwap.value ? 'right' : 'left'
  return stagePanelSides.value[0] ?? 'left'
}

function getLayoutContentSlide(side: PanelSide, index: number): Slide {
  if (contentLayoutPreset.value !== 'adaptive-split') {
    return panelSlides.value[side][index] ?? createSlide(side, index)
  }

  const sourceSide = getVisualStartSide()
  return panelSlides.value[sourceSide][index]
    ?? panelSlides.value[side][index]
    ?? createSlide(side, index)
}

const shouldShowPackshot = computed(
  () =>
    showPackshotOnFinalSlide.value
    && packshotIsVisible.value
    && activeIndex.value === slideCount.value - 1
)
const previewZoomScale = computed(() => previewZoom.value / 100)
const activeAspectLabel = computed(() => {
  const preset = [...quickAspectPresets, ...allAspectPresets.value].find(
    item => item.width === aspectWidth.value && item.height === aspectHeight.value
  )
  return preset?.label || 'Custom'
})
const allAspectPresets = computed(() => [...aspectPresets, ...customAspectPresets.value])
const allAspectPacks = computed(() => {
  const primaryCustomPack = customAspectPacks.value.find(pack => pack.id === 'custom')
  const additionalCustomPacks = customAspectPacks.value.filter(pack => pack.id !== 'custom')

  return primaryCustomPack
    ? [primaryCustomPack, ...aspectPacks, ...additionalCustomPacks]
    : [...aspectPacks, ...additionalCustomPacks]
})
function getPanelLabel(side: PanelSide) {
  if (!isPortrait.value) {
    const isLeftPanel = activePanelSwap.value
      ? side === 'right'
      : side === 'left'
    return isLeftPanel ? 'left' : 'right'
  }

  const isTopPanel = swapVerticalPanels.value
    ? side === 'right'
    : side === 'left'
  return isTopPanel ? 'top' : 'bottom'
}

const panelLabel = computed(() => getPanelLabel(selectedPanel.value))

const panelSwapButtonLabel = computed(() => {
  if (isUltraNarrow.value) return 'Swap Narrow Left / Right'
  return isPortrait.value ? 'Swap Top / Bottom' : 'Swap Left / Right'
})

function togglePanelSwap() {
  if (isUltraNarrow.value) {
    swapUltraNarrowPanels.value = !swapUltraNarrowPanels.value
    return
  }

  if (isPortrait.value) {
    swapVerticalPanels.value = !swapVerticalPanels.value
    return
  }

  swapHorizontalPanels.value = !swapHorizontalPanels.value
}
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
const copySlideStatus = ref<'idle' | 'copying' | 'copied' | 'error'>('idle')
let copySlideStatusTimer: ReturnType<typeof setTimeout> | undefined

function rangeStyle(value: number, min: number, max: number) {
  const progress = ((value - min) / (max - min)) * 100
  const clampedProgress = Math.min(100, Math.max(0, progress))

  return { '--range-progress': `${clampedProgress}%` }
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

function getAspectKey(width = aspectWidth.value, height = aspectHeight.value) {
  const roundedWidth = Math.max(1, Math.round(width))
  const roundedHeight = Math.max(1, Math.round(height))
  const divisor = gcd(roundedWidth, roundedHeight)
  return `${roundedWidth / divisor}:${roundedHeight / divisor}`
}

function normalizeAspectKey(key: string) {
  const parts = key.split(':')
  const width = Number.parseInt(parts[0] ?? '', 10)
  const height = Number.parseInt(parts[1] ?? '', 10)
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return key
  }

  return getAspectKey(width, height)
}

function normalizeBackgroundImageX(value: number | undefined) {
  return Math.max(-500, Math.min(600, typeof value === 'number' ? value : 50))
}

function normalizeBackgroundImageY(value: number | undefined) {
  return Math.max(-500, Math.min(600, typeof value === 'number' ? value : 50))
}

function normalizeBackgroundImageScale(value: number | undefined) {
  return Math.max(0.2, Math.min(6, typeof value === 'number' ? value : 1))
}

function normalizeBackgroundPreset(value: Slide['backgroundPreset'] | undefined) {
  return value === 'split' || value === 'checker' ? value : 'solid'
}

function normalizeSplitAngle(value: number | undefined) {
  return Math.max(0, Math.min(359, Math.round(typeof value === 'number' ? value : 90)))
}

function normalizeCheckerCells(value: number | undefined) {
  const cellCount = Math.round(typeof value === 'number' ? value : 6)
  return [2, 3, 4, 6, 8].includes(cellCount) ? cellCount : 6
}

function normalizePackshotWidth(value: number) {
  return Math.max(5, Math.min(100, Math.round(Number.isFinite(value) ? value : 28)))
}

function normalizeHeadingHighlights(value: unknown, heading: string): HeadingHighlight[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== 'object') return []
    const highlight = candidate as Partial<HeadingHighlight>
    if (
      typeof highlight.start !== 'number'
      || typeof highlight.end !== 'number'
      || (highlight.preset !== 'white-pink' && highlight.preset !== 'purple-white')
    ) return []

    const start = Math.max(0, Math.min(heading.length, Math.round(highlight.start)))
    const end = Math.max(start, Math.min(heading.length, Math.round(highlight.end)))
    return end > start ? [{ start, end, preset: highlight.preset }] : []
  })
}

function isValidHeadingHighlights(value: unknown) {
  return value === undefined || (
    Array.isArray(value)
    && value.every(candidate => (
      candidate
      && typeof candidate === 'object'
      && typeof candidate.start === 'number'
      && typeof candidate.end === 'number'
      && (candidate.preset === 'white-pink' || candidate.preset === 'purple-white')
    ))
  )
}

function getAspectSlideFields(slide: Slide): AspectSlideFields {
  return {
    backgroundColor: slide.backgroundColor,
    backgroundPreset: slide.backgroundPreset,
    splitAngle: slide.splitAngle,
    checkerCells: normalizeCheckerCells(slide.checkerCells),
    bottomFade: slide.bottomFade ?? false,
    heading: slide.heading,
    headingHighlights: normalizeHeadingHighlights(slide.headingHighlights, slide.heading),
    headingSize: slide.headingSize,
    headingAutoScale: slide.headingAutoScale ?? false,
    subheading: slide.subheading,
    subheadingSize: slide.subheadingSize,
    ctaText: slide.ctaText || '',
    ctaSize: slide.ctaSize ?? 100,
    ctaPulse: slide.ctaPulse ?? false,
    ctaAlign: slide.ctaAlign === 'left' ? 'left' : 'right',
    ctaBottomMargin: slide.ctaBottomMargin ?? false,
    logo: slide.logo,
    logoWidth: slide.logoWidth,
    logoHeight: slide.logoHeight,
    legalText: slide.legalText,
    legalSize: slide.legalSize,
    legalOpacity: slide.legalOpacity,
    legalShadow: slide.legalShadow,
    legalShadowOpacity: slide.legalShadowOpacity,
    backgroundImageX: normalizeBackgroundImageX(slide.backgroundImageX),
    backgroundImageY: normalizeBackgroundImageY(slide.backgroundImageY),
    backgroundImageScale: normalizeBackgroundImageScale(slide.backgroundImageScale)
  }
}

function captureAspectSlideSettings(): AspectSlideSettings {
  return {
    left: panelSlides.value.left.map(getAspectSlideFields),
    right: panelSlides.value.right.map(getAspectSlideFields)
  }
}

function storeCurrentAspectSettings() {
  aspectSlideSettings.value[getAspectKey()] = captureAspectSlideSettings()
  aspectPackshotWidths.value[getAspectKey()] = normalizePackshotWidth(packshotWidth.value)
}

function applyAspectSlideSettings(key: string) {
  const settings = aspectSlideSettings.value[key]

  if (!settings) {
    aspectSlideSettings.value[key] = captureAspectSlideSettings()
    return
  }

  for (const side of panelSides) {
    for (const [index, slide] of panelSlides.value[side].entries()) {
      const fields = settings[side]?.[index]
      if (fields) Object.assign(slide, fields)
    }
  }
}

function applyAspectPackshotWidth(key: string) {
  const width = aspectPackshotWidths.value[key]

  if (typeof width === 'number') {
    packshotWidth.value = normalizePackshotWidth(width)
    return
  }

  aspectPackshotWidths.value[key] = normalizePackshotWidth(packshotWidth.value)
}

function applyAspectSettings(key: string) {
  applyAspectSlideSettings(key)
  applyAspectPackshotWidth(key)
}

function getAspectPreviewSlides(preset: AspectPreset): { left: Slide, right: Slide } {
  const index = Math.min(activeIndex.value, panelSlides.value.left.length - 1)
  const key = getAspectKey(preset.width, preset.height)
  const currentKey = getAspectKey()
  const settings = key === currentKey ? undefined : aspectSlideSettings.value[key]
  const leftSlide = panelSlides.value.left[index] ?? createSlide('left', index)
  const rightSlide = panelSlides.value.right[index] ?? createSlide('right', index)

  return {
    left: {
      ...leftSlide,
      ...(settings?.left?.[index] || {})
    },
    right: {
      ...rightSlide,
      ...(settings?.right?.[index] || {})
    }
  }
}

function setAspectRatio(preset: AspectPreset) {
  storeCurrentAspectSettings()
  aspectWidth.value = preset.width
  aspectHeight.value = preset.height
  exportWidth.value = preset.exportWidth
  exportHeight.value = preset.exportHeight
  applyAspectSettings(getAspectKey(preset.width, preset.height))
}

function normalizeAspectPreset(value: unknown): AspectPreset | null {
  if (!value || typeof value !== 'object') return null
  const preset = value as Partial<AspectPreset>

  if (
    typeof preset.width !== 'number'
    || typeof preset.height !== 'number'
    || typeof preset.exportWidth !== 'number'
    || typeof preset.exportHeight !== 'number'
  ) {
    return null
  }

  const exportPresetWidth = Math.max(minExportDimension, Math.min(maxExportDimension, Math.round(preset.exportWidth)))
  const exportPresetHeight = Math.max(minExportDimension, Math.min(maxExportDimension, Math.round(preset.exportHeight)))
  const width = Math.max(1, Math.round(preset.width))
  const height = Math.max(1, Math.round(preset.height))
  const label = typeof preset.label === 'string' && preset.label.trim()
    ? preset.label.trim()
    : `${exportPresetWidth}:${exportPresetHeight}`

  return {
    label,
    width,
    height,
    exportWidth: exportPresetWidth,
    exportHeight: exportPresetHeight,
    pack: typeof preset.pack === 'string' ? preset.pack : undefined,
    custom: Boolean(preset.custom)
  }
}

function normalizeCustomAspectPresets(value: unknown): AspectPreset[] {
  if (!Array.isArray(value)) return []

  const seen = new Set(aspectPresets.map(preset => preset.label))
  const presets: AspectPreset[] = []

  for (const item of value) {
    const preset = normalizeAspectPreset(item)
    if (!preset || seen.has(preset.label)) continue

    seen.add(preset.label)
    presets.push({ ...preset, custom: true })
  }

  return presets
}

function normalizeCustomAspectPacks(value: unknown): AspectPack[] {
  if (!Array.isArray(value)) return []

  const seen = new Set(aspectPacks.map(pack => pack.id))
  const packs: AspectPack[] = []

  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const pack = item as Partial<AspectPack>
    if (typeof pack.id !== 'string' || typeof pack.label !== 'string') continue
    const id = pack.id.trim().replace(/[^\w-]+/g, '-')
    const label = pack.label.trim()
    if (!id || !label || seen.has(id)) continue

    seen.add(id)
    packs.push({ id, label, editable: true })
  }

  return packs
}

function addCustomAspectPreset(width: number, height: number, pack?: string) {
  const exportPresetWidth = Math.max(minExportDimension, Math.min(maxExportDimension, Math.round(width || 320)))
  const exportPresetHeight = Math.max(minExportDimension, Math.min(maxExportDimension, Math.round(height || 180)))
  const label = `${exportPresetWidth}:${exportPresetHeight}`

  const preset: AspectPreset = {
    label,
    width: exportPresetWidth,
    height: exportPresetHeight,
    exportWidth: exportPresetWidth,
    exportHeight: exportPresetHeight,
    pack,
    custom: true
  }

  const existingIndex = customAspectPresets.value.findIndex(item => item.label === label)
  if (existingIndex >= 0) {
    customAspectPresets.value.splice(existingIndex, 1, preset)
  } else if (!aspectPresets.some(item => item.label === label)) {
    customAspectPresets.value.push(preset)
  }

  setAspectRatio(preset)
}

function addCustomAspectPack() {
  const existingLabels = new Set(allAspectPacks.value.map(pack => pack.label))
  let index = 1
  let label = `Group ${index}`
  while (existingLabels.has(label)) {
    index += 1
    label = `Group ${index}`
  }

  customAspectPacks.value.push({
    id: `custom-${Date.now()}-${index}`,
    label,
    editable: true
  })
}

function renameCustomAspectPack(id: string, label: string) {
  const pack = customAspectPacks.value.find(item => item.id === id)
  if (!pack) return

  pack.label = label
}

function removeCustomAspectPack(id: string) {
  const index = customAspectPacks.value.findIndex(pack => pack.id === id)
  if (index < 0) return

  customAspectPacks.value.splice(index, 1)
  const fallbackPack = customAspectPacks.value.find(pack => pack.id === 'custom')
  if (fallbackPack) {
    for (const preset of customAspectPresets.value) {
      if (preset.pack === id) preset.pack = fallbackPack.id
    }
  } else {
    customAspectPresets.value = customAspectPresets.value.filter(preset => preset.pack !== id)
  }
}

function removeCustomAspectPreset(label: string) {
  const index = customAspectPresets.value.findIndex(preset => preset.label === label)
  if (index >= 0) customAspectPresets.value.splice(index, 1)
}

function normalizeAspectRatio() {
  storeCurrentAspectSettings()
  exportWidth.value = Math.max(minExportDimension, Math.min(maxExportDimension, Math.round(exportWidth.value || 320)))
  exportHeight.value = Math.max(minExportDimension, Math.min(maxExportDimension, Math.round(exportHeight.value || 180)))
  aspectWidth.value = exportWidth.value
  aspectHeight.value = exportHeight.value
  applyAspectSettings(getAspectKey(exportWidth.value, exportHeight.value))
}

function updateExportWidth() {
  exportWidth.value = Math.max(minExportDimension, Math.min(maxExportDimension, Math.round(exportWidth.value || 320)))
  exportHeight.value = Math.max(
    minExportDimension,
    Math.min(maxExportDimension, Math.round(exportWidth.value * aspectHeight.value / aspectWidth.value))
  )
}

function updateExportHeight() {
  exportHeight.value = Math.max(minExportDimension, Math.min(maxExportDimension, Math.round(exportHeight.value || 180)))
  exportWidth.value = Math.max(
    minExportDimension,
    Math.min(maxExportDimension, Math.round(exportHeight.value * aspectWidth.value / aspectHeight.value))
  )
}

function createSlide(side: PanelSide, index: number): Slide {
  return {
    backgroundImage: '',
    backgroundImageX: 50,
    backgroundImageY: 50,
    backgroundImageScale: 1,
    backgroundColor: (index + (side === 'right' ? 1 : 0)) % 2 === 0
      ? '#ff00ff'
      : '#7f30e3',
    backgroundPreset: 'solid',
    splitAngle: 90,
    checkerCells: 6,
    heading: `${side === 'left' ? 'Left' : 'Right'} slide ${index + 1}`,
    headingSize: 100,
    subheading: 'Subheading',
    subheadingSize: 100,
    logo: 'Logo',
    logoWidth: 40,
    logoHeight: 52,
    legalText: 'Legal text',
    legalSize: 100,
    legalOpacity: 72,
    legalShadow: false,
    legalShadowOpacity: 35
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

function insertSlideAt(insertIndex: number) {
  if (slideCount.value >= 20) return

  storeCurrentAspectSettings()

  for (const side of panelSides) {
    panelSlides.value[side].splice(insertIndex, 0, createSlide(side, insertIndex))
  }

  for (const settings of Object.values(aspectSlideSettings.value)) {
    for (const side of panelSides) {
      const fields = getAspectSlideFields(createSlide(side, insertIndex))
      settings[side]?.splice(insertIndex, 0, fields)
    }
  }

  requestedSlideCount.value = slideCount.value
  clearTimeout(transitionTimer)
  leavingIndex.value = null
  activeIndex.value = insertIndex
  selectedIndex.value = insertIndex
  restartAutoplay()
}

function removeSelectedSlide() {
  if (slideCount.value <= 1) return

  storeCurrentAspectSettings()
  const removeIndex = Math.min(selectedIndex.value, slideCount.value - 1)
  const nextIndex = Math.min(removeIndex, slideCount.value - 2)

  for (const side of panelSides) {
    panelSlides.value[side].splice(removeIndex, 1)
  }

  for (const settings of Object.values(aspectSlideSettings.value)) {
    for (const side of panelSides) {
      settings[side]?.splice(removeIndex, 1)
    }
  }

  requestedSlideCount.value = slideCount.value
  clearTimeout(transitionTimer)
  leavingIndex.value = null
  activeIndex.value = nextIndex
  selectedIndex.value = nextIndex
  restartAutoplay()
}

function showSlide(index: number) {
  if (index === activeIndex.value || leavingIndex.value !== null) return

  const previousIndex = activeIndex.value
  buildMotionTrails(previousIndex, index)
  leavingIndex.value = activeIndex.value
  activeIndex.value = index
  schedulePackshotPlayback(previousIndex, index)
  void nextTick(() => startMotionTrails(previousIndex, index))

  clearTimeout(transitionTimer)
  transitionTimer = setTimeout(() => {
    leavingIndex.value = null
    clearMotionTrails()
  }, transitionDuration.value)
}

function replaceTrailVideos(source: HTMLElement, clone: HTMLElement) {
  const sourceVideos = Array.from(source.querySelectorAll<HTMLVideoElement>('video'))
  const cloneVideos = Array.from(clone.querySelectorAll<HTMLVideoElement>('video'))

  cloneVideos.forEach((video, index) => {
    const sourceVideo = sourceVideos[index]
    if (!sourceVideo || sourceVideo.readyState < 2) return

    const canvas = document.createElement('canvas')
    canvas.className = video.className
    canvas.style.cssText = video.style.cssText
    canvas.width = Math.max(1, sourceVideo.videoWidth)
    canvas.height = Math.max(1, sourceVideo.videoHeight)
    canvas.getContext('2d')?.drawImage(sourceVideo, 0, 0, canvas.width, canvas.height)
    video.replaceWith(canvas)
  })
}

function createMotionTrailSample(
  source: HTMLElement,
  mode: 'entering' | 'leaving',
  sampleIndex: number
) {
  const clone = source.cloneNode(true) as HTMLElement
  clone.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'))
  clone.removeAttribute('id')
  clone.setAttribute('aria-hidden', 'true')
  clone.classList.remove('is-active', 'is-leaving')
  clone.classList.add(
    'motion-trail-sample',
    mode === 'entering' ? 'is-motion-entering' : 'is-motion-leaving'
  )
  if (isPortrait.value) clone.classList.add('is-motion-axis-x')
  clone.style.setProperty('--motion-trail-delay', `${sampleIndex * motionTrailDelayMs.value}ms`)
  clone.style.animationPlayState = 'paused'
  clone.style.transformOrigin = getComputedStyle(source).transformOrigin
  replaceTrailVideos(source, clone)
  return clone
}

function clearMotionTrails() {
  document.querySelectorAll('.slot-stage--main .motion-trail-layer').forEach((layer) => {
    layer.replaceChildren()
  })
}

function buildMotionTrails(previousIndex: number, nextIndex: number) {
  clearMotionTrails()
  if (!motionBlur.value || motionBlurIntensity.value <= 0 || textLineTransition.value) return

  document.querySelectorAll<HTMLElement>('.slot-stage--main .slot-panel').forEach((panel) => {
    const layer = panel.querySelector<HTMLElement>('.motion-trail-layer')
    const slides = Array.from(panel.children)
      .filter((element): element is HTMLElement => (
        element instanceof HTMLElement && element.classList.contains('slot-slide')
      ))
    const previous = slides[previousIndex]
    const next = slides[nextIndex]
    if (!layer || !previous || !next) return

    for (let sampleIndex = 0; sampleIndex < motionTrailSampleCount; sampleIndex += 1) {
      layer.append(
        createMotionTrailSample(previous, 'leaving', sampleIndex),
        createMotionTrailSample(next, 'entering', sampleIndex)
      )
    }
  })
}

function startMotionTrails(previousIndex: number, nextIndex: number) {
  if (!motionBlur.value || motionBlurIntensity.value <= 0 || textLineTransition.value) return

  document.querySelectorAll<HTMLElement>('.slot-stage--main .slot-panel').forEach((panel) => {
    const slides = Array.from(panel.children)
      .filter((element): element is HTMLElement => (
        element instanceof HTMLElement && element.classList.contains('slot-slide')
      ))
    const previous = slides[previousIndex]
    const next = slides[nextIndex]
    const layer = panel.querySelector<HTMLElement>('.motion-trail-layer')
    if (!previous || !next || !layer) return

    layer.querySelectorAll<HTMLElement>('.motion-trail-sample').forEach((sample) => {
      const source = sample.classList.contains('is-motion-leaving') ? previous : next
      sample.style.transformOrigin = getComputedStyle(source).transformOrigin
      sample.style.animationPlayState = 'running'
    })
  })
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

function cancelTextAnimationReset() {
  if (textAnimationResetFrame) cancelAnimationFrame(textAnimationResetFrame)
  if (textAnimationPlayFrame) cancelAnimationFrame(textAnimationPlayFrame)
  textAnimationResetFrame = undefined
  textAnimationPlayFrame = undefined
  isResettingTextAnimation.value = false
}

function replayActiveTextAnimation() {
  cancelTextAnimationReset()
  if (!textLineTransition.value) return

  isResettingTextAnimation.value = true
  textAnimationResetFrame = requestAnimationFrame(() => {
    textAnimationPlayFrame = requestAnimationFrame(() => {
      isResettingTextAnimation.value = false
      textAnimationResetFrame = undefined
      textAnimationPlayFrame = undefined
    })
  })
}

function startPlayback() {
  if (!loopSlides.value && activeIndex.value >= slideCount.value - 1) {
    snapToFirstSlide()
  }
  isPlaying.value = true
  replayActiveTextAnimation()
  restartAutoplay()
}

function stopPlayback() {
  cancelTextAnimationReset()
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
  clearMotionTrails()
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
      if (field === 'backgroundImage') {
        selectedSlide.value.backgroundImageX = 50
        selectedSlide.value.backgroundImageY = 50
        selectedSlide.value.backgroundImageScale = 1
      }
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
  if (!selectedSlide.value) return
  selectedSlide.value[field] = ''
  if (field === 'backgroundImage') {
    selectedSlide.value.backgroundImageX = 50
    selectedSlide.value.backgroundImageY = 50
    selectedSlide.value.backgroundImageScale = 1
  }
}

function rotateSplitDirection() {
  if (!selectedSlide.value) return
  selectedSlide.value.splitAngle = (selectedSlide.value.splitAngle + 90) % 360
}

function applySelectedBackgroundToAspectRatios() {
  const slide = selectedSlide.value
  if (!slide) return

  const backgroundFields: Pick<
    AspectSlideFields,
    'backgroundColor' | 'backgroundPreset' | 'splitAngle' | 'checkerCells' | 'bottomFade'
  > = {
    backgroundColor: slide.backgroundColor,
    backgroundPreset: normalizeBackgroundPreset(slide.backgroundPreset),
    splitAngle: normalizeSplitAngle(slide.splitAngle),
    checkerCells: normalizeCheckerCells(slide.checkerCells),
    bottomFade: slide.bottomFade ?? false
  }

  aspectSlideSettings.value[getAspectKey()] = captureAspectSlideSettings()

  for (const settings of Object.values(aspectSlideSettings.value)) {
    const fields = settings[selectedPanel.value]?.[selectedIndex.value]
    if (fields) Object.assign(fields, backgroundFields)
  }

  saveSettings()
}

function applySelectedTextToAspectRatios() {
  const slide = selectedSlide.value
  if (!slide) return

  const textFields: Pick<
    AspectSlideFields,
    | 'heading'
    | 'headingHighlights'
    | 'headingSize'
    | 'headingAutoScale'
    | 'subheading'
    | 'subheadingSize'
    | 'legalText'
    | 'legalSize'
    | 'legalOpacity'
    | 'legalShadow'
    | 'legalShadowOpacity'
  > = {
    heading: slide.heading,
    headingHighlights: normalizeHeadingHighlights(slide.headingHighlights, slide.heading),
    headingSize: slide.headingSize,
    headingAutoScale: slide.headingAutoScale ?? false,
    subheading: slide.subheading,
    subheadingSize: slide.subheadingSize,
    legalText: slide.legalText,
    legalSize: slide.legalSize,
    legalOpacity: slide.legalOpacity,
    legalShadow: slide.legalShadow,
    legalShadowOpacity: slide.legalShadowOpacity
  }

  aspectSlideSettings.value[getAspectKey()] = captureAspectSlideSettings()

  const aspectKeys = new Set([
    ...Object.keys(aspectSlideSettings.value),
    ...quickAspectPresets.map(preset => getAspectKey(preset.width, preset.height)),
    ...allAspectPresets.value.map(preset => getAspectKey(preset.width, preset.height))
  ])

  for (const key of aspectKeys) {
    aspectSlideSettings.value[key] ||= captureAspectSlideSettings()
    const fields = aspectSlideSettings.value[key]?.[selectedPanel.value]?.[selectedIndex.value]
    if (fields) Object.assign(fields, textFields)
  }

  saveSettings()
}

function applySelectedLogoToAspectRatios() {
  const slide = selectedSlide.value
  if (!slide) return

  const logoFields: Pick<AspectSlideFields, 'logo' | 'logoWidth' | 'logoHeight'> = {
    logo: slide.logo,
    logoWidth: slide.logoWidth,
    logoHeight: slide.logoHeight
  }

  aspectSlideSettings.value[getAspectKey()] = captureAspectSlideSettings()

  const aspectKeys = new Set([
    ...Object.keys(aspectSlideSettings.value),
    ...quickAspectPresets.map(preset => getAspectKey(preset.width, preset.height)),
    ...allAspectPresets.value.map(preset => getAspectKey(preset.width, preset.height))
  ])

  for (const key of aspectKeys) {
    aspectSlideSettings.value[key] ||= captureAspectSlideSettings()
    const fields = aspectSlideSettings.value[key]?.[selectedPanel.value]?.[selectedIndex.value]
    if (fields) Object.assign(fields, logoFields)
  }

  saveSettings()
}

function applySelectedCtaToAspectRatios() {
  const slide = selectedSlide.value
  if (!slide) return

  const ctaFields: Pick<
    AspectSlideFields,
    'ctaText' | 'ctaSize' | 'ctaPulse' | 'ctaAlign' | 'ctaBottomMargin'
  > = {
    ctaText: slide.ctaText || '',
    ctaSize: slide.ctaSize ?? 100,
    ctaPulse: slide.ctaPulse ?? false,
    ctaAlign: slide.ctaAlign === 'left' ? 'left' : 'right',
    ctaBottomMargin: slide.ctaBottomMargin ?? false
  }

  aspectSlideSettings.value[getAspectKey()] = captureAspectSlideSettings()

  const aspectKeys = new Set([
    ...Object.keys(aspectSlideSettings.value),
    ...quickAspectPresets.map(preset => getAspectKey(preset.width, preset.height)),
    ...allAspectPresets.value.map(preset => getAspectKey(preset.width, preset.height))
  ])

  for (const key of aspectKeys) {
    aspectSlideSettings.value[key] ||= captureAspectSlideSettings()
    const fields = aspectSlideSettings.value[key]?.[selectedPanel.value]?.[selectedIndex.value]
    if (fields) Object.assign(fields, ctaFields)
  }

  saveSettings()
}

function getBrandBackgroundStyle(slide: Slide, portrait = isPortrait.value): Record<string, string | number> {
  if (slide.backgroundImage || slide.backgroundPreset === 'solid') {
    return {
      backgroundColor: slide.backgroundColor,
      backgroundImage: 'none',
      backgroundSize: 'auto'
    }
  }

  if (slide.backgroundPreset === 'checker') {
    const checkerCells = normalizeCheckerCells(slide.checkerCells)
    const checkerAngle = normalizeSplitAngle(slide.splitAngle)
    const checkerImage =
      `repeating-conic-gradient(from ${checkerAngle}deg, #ff00ff 0 25%, #7f30e3 0 50%, #ff00ff 0 75%, #7f30e3 0 100%)`
    const checkerSize = `${200 / checkerCells}% ${200 / checkerCells}%`

    return {
      backgroundColor: slide.backgroundColor,
      backgroundImage: checkerImage,
      backgroundSize: checkerSize,
      '--checker-cells': checkerCells,
      '--checker-angle': `${checkerAngle}deg`,
      '--checker-image': checkerImage,
      '--checker-size': checkerSize
    }
  }

  return {
    backgroundColor: slide.backgroundColor,
    backgroundImage:
      `linear-gradient(${(normalizeSplitAngle(slide.splitAngle) + (portrait ? 270 : 0)) % 360}deg, #ff00ff 0 50%, #7f30e3 50% 100%)`,
    backgroundSize: 'cover'
  }
}

function getAspectPreviewBackgroundStyle(slide: Slide, preset: AspectPreset): Record<string, string | number> {
  return getBrandBackgroundStyle(slide, preset.height >= preset.width)
}

function hasWhiteBackground(slide: Slide) {
  return (
    !slide.backgroundImage
    && slide.backgroundPreset === 'solid'
    && slide.backgroundColor.toLowerCase() === '#ffffff'
  )
}

function hasPurpleBackground(slide: Slide) {
  return (
    !slide.backgroundImage
    && slide.backgroundPreset === 'solid'
    && slide.backgroundColor.toLowerCase() === '#7f30e3'
  )
}

function isLogoImage(logo: string) {
  return logo.startsWith('data:') || logo === defaultLogo
}

function getLogoSource(slide: Slide) {
  if (slide.logo === defaultLogo && hasWhiteBackground(slide)) {
    return invertedDefaultLogo
  }

  if (slide.logo === defaultLogo && hasPurpleBackground(slide)) {
    return purpleLetterDefaultLogo
  }

  return slide.logo
}

function useDefaultLogo() {
  if (selectedSlide.value) selectedSlide.value.logo = defaultLogo
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
  const first = keyframes[0]
  if (!first) return [0]
  if (frame <= first.t) return getKeyStartValue(first)

  for (let index = 0; index < keyframes.length - 1; index += 1) {
    const current = keyframes[index]
    const next = keyframes[index + 1]
    if (!current || !next) continue
    if (frame >= current.t && frame <= next.t) {
      const span = Math.max(0.0001, next.t - current.t)
      return interpolateValues(
        getKeyStartValue(current),
        getKeyStartValue(next),
        (frame - current.t) / span
      )
    }
  }

  return getKeyStartValue(keyframes[keyframes.length - 1] ?? first)
}

function previousKeyIndex(
  keyframes: Array<{ t: number }>,
  frame: number
) {
  let index = -1
  for (let keyIndex = 0; keyIndex < keyframes.length; keyIndex += 1) {
    const keyframe = keyframes[keyIndex]
    if (keyframe && keyframe.t <= frame) index = keyIndex
    else break
  }
  return index
}

function velocityBeforeKey(
  keyframes: Array<{ t: number, s?: number[] }>,
  keyIndex: number,
  fps: number
) {
  if (keyIndex <= 0) {
    const keyframe = keyframes[Math.max(0, keyIndex)] ?? keyframes[0] ?? { s: [0] }
    return getKeyStartValue(keyframe).map(() => 0)
  }

  const previous = keyframes[keyIndex - 1]
  const current = keyframes[keyIndex]
  if (!previous || !current) return [0]
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
    image.crossOrigin = 'anonymous'
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', reject)
    image.src = source
  })
}

function isVideoSource(source: string) {
  return source.startsWith('data:video/')
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
  drawPlacedImage(context, image, width, height, 50, 50, 1)
}

function drawPlacedMedia(
  context: CanvasRenderingContext2D,
  source: CanvasImageSource,
  naturalWidth: number,
  naturalHeight: number,
  width: number,
  height: number,
  x: number,
  y: number,
  scaleMultiplier: number
) {
  const scale = Math.max(width / naturalWidth, height / naturalHeight)
    * Math.max(0.2, Math.min(6, scaleMultiplier))
  const renderedWidth = naturalWidth * scale
  const renderedHeight = naturalHeight * scale
  context.drawImage(
    source,
    width * normalizeBackgroundImageX(x) / 100 - renderedWidth / 2,
    height * normalizeBackgroundImageY(y) / 100 - renderedHeight / 2,
    renderedWidth,
    renderedHeight
  )
}

function drawPlacedImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number,
  x: number,
  y: number,
  scaleMultiplier: number
) {
  drawPlacedMedia(
    context,
    image,
    image.naturalWidth,
    image.naturalHeight,
    width,
    height,
    x,
    y,
    scaleMultiplier
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

  if (slide.backgroundPreset === 'checker' && !slide.backgroundImage) {
    const checkerCells = normalizeCheckerCells(slide.checkerCells)
    const tileWidth = width / checkerCells
    const tileHeight = height / checkerCells
    const radians = slide.splitAngle * Math.PI / 180
    const coverSize = Math.hypot(width, height)

    context.save()
    context.translate(width / 2, height / 2)
    context.rotate(radians)
    context.translate(-coverSize / 2, -coverSize / 2)

    for (let y = 0; y < coverSize; y += tileHeight) {
      for (let x = 0; x < coverSize; x += tileWidth) {
        context.fillStyle = (Math.floor(x / tileWidth) + Math.floor(y / tileHeight)) % 2 === 0
          ? '#ff00ff'
          : '#7f30e3'
        context.fillRect(x, y, tileWidth, tileHeight)
      }
    }

    context.restore()
  }

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
  if (backgroundImage) {
    drawPlacedImage(
      context,
      backgroundImage,
      width,
      height,
      normalizeBackgroundImageX(slide.backgroundImageX),
      normalizeBackgroundImageY(slide.backgroundImageY),
      normalizeBackgroundImageScale(slide.backgroundImageScale)
    )
  }
}

function drawVideoBackgroundFromDom(
  context: CanvasRenderingContext2D,
  element: HTMLElement,
  slide: Slide,
  width: number,
  height: number
) {
  const video = element.querySelector<HTMLVideoElement>('.draggable-background video')
  if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth || !video.videoHeight) {
    return
  }

  drawPlacedMedia(
    context,
    video,
    video.videoWidth,
    video.videoHeight,
    width,
    height,
    normalizeBackgroundImageX(slide.backgroundImageX),
    normalizeBackgroundImageY(slide.backgroundImageY),
    normalizeBackgroundImageScale(slide.backgroundImageScale)
  )
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
    if (isVideoSource(slide.backgroundImage)) {
      drawVideoBackgroundFromDom(context, element, slide, width, height)
    }
    if (slide.bottomFade) {
      const gradient = context.createLinearGradient(0, height * 0.42, 0, height)
      gradient.addColorStop(0, 'rgb(0 0 0 / 0%)')
      gradient.addColorStop((0.62 - 0.42) / (1 - 0.42), 'rgb(0 0 0 / 12%)')
      gradient.addColorStop(1, 'rgb(0 0 0 / 78%)')
      context.fillStyle = gradient
      context.fillRect(0, height * 0.42, width, height * 0.58)
    }

    const logoImageElement = clone.querySelector<HTMLImageElement>('.slide-logo img')
    if (logoImageElement) {
      const image = images.get(getLogoSource(slide)) || images.get(slide.logo)
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

    const ctaElement = clone.querySelector<HTMLElement>('.slide-cta')
    if (ctaElement) {
      const rect = ctaElement.getBoundingClientRect()
      const computed = getComputedStyle(ctaElement)
      const x = (rect.left - rootRect.left) * scaleX
      const y = (rect.top - rootRect.top) * scaleY
      const ctaWidth = rect.width * scaleX
      const ctaHeight = rect.height * scaleY
      const radius = Math.min(ctaWidth, ctaHeight) / 2
      context.save()
      context.fillStyle = computed.backgroundColor
      context.beginPath()
      context.roundRect(x, y, ctaWidth, ctaHeight, radius)
      context.fill()
      context.restore()
    }

    const textElements = clone.querySelectorAll<HTMLElement>(
      '.slide-cta, .slide-logo span, .slide-subheading, .slide-copy h2, .slide-legal'
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
  const stage = document.querySelector<HTMLElement>('.slot-stage--main')
  if (!stage) throw new Error('Unable to find the preview stage.')

  for (const side of panelSides) {
    const panel = stage.querySelector<HTMLElement>(`.slot-panel--${side}`)
    if (!panel) throw new Error(`Unable to find the ${side} preview panel.`)

    const elements = panel.querySelectorAll<HTMLElement>('.slot-slide')

    for (const [index, element] of [...elements].entries()) {
      const slide = panelSlides.value[side][index]
      if (!slide) continue

      snapshots.set(
        `${side}-${index}`,
        renderSlideSnapshot(
          element,
          slide,
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
  visualIndex: number,
  scale: number,
  origin: 'start' | 'end',
  width: number,
  height: number
) {
  if (scale <= 0) return
  const portrait = isPortrait.value
  const panelWidth = portrait ? width : width / 2
  const panelHeight = portrait ? height / 2 : height
  const x = portrait ? 0 : visualIndex === 0 ? 0 : panelWidth
  const y = portrait ? visualIndex === 0 ? 0 : panelHeight : 0
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

function toBlobPart(data: Uint8Array): ArrayBuffer {
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
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

  return new Blob([...localChunks, centralData, end].map(toBlobPart), { type: 'application/zip' })
}

async function downloadPngZip(
  files: Array<{ name: string, data: Uint8Array }>,
  prefix: string,
  filename = `${prefix}-png-sequence.zip`
) {
  const zip = createZip(files)
  downloadBlob(zip, filename)
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function checkLocalRenderer() {
  if (!useLocalRenderer.value) {
    localRendererStatus.value = 'idle'
    return false
  }

  localRendererStatus.value = 'checking'
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 1500)

  try {
    const response = await fetch(`${localRendererOrigin}/api/local-renderer-health`, {
      cache: 'no-store',
      signal: controller.signal
    })
    const result = response.ok
    localRendererStatus.value = result ? 'connected' : 'unavailable'
    return result
  } catch {
    localRendererStatus.value = 'unavailable'
    return false
  } finally {
    window.clearTimeout(timeout)
  }
}

async function updateLocalRendererPreference() {
  localStorage.setItem(localRendererPreferenceKey, String(useLocalRenderer.value))
  await checkLocalRenderer()
}

async function checkRemoteRenderer() {
  if (!remoteRendererOrigin) {
    remoteRendererStatus.value = 'idle'
    return false
  }

  remoteRendererStatus.value = 'checking'
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 5000)

  try {
    const response = await fetch(`${remoteRendererOrigin}/api/local-renderer-health`, {
      cache: 'no-store',
      signal: controller.signal
    })
    const result = response.ok
    remoteRendererStatus.value = result ? 'connected' : 'unavailable'
    return result
  } catch {
    remoteRendererStatus.value = 'unavailable'
    return false
  } finally {
    window.clearTimeout(timeout)
  }
}

async function readRenderResponse(
  response: Response,
  outputType: string,
  onProgress?: (message: { progress: number, status: string }) => void
) {
  const responseType = response.headers.get('content-type') || ''
  if (!responseType.includes('application/x-resizer-render-stream')) {
    return response.blob()
  }
  if (!response.body) {
    throw new Error('The renderer returned an empty response stream.')
  }

  const reader = response.body.getReader()
  const header = new Uint8Array(5)
  const resultChunks: Uint8Array[] = []
  const errorChunks: Uint8Array[] = []
  let progressChunks: Uint8Array[] = []
  let headerLength = 0
  let frameType: number | null = null
  let frameBytesRemaining = 0
  let resultComplete = false

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    let offset = 0

    while (offset < value.byteLength) {
      if (frameType === null) {
        const headerBytes = Math.min(5 - headerLength, value.byteLength - offset)
        header.set(value.subarray(offset, offset + headerBytes), headerLength)
        headerLength += headerBytes
        offset += headerBytes
        if (headerLength < 5) continue

        frameType = header[0] ?? null
        frameBytesRemaining = new DataView(header.buffer).getUint32(1)
        headerLength = 0
        if (frameBytesRemaining === 0) {
          if (frameType === 1) resultComplete = true
          frameType = null
        }
        continue
      }

      const payloadBytes = Math.min(frameBytesRemaining, value.byteLength - offset)
      const payload = value.slice(offset, offset + payloadBytes)
      if (frameType === 1) resultChunks.push(payload)
      if (frameType === 2) errorChunks.push(payload)
      if (frameType === 3) progressChunks.push(payload)
      offset += payloadBytes
      frameBytesRemaining -= payloadBytes

      if (frameBytesRemaining === 0) {
        if (frameType === 1) resultComplete = true
        if (frameType === 3) {
          try {
            const message = JSON.parse(await new Blob(progressChunks).text()) as {
              progress?: unknown
              status?: unknown
            }
            if (typeof message.progress === 'number' && typeof message.status === 'string') {
              onProgress?.({
                progress: Math.max(0, Math.min(1, message.progress)),
                status: message.status
              })
            }
          } catch {}
          progressChunks = []
        }
        frameType = null
      }
    }
  }

  if (errorChunks.length) {
    throw new Error(await new Blob(errorChunks).text())
  }
  if (!resultComplete) {
    throw new Error('The renderer connection closed before the output was ready.')
  }
  return new Blob(resultChunks, { type: outputType })
}

async function fetchRenderEndpoint(path: string, formData: FormData) {
  if (useLocalRenderer.value) {
    const localConnected = localRendererStatus.value === 'connected'
      || await checkLocalRenderer()

    if (localConnected) {
      try {
        return await fetch(`${localRendererOrigin}${path}`, {
          method: 'POST',
          body: formData
        })
      } catch {
        localRendererStatus.value = 'unavailable'
      }
    }
  }

  if (remoteRendererOrigin) {
    try {
      const response = await fetch(`${remoteRendererOrigin}${path}`, {
        method: 'POST',
        body: formData
      })
      remoteRendererStatus.value = 'connected'
      return response
    } catch {
      remoteRendererStatus.value = 'unavailable'
      throw new Error('The Railway renderer connection was lost. Please try the render again.')
    }
  }

  return fetch(path, { method: 'POST', body: formData })
}

async function downloadMp4(
  files: Array<{ name: string, data: Uint8Array }>,
  prefix: string,
  fps: number
) {
  const formData = new FormData()
  formData.set('fps', String(fps))
  formData.set('prefix', prefix)
  formData.set('motionBlur', String(motionBlur.value))
  formData.set('motionBlurIntensity', String(motionBlurIntensity.value))
  for (const file of files) {
    formData.append(
      'frames',
      new Blob([toBlobPart(file.data)], { type: 'image/png' }),
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

async function loadRenderImages() {
  const sources = new Set<string>()
  for (const side of panelSides) {
    for (const slide of panelSlides.value[side]) {
      if (slide.backgroundImage && !isVideoSource(slide.backgroundImage)) sources.add(slide.backgroundImage)
      const logoSource = getLogoSource(slide)
      if (isLogoImage(logoSource)) sources.add(logoSource)
    }
  }

  const images = new Map<string, HTMLImageElement>()
  await Promise.all([...sources].map(async source => {
    images.set(source, await loadRenderImage(source))
  }))
  return images
}

function getFrameState(time: number) {
  const firstPause = Number.isFinite(firstPauseSeconds.value)
    ? firstPauseSeconds.value
    : pauseSeconds.value
  const segments = Array.from(
    { length: slideCount.value },
    (_, index) => {
      const pause = index === 0 ? firstPause : pauseSeconds.value
      const hasTransition = loopSlides.value || index < slideCount.value - 1
      return pause + (hasTransition ? transitionSeconds.value : 0)
    }
  )

  let currentIndex = 0
  let segmentStart = 0
  for (let index = 0; index < slideCount.value; index += 1) {
    const segmentEnd = segmentStart + (segments[index] ?? 0)
    if (time < segmentEnd || index === slideCount.value - 1) {
      currentIndex = index
      break
    }
    segmentStart = segmentEnd
  }

  const localTime = time - segmentStart
  const currentPause = currentIndex === 0 ? firstPause : pauseSeconds.value
  const hasTransition = loopSlides.value || currentIndex < slideCount.value - 1
  const nextIndex = hasTransition ? (currentIndex + 1) % slideCount.value : currentIndex
  const transition = hasTransition && localTime >= currentPause && transitionSeconds.value > 0
  const progress = transition
    ? cubicBezierAt(Math.min(1, (localTime - currentPause) / transitionSeconds.value))
    : 0

  return { currentIndex, nextIndex, transition, progress }
}

function drawPanelFrame(
  context: CanvasRenderingContext2D,
  snapshots: Map<string, HTMLCanvasElement>,
  side: PanelSide,
  sideIndex: number,
  state: ReturnType<typeof getFrameState>,
  width: number,
  height: number
) {
  const visualIndex = activePanelSwap.value
    ? 1 - sideIndex
    : sideIndex
  const startOrigin = visualIndex === 0 ? 'start' : 'end'
  const endOrigin = visualIndex === 0 ? 'end' : 'start'
  const effectiveStart = reverseDirections.value ? endOrigin : startOrigin
  const effectiveEnd = reverseDirections.value ? startOrigin : endOrigin
  const current = snapshots.get(`${side}-${state.currentIndex}`)
  const next = snapshots.get(`${side}-${state.nextIndex}`)

  if (!state.transition) {
    if (current) drawScaledPanelSlide(context, current, visualIndex, 1, effectiveStart, width, height)
    return
  }

  if (next) {
    drawScaledPanelSlide(context, next, visualIndex, state.progress, effectiveStart, width, height)
  }
  if (current) {
    drawScaledPanelSlide(context, current, visualIndex, 1 - state.progress, effectiveEnd, width, height)
  }
}

async function renderPngSequenceInBrowser(
  width: number,
  height: number,
  fps: number,
  frameCount: number,
  prefix: string
) {
  exportStatus.value = 'Loading render assets'
  await document.fonts.ready
  const images = await loadRenderImages()
  const snapshots = createSlideSnapshots(width, height, images)
  const digits = String(frameCount).length
  const files: Array<{ name: string, data: Uint8Array }> = []

  exportStatus.value = `Rendering ${frameCount} PNG frames`
  for (let frame = 0; frame < frameCount; frame += 1) {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas rendering is not supported.')

    const state = getFrameState(frame / fps)
    panelSides.forEach((side, sideIndex) => {
      drawPanelFrame(context, snapshots, side, sideIndex, state, width, height)
    })

    const blob = await canvasToPng(canvas)
    files.push({
      name: `frame-${String(frame + 1).padStart(digits, '0')}.png`,
      data: new Uint8Array(await blob.arrayBuffer())
    })
    exportProgress.value = 0.05 + (frame + 1) / frameCount * 0.85

    if (frame % 4 === 3) {
      await new Promise(resolve => requestAnimationFrame(resolve))
    }
  }

  exportStatus.value = 'Packaging PNG files'
  exportProgress.value = 0.95
  await downloadPngZip(files, prefix)
}

function sanitizeRenderName(value: string) {
  return value.trim().replace(/[^\p{L}\p{N}_-]+/gu, '-') || 'aspects'
}

function getRenderDateStamp(date = new Date()) {
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${day}${month}${year}`
}

async function renderAspectGroupImagesOnServer(
  presets: AspectPreset[],
  groupLabel: string,
  renderScale = 1
) {
  const groupName = sanitizeRenderName(groupLabel)
  const settings: PersistedSettings = {
    ...getCurrentSettings(),
    selectedIndex: activeIndex.value,
    exportFormat: 'png'
  }
  const formData = new FormData()
  formData.set(
    'settings',
    new Blob([JSON.stringify(settings)], { type: 'application/json' }),
    'settings.json'
  )
  formData.set(
    'presets',
    new Blob([JSON.stringify(presets)], { type: 'application/json' }),
    'presets.json'
  )
  formData.set('groupLabel', groupLabel)
  formData.set('activeIndex', String(activeIndex.value))
  formData.set('renderScale', String(renderScale))

  exportStatus.value = renderScale > 1
    ? `Rendering ${renderScale}x screenshots on server`
    : 'Rendering screenshots on server'
  const estimatedRenderSeconds = Math.max(4, presets.length * (renderScale > 1 ? 0.8 : 0.45))
  const progressStartedAt = Date.now()
  clearInterval(exportProgressTimer)
  exportProgressTimer = setInterval(() => {
    const elapsed = (Date.now() - progressStartedAt) / 1000
    const estimated = Math.min(0.9, elapsed / estimatedRenderSeconds * 0.9)
    exportProgress.value = Math.max(exportProgress.value, estimated)
  }, 250)

  const response = await fetchRenderEndpoint('/api/render-aspect-group', formData)
  clearInterval(exportProgressTimer)
  exportProgress.value = 0.95

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || 'Server aspect render failed.')
  }

  const zip = await response.blob()
  downloadBlob(zip, `${groupName}_${getRenderDateStamp()}.zip`)
}

async function requestCurrentSlidePng() {
  storeCurrentAspectSettings()
  const settings: PersistedSettings = {
    ...getCurrentSettings(),
    selectedIndex: activeIndex.value,
    exportFormat: 'png'
  }
  const preset: AspectPreset = {
    label: activeAspectLabel.value,
    width: aspectWidth.value,
    height: aspectHeight.value,
    exportWidth: exportWidth.value,
    exportHeight: exportHeight.value
  }
  const formData = new FormData()
  formData.set(
    'settings',
    new Blob([JSON.stringify(settings)], { type: 'application/json' }),
    'settings.json'
  )
  formData.set(
    'presets',
    new Blob([JSON.stringify([preset])], { type: 'application/json' }),
    'presets.json'
  )
  formData.set('groupLabel', activeAspectLabel.value)
  formData.set('activeIndex', String(activeIndex.value))
  formData.set('renderScale', '1')
  formData.set('responseMode', 'png')

  const response = await fetchRenderEndpoint('/api/render-aspect-group', formData)
  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || 'Current slide render failed.')
  }

  const blob = await response.blob()
  return blob.type === 'image/png'
    ? blob
    : new Blob([blob], { type: 'image/png' })
}

async function copyCurrentSlideAsPng() {
  if (copySlideStatus.value === 'copying') return

  clearTimeout(copySlideStatusTimer)
  copySlideStatus.value = 'copying'

  try {
    if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
      throw new Error('PNG clipboard copying is not supported by this browser.')
    }

    const png = requestCurrentSlidePng()
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': png })
    ])
    copySlideStatus.value = 'copied'
  } catch (error) {
    console.error('Unable to copy current slide PNG.', error)
    copySlideStatus.value = 'error'
  }

  copySlideStatusTimer = setTimeout(() => {
    copySlideStatus.value = 'idle'
  }, 3000)
}

async function renderAspectGroupImages(
  presets: AspectPreset[],
  groupLabel: string,
  renderScale = 1
) {
  if (isExporting.value || presets.length === 0) return

  const originalAspect = {
    label: activeAspectLabel.value,
    width: aspectWidth.value,
    height: aspectHeight.value,
    exportWidth: exportWidth.value,
    exportHeight: exportHeight.value
  }
  const wasPlaying = isPlaying.value

  isExporting.value = true
  isRenderingAspectGroup.value = true
  exportError.value = ''
  exportProgress.value = 0
  exportStatus.value = 'Preparing aspect renders'
  isPlaying.value = false
  restartAutoplay()

  try {
    storeCurrentAspectSettings()
    await renderAspectGroupImagesOnServer(presets, groupLabel, renderScale)
    exportProgress.value = 1
    exportStatus.value = 'Complete'
  } catch (error) {
    exportError.value = error instanceof Error
      ? error.message
      : 'Aspect group render failed.'
  } finally {
    clearInterval(exportProgressTimer)
    setAspectRatio(originalAspect)
    await nextTick()
    isPlaying.value = wasPlaying
    restartAutoplay()
    isRenderingAspectGroup.value = false
    isExporting.value = false
  }
}

async function renderSequence() {
  if (isExporting.value) return

  exportError.value = ''
  const width = Math.max(minExportDimension, Math.min(maxExportDimension, Math.round(exportWidth.value)))
  const height = Math.max(minExportDimension, Math.min(maxExportDimension, Math.round(exportHeight.value)))
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
    storeCurrentAspectSettings()
    const prefix = exportPrefix.value.trim().replace(/[^\w-]+/g, '-') || 'frame'
    if (
      exportFormat.value === 'png'
      && !showPackshotOnFinalSlide.value
      && !hasPulsingCta.value
      && !hasCta.value
      && !textLineTransition.value
      && !motionBlur.value
    ) {
      await renderPngSequenceInBrowser(width, height, fps, frameCount, prefix)
      exportProgress.value = 1
      exportStatus.value = 'Complete'
      return
    }

    const previewStage = document.querySelector<HTMLElement>('.slot-stage--main')
    const previewRect = previewStage?.getBoundingClientRect()
    const settings: PersistedSettings = {
      panelSlides: panelSlides.value,
      aspectSlideSettings: aspectSlideSettings.value,
      aspectPackshotWidths: aspectPackshotWidths.value,
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
      narrowHorizontalAnimation: narrowHorizontalAnimation.value,
      textLineTransition: textLineTransition.value,
      motionBlur: motionBlur.value,
      motionBlurIntensity: motionBlurIntensity.value,
      contentLayoutPreset: contentLayoutPreset.value,
      swapVerticalPanels: swapVerticalPanels.value,
      swapHorizontalPanels: swapHorizontalPanels.value,
      swapUltraNarrowPanels: swapUltraNarrowPanels.value,
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

    const response = await fetchRenderEndpoint('/api/render-browser', formData)
    const streamedResponse = (response.headers.get('content-type') || '')
      .includes('application/x-resizer-render-stream')
    if (streamedResponse) clearInterval(exportProgressTimer)

    if (!response.ok) {
      clearInterval(exportProgressTimer)
      const message = await response.text()
      throw new Error(message || 'Browser render failed.')
    }

    if (!streamedResponse) {
      clearInterval(exportProgressTimer)
      exportProgress.value = 0.95
      exportStatus.value = exportFormat.value === 'mp4'
        ? 'Finalizing MP4'
        : 'Packaging PNG files'
    }

    const output = await readRenderResponse(
      response,
      exportFormat.value === 'mp4' ? 'video/mp4' : 'application/zip',
      message => {
        exportProgress.value = message.progress
        exportStatus.value = message.status
      }
    )
    clearInterval(exportProgressTimer)
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
    && (slide.backgroundImageX === undefined || typeof slide.backgroundImageX === 'number')
    && (slide.backgroundImageY === undefined || typeof slide.backgroundImageY === 'number')
    && (slide.backgroundImageScale === undefined || typeof slide.backgroundImageScale === 'number')
    && typeof slide.backgroundColor === 'string'
    && (
      slide.backgroundPreset === undefined
      || slide.backgroundPreset === 'solid'
      || slide.backgroundPreset === 'split'
      || slide.backgroundPreset === 'checker'
    )
    && (slide.splitAngle === undefined || typeof slide.splitAngle === 'number')
    && (slide.checkerCells === undefined || typeof slide.checkerCells === 'number')
    && (slide.bottomFade === undefined || typeof slide.bottomFade === 'boolean')
    && typeof slide.heading === 'string'
    && isValidHeadingHighlights(slide.headingHighlights)
    && (slide.headingSize === undefined || typeof slide.headingSize === 'number')
    && (slide.headingAutoScale === undefined || typeof slide.headingAutoScale === 'boolean')
    && typeof slide.subheading === 'string'
    && (slide.subheadingSize === undefined || typeof slide.subheadingSize === 'number')
    && (slide.ctaText === undefined || typeof slide.ctaText === 'string')
    && (slide.ctaSize === undefined || typeof slide.ctaSize === 'number')
    && (slide.ctaPulse === undefined || typeof slide.ctaPulse === 'boolean')
    && (slide.ctaAlign === undefined || slide.ctaAlign === 'left' || slide.ctaAlign === 'right')
    && (slide.ctaBottomMargin === undefined || typeof slide.ctaBottomMargin === 'boolean')
    && typeof slide.logo === 'string'
    && (slide.logoWidth === undefined || typeof slide.logoWidth === 'number')
    && (slide.logoHeight === undefined || typeof slide.logoHeight === 'number')
    && typeof slide.legalText === 'string'
    && (slide.legalSize === undefined || typeof slide.legalSize === 'number')
    && (slide.legalOpacity === undefined || typeof slide.legalOpacity === 'number')
    && (slide.legalShadow === undefined || typeof slide.legalShadow === 'boolean')
    && (
      slide.legalShadowOpacity === undefined
      || typeof slide.legalShadowOpacity === 'number'
    )
  )
}

function normalizeSlide(slide: Slide): Slide {
  return {
    ...slide,
    backgroundImageX: normalizeBackgroundImageX(slide.backgroundImageX),
    backgroundImageY: normalizeBackgroundImageY(slide.backgroundImageY),
    backgroundImageScale: normalizeBackgroundImageScale(slide.backgroundImageScale),
    backgroundPreset: normalizeBackgroundPreset(slide.backgroundPreset),
    splitAngle: normalizeSplitAngle(slide.splitAngle),
    checkerCells: normalizeCheckerCells(slide.checkerCells),
    bottomFade: slide.bottomFade ?? false,
    headingHighlights: normalizeHeadingHighlights(slide.headingHighlights, slide.heading),
    headingAutoScale: slide.headingAutoScale ?? false,
    headingSize:
      typeof slide.headingSize === 'number'
        ? Math.max(25, Math.min(200, slide.headingSize))
        : 100,
    subheadingSize:
      typeof slide.subheadingSize === 'number'
        ? Math.max(25, Math.min(200, slide.subheadingSize))
        : 100,
    ctaText: typeof slide.ctaText === 'string' ? slide.ctaText : '',
    ctaSize:
      typeof slide.ctaSize === 'number'
        ? Math.max(25, Math.min(200, slide.ctaSize))
        : 100,
    ctaPulse: slide.ctaPulse ?? false,
    ctaAlign: slide.ctaAlign === 'left' ? 'left' : 'right',
    ctaBottomMargin: slide.ctaBottomMargin ?? false,
    logoWidth:
      typeof slide.logoWidth === 'number'
        ? slide.logoWidth > 100
          ? Math.max(1, Math.min(100, slide.logoWidth / 4.5))
          : Math.max(1, Math.min(100, slide.logoWidth))
        : 40,
    logoHeight: typeof slide.logoHeight === 'number' ? slide.logoHeight : 52,
    legalSize:
      typeof slide.legalSize === 'number'
        ? Math.max(25, Math.min(400, slide.legalSize))
        : 100,
    legalOpacity:
      typeof slide.legalOpacity === 'number'
        ? Math.max(0, Math.min(100, slide.legalOpacity))
        : 72,
    legalShadow: typeof slide.legalShadow === 'boolean' ? slide.legalShadow : false,
    legalShadowOpacity:
      typeof slide.legalShadowOpacity === 'number'
        ? Math.max(0, Math.min(100, slide.legalShadowOpacity))
        : 35
  }
}

function isValidAspectSlideFields(value: unknown): value is AspectSlideFields {
  if (!value || typeof value !== 'object') return false
  const fields = value as Partial<AspectSlideFields>

  return (
    (fields.backgroundColor === undefined || typeof fields.backgroundColor === 'string')
    && (
      fields.backgroundPreset === undefined
      || fields.backgroundPreset === 'solid'
      || fields.backgroundPreset === 'split'
      || fields.backgroundPreset === 'checker'
    )
    && (fields.splitAngle === undefined || typeof fields.splitAngle === 'number')
    && (fields.checkerCells === undefined || typeof fields.checkerCells === 'number')
    && (fields.bottomFade === undefined || typeof fields.bottomFade === 'boolean')
    && typeof fields.heading === 'string'
    && isValidHeadingHighlights(fields.headingHighlights)
    && typeof fields.headingSize === 'number'
    && (fields.headingAutoScale === undefined || typeof fields.headingAutoScale === 'boolean')
    && typeof fields.subheading === 'string'
    && (fields.subheadingSize === undefined || typeof fields.subheadingSize === 'number')
    && (fields.ctaText === undefined || typeof fields.ctaText === 'string')
    && (fields.ctaSize === undefined || typeof fields.ctaSize === 'number')
    && (fields.ctaPulse === undefined || typeof fields.ctaPulse === 'boolean')
    && (fields.ctaAlign === undefined || fields.ctaAlign === 'left' || fields.ctaAlign === 'right')
    && (fields.ctaBottomMargin === undefined || typeof fields.ctaBottomMargin === 'boolean')
    && typeof fields.logo === 'string'
    && typeof fields.logoWidth === 'number'
    && typeof fields.logoHeight === 'number'
    && typeof fields.legalText === 'string'
    && (fields.legalSize === undefined || typeof fields.legalSize === 'number')
    && (fields.legalOpacity === undefined || typeof fields.legalOpacity === 'number')
    && (fields.legalShadow === undefined || typeof fields.legalShadow === 'boolean')
    && (
      fields.legalShadowOpacity === undefined
      || typeof fields.legalShadowOpacity === 'number'
    )
    && (fields.backgroundImageX === undefined || typeof fields.backgroundImageX === 'number')
    && (fields.backgroundImageY === undefined || typeof fields.backgroundImageY === 'number')
    && (fields.backgroundImageScale === undefined || typeof fields.backgroundImageScale === 'number')
  )
}

function normalizeAspectSlideFields(fields: AspectSlideFields): AspectSlideFields {
  return {
    ...fields,
    ...(typeof fields.backgroundColor === 'string'
      ? { backgroundColor: fields.backgroundColor }
      : {}),
    ...(fields.backgroundPreset === 'solid'
      || fields.backgroundPreset === 'split'
      || fields.backgroundPreset === 'checker'
      ? { backgroundPreset: normalizeBackgroundPreset(fields.backgroundPreset) }
      : {}),
    ...(typeof fields.splitAngle === 'number'
      ? { splitAngle: normalizeSplitAngle(fields.splitAngle) }
      : {}),
    ...(typeof fields.checkerCells === 'number'
      ? { checkerCells: normalizeCheckerCells(fields.checkerCells) }
      : {}),
    bottomFade: fields.bottomFade ?? false,
    headingHighlights: normalizeHeadingHighlights(fields.headingHighlights, fields.heading),
    headingAutoScale: fields.headingAutoScale ?? false,
    headingSize: Math.max(25, Math.min(200, fields.headingSize)),
    subheadingSize: Math.max(25, Math.min(200, fields.subheadingSize ?? 100)),
    ctaText: typeof fields.ctaText === 'string' ? fields.ctaText : '',
    ctaSize: Math.max(25, Math.min(200, fields.ctaSize ?? 100)),
    ctaPulse: fields.ctaPulse ?? false,
    ctaAlign: fields.ctaAlign === 'left' ? 'left' : 'right',
    ctaBottomMargin: fields.ctaBottomMargin ?? false,
    logoWidth: Math.max(1, Math.min(100, fields.logoWidth)),
    logoHeight: Math.max(1, Math.min(200, fields.logoHeight)),
    legalSize: Math.max(25, Math.min(400, fields.legalSize ?? 100)),
    legalOpacity: Math.max(0, Math.min(100, fields.legalOpacity ?? 72)),
    legalShadow: fields.legalShadow ?? false,
    legalShadowOpacity: Math.max(0, Math.min(100, fields.legalShadowOpacity ?? 35)),
    backgroundImageX: normalizeBackgroundImageX(fields.backgroundImageX),
    backgroundImageY: normalizeBackgroundImageY(fields.backgroundImageY),
    backgroundImageScale: normalizeBackgroundImageScale(fields.backgroundImageScale)
  }
}

function normalizeAspectSlideSettings(value: unknown): Record<string, AspectSlideSettings> {
  if (!value || typeof value !== 'object') return {}

  const nextSettings: Record<string, AspectSlideSettings> = {}
  for (const [key, setting] of Object.entries(value)) {
    const candidate = setting as Partial<AspectSlideSettings>
    if (
      !Array.isArray(candidate.left)
      || !Array.isArray(candidate.right)
      || !candidate.left.every(isValidAspectSlideFields)
      || !candidate.right.every(isValidAspectSlideFields)
    ) {
      continue
    }

    nextSettings[normalizeAspectKey(key)] = {
      left: candidate.left.map(normalizeAspectSlideFields),
      right: candidate.right.map(normalizeAspectSlideFields)
    }
  }

  return nextSettings
}

function normalizeAspectPackshotWidths(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object') return {}

  const widths: Record<string, number> = {}
  for (const [key, width] of Object.entries(value)) {
    if (typeof width === 'number') {
      widths[normalizeAspectKey(key)] = normalizePackshotWidth(width)
    }
  }

  return widths
}

function applySettings(settings: Partial<PersistedSettings>) {
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
    exportWidth.value = Math.max(minExportDimension, Math.min(maxExportDimension, Math.round(settings.exportWidth)))
  }
  if (typeof settings.exportHeight === 'number') {
    exportHeight.value = Math.max(minExportDimension, Math.min(maxExportDimension, Math.round(settings.exportHeight)))
  }
  if (typeof settings.narrowHorizontalAnimation === 'boolean') {
    narrowHorizontalAnimation.value = settings.narrowHorizontalAnimation
  }
  if (typeof settings.textLineTransition === 'boolean') {
    textLineTransition.value = settings.textLineTransition
  }
  if (typeof settings.motionBlur === 'boolean') {
    motionBlur.value = settings.motionBlur
  }
  if (typeof settings.motionBlurIntensity === 'number') {
    motionBlurIntensity.value = Math.max(0, Math.min(100, settings.motionBlurIntensity))
  }
  contentLayoutPreset.value = settings.contentLayoutPreset === 'adaptive-split'
    ? 'adaptive-split'
    : 'stacked'
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
  aspectSlideSettings.value = normalizeAspectSlideSettings(settings.aspectSlideSettings)
  aspectPackshotWidths.value = normalizeAspectPackshotWidths(settings.aspectPackshotWidths)
  const savedCustomPresets = normalizeCustomAspectPresets(settings.customAspectPresets)
  const savedCustomPacks = normalizeCustomAspectPacks(settings.customAspectPacks)
  if (settings.aspectWorkspaceVersion === aspectWorkspaceVersion) {
    customAspectPresets.value = savedCustomPresets
    customAspectPacks.value = savedCustomPacks
  } else {
    const defaultPackIds = new Set(defaultCustomAspectPacks.map(pack => pack.id))
    const defaultPresetLabels = new Set(defaultCustomAspectPresets.map(preset => preset.label))
    customAspectPacks.value = [
      ...defaultCustomAspectPacks.map(pack => ({ ...pack })),
      ...savedCustomPacks.filter(pack => !defaultPackIds.has(pack.id))
    ]
    customAspectPresets.value = [
      ...defaultCustomAspectPresets.map(preset => ({ ...preset })),
      ...savedCustomPresets.filter(preset => !defaultPresetLabels.has(preset.label))
    ]
  }
  applyAspectSlideSettings(getAspectKey())

  if (typeof settings.reverseDirections === 'boolean') {
    reverseDirections.value = settings.reverseDirections
  }
  if (typeof settings.swapVerticalPanels === 'boolean') {
    swapVerticalPanels.value = settings.swapVerticalPanels
  }
  if (typeof settings.swapHorizontalPanels === 'boolean') {
    swapHorizontalPanels.value = settings.swapHorizontalPanels
  }
  if (typeof settings.swapUltraNarrowPanels === 'boolean') {
    swapUltraNarrowPanels.value = settings.swapUltraNarrowPanels
  }
  if (typeof settings.loopSlides === 'boolean') {
    loopSlides.value = settings.loopSlides
  }
  if (typeof settings.showPackshotOnFinalSlide === 'boolean') {
    showPackshotOnFinalSlide.value = settings.showPackshotOnFinalSlide
  }
  if (typeof settings.packshotWidth === 'number') {
    packshotWidth.value = normalizePackshotWidth(settings.packshotWidth)
    if (!aspectPackshotWidths.value[getAspectKey()]) {
      aspectPackshotWidths.value[getAspectKey()] = packshotWidth.value
    }
  }
  applyAspectPackshotWidth(getAspectKey())

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
}

function openSettingsDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(settingsDatabaseName, 1)

    request.addEventListener('upgradeneeded', () => {
      const database = request.result
      if (!database.objectStoreNames.contains(settingsStoreName)) {
        database.createObjectStore(settingsStoreName)
      }
    })
    request.addEventListener('success', () => resolve(request.result))
    request.addEventListener('error', () => reject(request.error))
  })
}

async function readSettingsFromIndexedDb() {
  const database = await openSettingsDatabase()

  return new Promise<string | null>((resolve, reject) => {
    const transaction = database.transaction(settingsStoreName, 'readonly')
    const store = transaction.objectStore(settingsStoreName)
    const request = store.get(settingsRecordKey)

    request.addEventListener('success', () => {
      resolve(typeof request.result === 'string' ? request.result : null)
    })
    request.addEventListener('error', () => reject(request.error))
    transaction.addEventListener('complete', () => database.close())
    transaction.addEventListener('abort', () => {
      database.close()
      reject(transaction.error)
    })
  })
}

async function writeSettingsToIndexedDb(serializedSettings: string) {
  const database = await openSettingsDatabase()

  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(settingsStoreName, 'readwrite')
    const store = transaction.objectStore(settingsStoreName)
    store.put(serializedSettings, settingsRecordKey)

    transaction.addEventListener('complete', () => {
      database.close()
      resolve()
    })
    transaction.addEventListener('abort', () => {
      database.close()
      reject(transaction.error)
    })
    transaction.addEventListener('error', () => {
      database.close()
      reject(transaction.error)
    })
  })
}

async function removeSettingsFromIndexedDb() {
  const database = await openSettingsDatabase()

  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(settingsStoreName, 'readwrite')
    const store = transaction.objectStore(settingsStoreName)
    store.delete(settingsRecordKey)

    transaction.addEventListener('complete', () => {
      database.close()
      resolve()
    })
    transaction.addEventListener('abort', () => {
      database.close()
      reject(transaction.error)
    })
    transaction.addEventListener('error', () => {
      database.close()
      reject(transaction.error)
    })
  })
}

async function loadSettings() {
  try {
    if (window.__slotAnimationRenderSettings) {
      applySettings(window.__slotAnimationRenderSettings)
      window.__slotAnimationRenderSettingsLoaded = true
      return
    }

    const saved = await readSettingsFromIndexedDb()
      .catch(() => localStorage.getItem(storageKey))
      || localStorage.getItem(storageKey)
    if (!saved) return

    const settings = JSON.parse(saved) as Partial<PersistedSettings>
    applySettings(settings)
    void writeSettingsToIndexedDb(saved)
  } catch {
    localStorage.removeItem(storageKey)
    void removeSettingsFromIndexedDb()
  }
}

function getCurrentSettings(): PersistedSettings {
  storeCurrentAspectSettings()

  return {
    panelSlides: panelSlides.value,
    aspectWorkspaceVersion,
    aspectSlideSettings: aspectSlideSettings.value,
    aspectPackshotWidths: aspectPackshotWidths.value,
    customAspectPresets: customAspectPresets.value,
    customAspectPacks: customAspectPacks.value,
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
    narrowHorizontalAnimation: narrowHorizontalAnimation.value,
    textLineTransition: textLineTransition.value,
    motionBlur: motionBlur.value,
    motionBlurIntensity: motionBlurIntensity.value,
    contentLayoutPreset: contentLayoutPreset.value,
    swapVerticalPanels: swapVerticalPanels.value,
    swapHorizontalPanels: swapHorizontalPanels.value,
    swapUltraNarrowPanels: swapUltraNarrowPanels.value,
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
}

function stripInlineStorageAsset(source: string) {
  return source.startsWith('data:') || source.startsWith('blob:') ? '' : source
}

function createLocalStorageFallbackSettings(settings: PersistedSettings): PersistedSettings {
  const sanitizeSlide = (slide: Slide): Slide => ({
    ...slide,
    backgroundImage: stripInlineStorageAsset(slide.backgroundImage),
    logo: stripInlineStorageAsset(slide.logo)
  })
  const sanitizeFields = (fields: AspectSlideFields): AspectSlideFields => ({
    ...fields,
    logo: stripInlineStorageAsset(fields.logo)
  })

  return {
    ...settings,
    panelSlides: {
      left: settings.panelSlides.left.map(sanitizeSlide),
      right: settings.panelSlides.right.map(sanitizeSlide)
    },
    aspectSlideSettings: Object.fromEntries(
      Object.entries(settings.aspectSlideSettings || {}).map(([key, value]) => [
        key,
        {
          left: value.left.map(sanitizeFields),
          right: value.right.map(sanitizeFields)
        }
      ])
    )
  }
}

async function saveSettings() {
  const settings = getCurrentSettings()
  const serializedSettings = JSON.stringify(settings)

  try {
    await writeSettingsToIndexedDb(serializedSettings)
  } catch (error) {
    console.warn('Unable to save animation settings to IndexedDB.', error)
  }

  try {
    localStorage.setItem(
      storageKey,
      JSON.stringify(createLocalStorageFallbackSettings(settings))
    )
  } catch (error) {
    console.warn('Unable to save animation settings to localStorage fallback.', error)
  }
}

function createPresetPayload() {
  return {
    type: 'wb-gen-preset',
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: getCurrentSettings()
  }
}

function isPresetImport(value: unknown): value is {
  type?: string
  settings?: Partial<PersistedSettings>
} & Partial<PersistedSettings> {
  return Boolean(value && typeof value === 'object')
}

function importPreset(data: unknown) {
  try {
    if (!isPresetImport(data)) throw new Error('Preset file is not valid JSON.')
    const settings = data.type === 'wb-gen-preset' && data.settings ? data.settings : data
    const leftSlides = settings.panelSlides?.left
    const rightSlides = settings.panelSlides?.right

    if (
      !Array.isArray(leftSlides)
      || !Array.isArray(rightSlides)
      || leftSlides.length === 0
      || leftSlides.length !== rightSlides.length
      || !leftSlides.every(isValidSlide)
      || !rightSlides.every(isValidSlide)
    ) {
      throw new Error('Preset file does not contain valid slide settings.')
    }

    applySettings(settings)
    saveSettings()
  } catch (error) {
    exportError.value = error instanceof Error
      ? error.message
      : 'Unable to import preset.'
  }
}

function showPresetError(message: string) {
  exportError.value = message
}

function recordUndoSnapshot() {
  const snapshot = JSON.stringify(getCurrentSettings())
  if (undoHistory[undoHistory.length - 1] === snapshot) return

  undoHistory.push(snapshot)
  if (undoHistory.length > maxUndoHistory) undoHistory.shift()
}

function scheduleUndoSnapshot() {
  clearTimeout(undoSnapshotTimer)
  undoSnapshotTimer = setTimeout(recordUndoSnapshot, 250)
}

function undoLastChange() {
  clearTimeout(undoSnapshotTimer)
  recordUndoSnapshot()
  if (undoHistory.length < 2) return

  undoHistory.pop()
  const previousSnapshot = undoHistory[undoHistory.length - 1]
  if (!previousSnapshot) return

  applySettings(JSON.parse(previousSnapshot) as Partial<PersistedSettings>)
  clearTimeout(transitionTimer)
  leavingIndex.value = null
  restartAutoplay()
}

function scheduleSave() {
  clearTimeout(saveTimer)
  clearInterval(exportProgressTimer)
  saveTimer = setTimeout(saveSettings, 250)
  scheduleUndoSnapshot()
}

onMounted(async () => {
  await loadSettings()
  useLocalRenderer.value = localStorage.getItem(localRendererPreferenceKey) === 'true'
  if (useLocalRenderer.value) void checkLocalRenderer()
  if (remoteRendererOrigin) void checkRemoteRenderer()
  recordUndoSnapshot()
  initPackshotAnimation()
  restartAutoplay()
  window.addEventListener('keydown', handlePlaybackShortcut)

  watch(
    [
      panelSlides,
      customAspectPresets,
      customAspectPacks,
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
      narrowHorizontalAnimation,
      textLineTransition,
      motionBlur,
      motionBlurIntensity,
      contentLayoutPreset,
      swapVerticalPanels,
      swapHorizontalPanels,
      swapUltraNarrowPanels,
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
  clearTimeout(undoSnapshotTimer)
  clearTimeout(packshotStartTimer)
  clearTimeout(copySlideStatusTimer)
  if (packshotTransitionFrame) cancelAnimationFrame(packshotTransitionFrame)
  cancelTextAnimationReset()
  stopCurveDrag()
  packshotAnimation?.destroy()
  packshotAnimation = null
  window.__packshotAnimation = null
  window.removeEventListener('keydown', handlePlaybackShortcut)
  saveSettings()
})

watch([transitionSeconds, pauseSeconds, firstPauseSeconds], restartAutoplay)
watch(motionBlur, (enabled) => {
  if (!enabled) clearMotionTrails()
})
watch(textLineTransition, (enabled) => {
  if (enabled) clearMotionTrails()
})
watch([packshotRenderer, packshotPlayback], () => {
  void initPackshotAnimation()
})
watch([showPackshotOnFinalSlide, activeIndex, leavingIndex, slideCount], syncPackshotState)
</script>

<template>
  <main class="animation-generator">
    <UndoShortcut @undo="undoLastChange" />
    <section class="animation-preview" aria-label="Animation preview">
      <div
        class="stage-zoom-frame"
        :class="{ 'is-portrait': isPortrait }"
        :style="{
          '--stage-preview-zoom': previewZoomScale,
          aspectRatio: `${aspectWidth} / ${aspectHeight}`
        }"
      >
        <div
          class="slot-stage"
          :class="{
            'slot-stage--main': true,
            'is-portrait': isPortrait,
            'is-ultra-narrow': isUltraNarrow,
            'is-reversed': reverseDirections,
            'is-horizontal-animation': isUltraNarrow && narrowHorizontalAnimation,
            'has-motion-blur': motionBlur,
            'is-transitioning': leavingIndex !== null,
            'has-adaptive-content-layout': contentLayoutPreset === 'adaptive-split',
            'is-swapped': isPortrait && activePanelSwap,
            'is-snapping': isSnappingSlides,
            'is-resetting-text-animation': isResettingTextAnimation
          }"
          :style="{
            '--transition-duration': `${transitionSeconds}s`,
            '--transition-curve': easingValue,
            '--motion-trail-opacity': motionTrailOpacity,
            aspectRatio: `${aspectWidth} / ${aspectHeight}`
          }"
        >
          <div
            v-for="side in stagePanelSides"
            :key="side"
            class="slot-panel"
            :class="[
              `slot-panel--${side}`,
              side === getVisualStartSide()
                ? 'slot-panel--visual-start'
                : 'slot-panel--visual-end'
            ]"
          >
            <article
              v-for="(slide, index) in panelSlides[side]"
              :key="index"
              class="slot-slide"
              :class="{
                'is-active': activeIndex === index,
                'is-leaving': leavingIndex === index,
                'has-checker-background': !slide.backgroundImage && slide.backgroundPreset === 'checker',
                'has-bottom-fade': slide.bottomFade
              }"
              :style="getBrandBackgroundStyle(slide)"
              :aria-hidden="activeIndex !== index"
            >
              <DraggableBackground
                v-if="slide.backgroundImage"
                :src="slide.backgroundImage"
                :x="normalizeBackgroundImageX(slide.backgroundImageX)"
                :y="normalizeBackgroundImageY(slide.backgroundImageY)"
                :scale="normalizeBackgroundImageScale(slide.backgroundImageScale)"
                :editable="side === selectedPanel && index === selectedIndex && activeIndex === index"
                @update:x="slide.backgroundImageX = $event"
                @update:y="slide.backgroundImageY = $event"
                @update:scale="slide.backgroundImageScale = $event"
              />
              <div
                class="slide-content"
                :class="{
                  'has-brand-pink-text': hasWhiteBackground(getLayoutContentSlide(side, index))
                }"
                :style="{
                  '--logo-width': `${getLayoutContentSlide(side, index).logoWidth}%`
                }"
              >
                <SlideCta
                  :text="getLayoutContentSlide(side, index).ctaText"
                  :size="getLayoutContentSlide(side, index).ctaSize"
                  :pulse="getLayoutContentSlide(side, index).ctaPulse"
                  :align="getLayoutContentSlide(side, index).ctaAlign"
                  :bottom-margin="getLayoutContentSlide(side, index).ctaBottomMargin"
                />

                <div
                  class="slide-logo"
                  :class="{
                    'has-logo-image': isLogoImage(getLayoutContentSlide(side, index).logo),
                    'is-empty': !getLayoutContentSlide(side, index).logo
                  }"
                >
                  <img
                    v-if="isLogoImage(getLayoutContentSlide(side, index).logo)"
                    :src="getLogoSource(getLayoutContentSlide(side, index))"
                    :style="{
                      width: isUltraNarrow
                        ? '100%'
                        : `${getLayoutContentSlide(side, index).logoWidth}%`,
                      height: 'auto'
                    }"
                    alt=""
                  >
                  <span v-else-if="getLayoutContentSlide(side, index).logo">
                    {{ getLayoutContentSlide(side, index).logo }}
                  </span>
                </div>

                <AnimatedSlideCopy
                  :heading="getLayoutContentSlide(side, index).heading"
                  :heading-highlights="getLayoutContentSlide(side, index).headingHighlights"
                  :heading-size="getLayoutContentSlide(side, index).headingSize"
                  :heading-auto-scale="getLayoutContentSlide(side, index).headingAutoScale"
                  :subheading="getLayoutContentSlide(side, index).subheading"
                  :subheading-size="getLayoutContentSlide(side, index).subheadingSize"
                  :animate="textLineTransition"
                />

                <p
                  v-if="getLayoutContentSlide(side, index).legalText"
                  class="slide-legal"
                  :style="{
                    '--legal-scale': getLayoutContentSlide(side, index).legalSize / 100,
                    '--legal-opacity': getLayoutContentSlide(side, index).legalOpacity / 100,
                    '--legal-shadow': getLayoutContentSlide(side, index).legalShadow
                      ? `0 1px 3px rgb(0 0 0 / ${getLayoutContentSlide(side, index).legalShadowOpacity}%)`
                      : 'none'
                  }"
                >
                  {{ getLayoutContentSlide(side, index).legalText }}
                </p>
              </div>
            </article>
            <div class="motion-trail-layer" aria-hidden="true" />
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
      </div>

      <div class="preview-toolbar">
        <button type="button" class="play-button" @click="togglePlayback">
          {{ isPlaying ? 'Stop' : 'Play' }}
        </button>

        <StageZoomControl v-model="previewZoom" />

        <SlideTimeline
          :count="slideCount"
          :current-index="activeIndex"
          :leaving-index="leavingIndex"
          :is-playing="isPlaying"
          :first-pause-seconds="firstPauseSeconds"
          :pause-seconds="pauseSeconds"
          :transition-seconds="transitionSeconds"
          :loop="loopSlides"
          @select="selectSlide"
        />
      </div>

      <AspectPreviewGrid
        :presets="allAspectPresets"
        :packs="allAspectPacks"
        :active-width="aspectWidth"
        :active-height="aspectHeight"
        :get-slides="getAspectPreviewSlides"
        :get-background-style="getAspectPreviewBackgroundStyle"
        :is-logo-image="isLogoImage"
        :get-logo-source="getLogoSource"
        :has-white-background="hasWhiteBackground"
        :swap-vertical-panels="swapVerticalPanels"
        :swap-horizontal-panels="swapHorizontalPanels"
        :swap-ultra-narrow-panels="swapUltraNarrowPanels"
        :content-layout-preset="contentLayoutPreset"
        :render-disabled="isExporting"
        :is-rendering="isRenderingAspectGroup"
        :render-progress="exportProgress"
        @select="setAspectRatio"
        @add="addCustomAspectPreset"
        @add-pack="addCustomAspectPack"
        @rename-pack="renameCustomAspectPack"
        @render-group="renderAspectGroupImages"
        @remove-pack="removeCustomAspectPack"
        @remove="removeCustomAspectPreset"
      />
    </section>

    <aside ref="controlsPanel" class="animation-controls">
      <!-- <header class="controls-title">
        <p>Animation generator</p>
        <h1>{{ panelLabel }} panel</h1>
      </header> -->

     <!-- <div class="control-field aspect-control">
        <label>Aspect ratio <span>{{ activeAspectLabel }}</span></label>
        <div class="aspect-presets">
          <button
            v-for="preset in quickAspectPresets"
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
              :min="minExportDimension"
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
              :min="minExportDimension"
              max="3840"
              step="1"
              @change="normalizeAspectRatio"
            >
          </label>
        </div>

      </div> -->



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

      <div class="editor-sticky-nav">
        <div class="panel-tabs" aria-label="Select panel to edit">
          <button
            v-for="side in panelSides"
            :key="side"
            type="button"
            :class="{ 'is-selected': selectedPanel === side }"
            @click="selectPanel(side)"
          >
            {{ getPanelLabel(side) }}
          </button>
        </div>
        <SlideSelector
          :count="panelSlides[selectedPanel].length"
          :current-index="selectedIndex"
          variant="tabs"
          aria-label="Select slide to edit"
          @select="selectSlide"
        />
      </div>

      <div class="editor-action-controls">
        <SlideEditActions
          :slide-count="slideCount"
          :selected-index="selectedIndex"
          @insert="insertSlideAt"
          @remove="removeSelectedSlide"
        />

        <div class="editor-secondary-actions">
          <button
            type="button"
            class="button button--outline button--compact button--block swap-panels-button"
            @click="togglePanelSwap"
          >
            {{ panelSwapButtonLabel }}
          </button>

          <CopySlidePng
            :status="copySlideStatus"
            @copy="copyCurrentSlideAsPng"
          />
        </div>
      </div>

      <template v-if="selectedSlide">
        <LayoutControls v-model="contentLayoutPreset" />

        <TextControls
          v-model:heading="selectedSlide.heading"
          v-model:heading-highlights="selectedSlide.headingHighlights"
          v-model:heading-size="selectedSlide.headingSize"
          v-model:heading-auto-scale="selectedSlide.headingAutoScale"
          v-model:subheading="selectedSlide.subheading"
          v-model:subheading-size="selectedSlide.subheadingSize"
          v-model:legal-text="selectedSlide.legalText"
          v-model:legal-size="selectedSlide.legalSize"
          v-model:legal-opacity="selectedSlide.legalOpacity"
          v-model:legal-shadow="selectedSlide.legalShadow"
          v-model:legal-shadow-opacity="selectedSlide.legalShadowOpacity"
          v-model:logo-width="selectedSlide.logoWidth"
          :show-logo-width="isLogoImage(selectedSlide.logo)"
          @apply-to-aspects="applySelectedTextToAspectRatios"
        />

        <BackgroundSelector
          v-model:background-color="selectedSlide.backgroundColor"
          v-model:background-preset="selectedSlide.backgroundPreset"
          v-model:split-angle="selectedSlide.splitAngle"
          v-model:checker-cells="selectedSlide.checkerCells"
          @rotate="rotateSplitDirection"
          @apply-to-aspects="applySelectedBackgroundToAspectRatios"
        />

        <div class="control-section control-field">
          <h2>Background media</h2>
          <div class="asset-control">
            <label
              class="button button--outline upload-button"
              for="background"
              @pointerdown="rememberControlsScroll"
            >
              {{ selectedSlide.backgroundImage ? 'Replace media' : 'Choose media' }}
            </label>
            <button
              v-if="selectedSlide.backgroundImage"
              type="button"
              class="button button--secondary clear-button"
              @click="clearAsset('backgroundImage')"
            >
              Remove
            </button>
          </div>
          <input
            id="background"
            class="visually-hidden"
            type="file"
            accept="image/*,video/*"
            @change="handleAssetUpload($event, 'backgroundImage')"
          >

          <label class="direction-toggle">
            <span>
              <strong>Bottom black fade</strong>
              <small>Darken the bottom edge behind slide content</small>
            </span>
            <input v-model="selectedSlide.bottomFade" type="checkbox">
          </label>
        </div>

        <CtaControls
          v-model:text="selectedSlide.ctaText"
          v-model:size="selectedSlide.ctaSize"
          v-model:pulse="selectedSlide.ctaPulse"
          v-model:align="selectedSlide.ctaAlign"
          v-model:bottom-margin="selectedSlide.ctaBottomMargin"
          @apply-to-aspects="applySelectedCtaToAspectRatios"
        />

        <LogoControls
          v-model:logo="selectedSlide.logo"
          :is-logo-image="isLogoImage(selectedSlide.logo)"
          :is-default-logo="selectedSlide.logo === defaultLogo"
          @apply-to-aspects="applySelectedLogoToAspectRatios"
          @use-default="useDefaultLogo"
          @remember-scroll="rememberControlsScroll"
          @upload="handleAssetUpload($event, 'logo')"
          @clear="clearAsset('logo')"
        />
      </template>

      <section class="control-section packshot-control">
        <h2>Packshot</h2>
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
              :style="rangeStyle(packshotWidth, 5, 100)"
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

      <section class="control-section timing-control">
        <h2>Motion</h2>
        <div class="timing-summary">
          <small>Total duration</small>
          <strong>{{ totalDuration.toFixed(2) }}s</strong>
        </div>

        <label class="direction-toggle">
          <span>
            <strong>Reverse directions</strong>
            <small>Swap movement between both sides</small>
          </span>
          <input v-model="reverseDirections" type="checkbox">
        </label>

        <label v-if="isUltraNarrow" class="direction-toggle">
          <span>
            <strong>Left to right</strong>
            <small>Use horizontal slide movement for narrow banners</small>
          </span>
          <input v-model="narrowHorizontalAnimation" type="checkbox">
        </label>

        <label class="direction-toggle">
          <span>
            <strong>Loop slides</strong>
            <small>Restart from slide 1 after the final slide</small>
          </span>
          <input v-model="loopSlides" type="checkbox">
        </label>

        <label class="direction-toggle">
          <span>
            <strong>Text word fade</strong>
            <small>Fade heading and subheading words during transitions</small>
          </span>
          <input v-model="textLineTransition" type="checkbox">
        </label>

        <label class="direction-toggle">
          <span>
            <strong>Motion blur</strong>
            <small>
              {{ textLineTransition
                ? 'Applied after clean frame capture when exporting'
                : 'Preview trails · export uses temporal frame mixing' }}
            </small>
          </span>
          <input v-model="motionBlur" type="checkbox">
        </label>

        <div class="control-field">
          <label for="motion-blur-intensity">Motion blur intensity</label>
          <div class="range-row">
            <input
              id="motion-blur-intensity"
              v-model.number="motionBlurIntensity"
              :style="rangeStyle(motionBlurIntensity, 0, 100)"
              type="range"
              min="0"
              max="100"
              step="5"
              :disabled="!motionBlur"
            >
            <output>{{ Math.round(motionBlurIntensity) }}%</output>
          </div>
        </div>

        <div class="control-field">
          <label for="transition-time">Slide transition timing</label>
          <div class="range-row">
            <input
              id="transition-time"
              v-model.number="transitionSeconds"
              :style="rangeStyle(transitionSeconds, 0.1, 3)"
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
              :style="rangeStyle(firstPauseSeconds, 0, 10)"
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
              :style="rangeStyle(pauseSeconds, 0, 10)"
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
            <button class="button button--secondary" type="button" @click="setCurve(0.25, 0.1, 0.25, 1)">Ease</button>
            <button class="button button--secondary" type="button" @click="setCurve(0.42, 0, 0.58, 1)">In out</button>
            <button class="button button--secondary" type="button" @click="setCurve(0.76, 0, 0.24, 1)">Snappy</button>
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

      <section class="control-section export-control">
        <div class="export-heading">
          <div>
            <h2>
              {{ exportFormat === 'mp4' ? 'MP4 video' : 'PNG sequence' }}
            </h2>
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
              :min="minExportDimension"
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
              :min="minExportDimension"
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

        <label class="direction-toggle local-renderer-toggle">
          <span>
            <strong>Local renderer</strong>
            <small v-if="!useLocalRenderer && remoteRendererStatus === 'connected'">Railway renderer connected</small>
            <small v-else-if="!useLocalRenderer && remoteRendererStatus === 'checking'">Checking Railway renderer…</small>
            <small v-else-if="!useLocalRenderer && remoteRendererOrigin">Railway renderer unavailable</small>
            <small v-else-if="!useLocalRenderer">Uses the current website server</small>
            <small v-else-if="localRendererStatus === 'connected'">Connected at 127.0.0.1:3000</small>
            <small v-else-if="localRendererStatus === 'checking'">Checking connection…</small>
            <small v-else>Not found; current server remains available</small>
          </span>
          <input
            v-model="useLocalRenderer"
            type="checkbox"
            :disabled="isExporting"
            @change="updateLocalRendererPreference"
          >
        </label>

        <PresetControls
          class="export-preset-control"
          :filename-prefix="exportPrefix"
          :create-preset="createPresetPayload"
          @import="importPreset"
          @error="showPresetError"
        />

        <button
          type="button"
          class="button button--accent button--block render-button render-progress-button"
          :class="{ 'is-rendering': isExporting }"
          :disabled="isExporting"
          :style="isExporting
            ? { '--render-progress': `${Math.max(0, Math.min(1, exportProgress)) * 100}%` }
            : undefined"
          aria-live="polite"
          @click="renderSequence"
        >
          <span>
            {{
              isExporting
                ? exportStatus
                : exportFormat === 'mp4'
                  ? 'Render MP4'
                  : 'Render PNG sequence'
            }}
          </span>
        </button>
        <p v-if="exportError" class="export-error">{{ exportError }}</p>
        <p class="export-note">
          {{
            exportFormat === 'mp4'
              ? useLocalRenderer && localRendererStatus === 'connected'
                ? 'Frames are rendered and converted to H.264 MP4 on this computer.'
                : remoteRendererOrigin
                  ? 'Frames are rendered and converted to H.264 MP4 by the Railway renderer.'
                  : 'Frames are converted to H.264 MP4 by the current website server. FFmpeg is required on its host.'
              : 'Downloads a ZIP containing numbered PNG frames.'
          }}
          Large resolutions and frame rates use significant memory.
        </p>
      </section>
    </aside>
  </main>
</template>
