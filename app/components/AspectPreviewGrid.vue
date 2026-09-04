<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import AnimatedSlideCopy from '~/components/AnimatedSlideCopy.vue'
import AspectGroupRenderControl from '~/components/AspectGroupRenderControl.vue'
import DraggableBackground from '~/components/DraggableBackground.vue'
import SlideCta from '~/components/SlideCta.vue'

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

type PreviewSlide = {
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
  headingHighlights?: Array<{
    start: number
    end: number
    preset: 'white-pink' | 'purple-white'
  }>
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

const props = defineProps<{
  presets: AspectPreset[]
  packs?: AspectPack[]
  activeWidth: number
  activeHeight: number
  getSlides: (preset: AspectPreset) => { left: PreviewSlide, right: PreviewSlide }
  getBackgroundStyle: (slide: PreviewSlide, preset: AspectPreset) => Record<string, string | number>
  isLogoImage: (logo: string) => boolean
  getLogoSource: (slide: PreviewSlide) => string
  hasWhiteBackground: (slide: PreviewSlide) => boolean
  swapVerticalPanels: boolean
  swapHorizontalPanels: boolean
  swapUltraNarrowPanels: boolean
  contentLayoutPreset: 'stacked' | 'adaptive-split'
  renderDisabled?: boolean
  isRendering?: boolean
  renderProgress?: number
}>()

const emit = defineEmits<{
  select: [preset: AspectPreset]
  add: [width: number, height: number, pack?: string]
  addPack: []
  renamePack: [id: string, label: string]
  renderGroup: [presets: AspectPreset[], groupLabel: string, renderScale: number]
  removePack: [id: string]
  remove: [label: string]
}>()

const width = ref(props.activeWidth)
const height = ref(props.activeHeight)
const isCollapsed = ref(false)
const activePack = ref(props.packs?.[0]?.id || '')
const shouldSelectNewPack = ref(false)
const editingPack = ref('')
const editingPackLabel = ref('')
const editingPackWidth = ref(0)
const editingPackHeight = ref(0)
const root = ref<HTMLElement | null>(null)
const packScroller = ref<HTMLElement | null>(null)
const panelX = ref(40)
const panelY = ref(40)
let activeDrag:
  | {
    pointerId: number
    startClientX: number
    startClientY: number
    startX: number
    startY: number
  }
  | null = null

const validSize = computed(() => (
  Number.isFinite(width.value)
  && Number.isFinite(height.value)
  && width.value >= 1
  && height.value >= 1
  && width.value <= 3840
  && height.value <= 3840
))

const panelStyle = computed(() => ({
  top: `${panelY.value}px`,
  right: 'auto',
  left: `${panelX.value}px`
}))

function sortAspectPresets(presets: AspectPreset[]) {
  return [...presets].sort((a, b) => {
    const ratioDifference = b.width / b.height - a.width / a.height
    if (Math.abs(ratioDifference) > 0.0001) return ratioDifference

    const areaDifference = b.exportWidth * b.exportHeight - a.exportWidth * a.exportHeight
    if (areaDifference !== 0) return areaDifference

    return a.label.localeCompare(b.label, undefined, { numeric: true })
  })
}

const visiblePresets = computed(() => {
  const presets = !props.packs?.length || !activePack.value
    ? props.presets
    : props.presets.filter(preset =>
    preset.pack === activePack.value || (preset.custom && !preset.pack)
  )

  return sortAspectPresets(presets)
})
const activePackLabel = computed(() =>
  props.packs?.find(pack => pack.id === activePack.value)?.label || 'Aspects'
)

function clampPanelPosition(x: number, y: number) {
  const margin = 12
  const element = root.value
  const width = element?.offsetWidth || 360
  const height = element?.offsetHeight || 120
  const maxX = Math.max(margin, window.innerWidth - width - margin)
  const maxY = Math.max(margin, window.innerHeight - height - margin)

  return {
    x: Math.max(margin, Math.min(x, maxX)),
    y: Math.max(margin, Math.min(y, maxY))
  }
}

function beginDrag(event: PointerEvent) {
  if (event.button !== 0) return
  activeDrag = {
    pointerId: event.pointerId,
    startClientX: event.clientX,
    startClientY: event.clientY,
    startX: panelX.value,
    startY: panelY.value
  }
  root.value?.setPointerCapture(event.pointerId)
  window.addEventListener('pointermove', handleDrag)
  window.addEventListener('pointerup', endDrag)
  window.addEventListener('pointercancel', endDrag)
}

function handleDrag(event: PointerEvent) {
  if (!activeDrag || event.pointerId !== activeDrag.pointerId) return
  event.preventDefault()

  const next = clampPanelPosition(
    activeDrag.startX + event.clientX - activeDrag.startClientX,
    activeDrag.startY + event.clientY - activeDrag.startClientY
  )
  panelX.value = next.x
  panelY.value = next.y
}

function endDrag(event: PointerEvent) {
  if (!activeDrag || event.pointerId !== activeDrag.pointerId) return
  root.value?.releasePointerCapture(event.pointerId)
  activeDrag = null
  window.removeEventListener('pointermove', handleDrag)
  window.removeEventListener('pointerup', endDrag)
  window.removeEventListener('pointercancel', endDrag)
}

function isActive(preset: AspectPreset) {
  return props.activeWidth === preset.width && props.activeHeight === preset.height
}

function isPortrait(preset: AspectPreset) {
  return preset.height >= preset.width
}

function isUltraNarrow(preset: AspectPreset) {
  return !isPortrait(preset) && preset.width / preset.height >= 4
}

function getPreviewFrame(preset: AspectPreset) {
  const maxWidth = 86
  const maxHeight = 156
  const ratio = preset.width / preset.height
  let frameWidth = maxWidth
  let frameHeight = frameWidth / ratio

  if (frameHeight > maxHeight) {
    frameHeight = maxHeight
    frameWidth = frameHeight * ratio
  }

  const designWidth = getPreviewDesignWidth(preset)

  return {
    width: frameWidth,
    height: frameHeight,
    scale: frameWidth / designWidth
  }
}

function getPreviewDesignWidth(preset: AspectPreset) {
  if (isPortrait(preset)) return 520
  return 900
}

function getPreviewStageStyle(preset: AspectPreset) {
  const frame = getPreviewFrame(preset)

  return {
    '--aspect-preview-scale': frame.scale,
    '--aspect-preview-design-width': `${getPreviewDesignWidth(preset)}px`,
    width: `${frame.width}px`,
    height: `${frame.height}px`
  }
}

function getPreviewSlides(preset: AspectPreset) {
  const slides = props.getSlides(preset)
  const shouldSwapPanels = isPortrait(preset)
    ? props.swapVerticalPanels
    : isUltraNarrow(preset)
      ? props.swapUltraNarrowPanels
      : props.swapHorizontalPanels
  if (shouldSwapPanels) return [slides.right, slides.left]
  return [slides.left, slides.right]
}

function getPreviewContentSlide(preset: AspectPreset, slide: PreviewSlide) {
  if (props.contentLayoutPreset !== 'adaptive-split') return slide
  return getPreviewSlides(preset)[0] ?? slide
}

function addPreset() {
  if (!validSize.value) return
  emit('add', Math.round(width.value), Math.round(height.value), activePack.value || undefined)
}

function addPack() {
  shouldSelectNewPack.value = true
  emit('addPack')
}

function startRenamePack(pack: AspectPack, event?: Event) {
  if (!pack.editable) return
  const chip = event?.currentTarget instanceof HTMLElement
    ? event.currentTarget.closest<HTMLElement>('.aspect-pack-chip')
    : null
  editingPack.value = pack.id
  editingPackLabel.value = pack.label
  editingPackWidth.value = chip?.offsetWidth || 0
  editingPackHeight.value = chip?.offsetHeight || 0
}

function finishRenamePack() {
  if (!editingPack.value) return

  const label = editingPackLabel.value.trim()
  if (label) emit('renamePack', editingPack.value, label)
  editingPack.value = ''
  editingPackLabel.value = ''
  editingPackWidth.value = 0
  editingPackHeight.value = 0
}

function cancelRenamePack() {
  editingPack.value = ''
  editingPackLabel.value = ''
  editingPackWidth.value = 0
  editingPackHeight.value = 0
}

function removePack(pack: AspectPack) {
  if (!pack.editable) return
  emit('removePack', pack.id)
}

function renderGroup(renderScale: number) {
  emit('renderGroup', visiblePresets.value, activePackLabel.value, renderScale)
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

function getSlideStyle(slide: PreviewSlide, preset: AspectPreset) {
  return props.getBackgroundStyle(slide, preset)
}

onBeforeUnmount(() => {
  if (!activeDrag) return
  activeDrag = null
  window.removeEventListener('pointermove', handleDrag)
  window.removeEventListener('pointerup', endDrag)
  window.removeEventListener('pointercancel', endDrag)
})

watch(
  () => props.packs,
  packs => {
    if (!packs?.length) {
      activePack.value = ''
      shouldSelectNewPack.value = false
      return
    }

    if (shouldSelectNewPack.value) {
      const nextPack = packs[packs.length - 1]
      if (!nextPack) return
      activePack.value = nextPack.id
      shouldSelectNewPack.value = false
      void nextTick(() => {
        const scroller = packScroller.value
        scroller?.scrollTo({ left: scroller.scrollWidth, behavior: 'smooth' })
      })
      return
    }

    if (!packs.some(pack => pack.id === activePack.value)) {
      const firstPack = packs[0]
      if (!firstPack) return
      activePack.value = firstPack.id
    }

    if (editingPack.value && !packs.some(pack => pack.id === editingPack.value)) {
      cancelRenamePack()
    }
  },
  { deep: true }
)

watch(
  () => [props.activeWidth, props.activeHeight] as const,
  ([nextWidth, nextHeight]) => {
    width.value = nextWidth
    height.value = nextHeight
  }
)
</script>

<template>
  <section
    ref="root"
    class="aspect-preview-control"
    :class="{ 'is-collapsed': isCollapsed }"
    :style="panelStyle"
  >
    <div class="aspect-preview-heading" @pointerdown="beginDrag">
      <label>Aspect preview</label>
      <span>[{{ visiblePresets.length }}]</span>
      <button
        type="button"
        class="button button--ghost button--pill button--sm"
        @pointerdown.stop
        @click="isCollapsed = !isCollapsed"
      >
        {{ isCollapsed ? 'Open' : 'Hide' }}
      </button>
      
    </div>

    <div v-if="!isCollapsed" class="aspect-preview-scroll">
      <div v-if="packs?.length" class="aspect-pack-tabs">
        <div ref="packScroller" class="aspect-pack-tabs__scroller">
          <span
            v-for="pack in packs"
            :key="pack.id"
            class="aspect-pack-chip"
            :class="{
              'is-selected': activePack === pack.id,
              'is-editable': pack.editable,
              'is-renaming': editingPack === pack.id
            }"
            :style="editingPack === pack.id && editingPackWidth
              ? {
                  width: `${editingPackWidth}px`,
                  height: editingPackHeight ? `${editingPackHeight}px` : undefined
                }
              : undefined"
          >
            <input
              v-if="editingPack === pack.id"
              v-model="editingPackLabel"
              type="text"
              aria-label="Group name"
              @blur="finishRenamePack"
              @keydown.enter.prevent="finishRenamePack"
              @keydown.escape.prevent="cancelRenamePack"
            >
            <button
              v-else
              type="button"
              class="aspect-pack-chip__label"
              :title="pack.editable ? 'Double-click to rename' : undefined"
              @click="activePack = pack.id"
              @dblclick="startRenamePack(pack, $event)"
              @keydown.enter.prevent="pack.editable ? startRenamePack(pack, $event) : activePack = pack.id"
            >
              {{ pack.label }}
            </button>
            <button
              v-if="pack.editable && editingPack !== pack.id"
              type="button"
              class="aspect-pack-chip__remove"
              aria-label="Delete group"
              @click.stop="removePack(pack)"
            >
              ×
            </button>
          </span>
        </div>
        <button
          type="button"
          class="button button--outline button--sm"
          aria-label="Add aspect group"
          @click="addPack"
        >
          Add
        </button>
      </div>

      <div class="aspect-preview-form">
        <input
          v-model.number="width"
          type="number"
          min="1"
          max="3840"
          step="1"
          aria-label="Preview width"
        >
        <span>x</span>
        <input
          v-model.number="height"
          type="number"
          min="1"
          max="3840"
          step="1"
          aria-label="Preview height"
        >
        <button
          type="button"
          class="button button--outline button--sm"
          :disabled="!validSize"
          @click="addPreset"
        >
          Add
        </button>
      </div>

      <div class="aspect-preview-grid">
        <button
          v-for="preset in visiblePresets"
          :key="preset.label"
          type="button"
          class="aspect-preview-card"
          :class="{
            'is-selected': isActive(preset),
            'is-portrait': isPortrait(preset)
          }"
          @click="emit('select', preset)"
        >
          <span
            class="aspect-preview-card__stage"
            :style="getPreviewStageStyle(preset)"
          >
            <span
              class="aspect-preview-card__design slot-stage"
              :class="{
                'is-portrait': isPortrait(preset),
                'is-ultra-narrow': isUltraNarrow(preset),
                'has-adaptive-content-layout': contentLayoutPreset === 'adaptive-split'
              }"
              :style="{ aspectRatio: `${preset.width} / ${preset.height}` }"
            >
              <span
                v-for="(slide, slideIndex) in getPreviewSlides(preset)"
                :key="slideIndex"
                class="slot-panel"
                :class="[
                  slideIndex === 0 ? 'slot-panel--left' : 'slot-panel--right',
                  slideIndex === 0 ? 'slot-panel--visual-start' : 'slot-panel--visual-end'
                ]"
              >
                <span
                  class="slot-slide is-active"
                  :class="{
                    'has-checker-background': !slide.backgroundImage && slide.backgroundPreset === 'checker',
                    'has-bottom-fade': slide.bottomFade
                  }"
                  :style="getSlideStyle(slide, preset)"
                >
                  <DraggableBackground
                    v-if="slide.backgroundImage"
                    :src="slide.backgroundImage"
                    :x="normalizeBackgroundImageX(slide.backgroundImageX)"
                    :y="normalizeBackgroundImageY(slide.backgroundImageY)"
                    :scale="normalizeBackgroundImageScale(slide.backgroundImageScale)"
                  />
                  <span
                    class="slide-content"
                    :class="{
                      'has-brand-pink-text': hasWhiteBackground(getPreviewContentSlide(preset, slide))
                    }"
                    :style="{
                      '--logo-width': `${getPreviewContentSlide(preset, slide).logoWidth}%`
                    }"
                  >
                    <SlideCta
                      :text="getPreviewContentSlide(preset, slide).ctaText"
                      :size="getPreviewContentSlide(preset, slide).ctaSize"
                      :pulse="getPreviewContentSlide(preset, slide).ctaPulse"
                      :align="getPreviewContentSlide(preset, slide).ctaAlign"
                      :bottom-margin="getPreviewContentSlide(preset, slide).ctaBottomMargin"
                    />

                    <span
                      class="slide-logo"
                      :class="{
                        'has-logo-image': isLogoImage(getPreviewContentSlide(preset, slide).logo),
                        'is-empty': !getPreviewContentSlide(preset, slide).logo
                      }"
                    >
                      <img
                        v-if="isLogoImage(getPreviewContentSlide(preset, slide).logo)"
                        :src="getLogoSource(getPreviewContentSlide(preset, slide))"
                        :style="{
                          width: isUltraNarrow(preset)
                            ? '100%'
                            : `${getPreviewContentSlide(preset, slide).logoWidth}%`,
                          height: 'auto'
                        }"
                        alt=""
                      >
                      <span v-else-if="getPreviewContentSlide(preset, slide).logo">
                        {{ getPreviewContentSlide(preset, slide).logo }}
                      </span>
                    </span>

                    <AnimatedSlideCopy
                      :heading="getPreviewContentSlide(preset, slide).heading"
                      :heading-highlights="getPreviewContentSlide(preset, slide).headingHighlights"
                      :heading-size="getPreviewContentSlide(preset, slide).headingSize"
                      :heading-auto-scale="getPreviewContentSlide(preset, slide).headingAutoScale"
                      :subheading="getPreviewContentSlide(preset, slide).subheading"
                      :subheading-size="getPreviewContentSlide(preset, slide).subheadingSize"
                    />

                    <span
                      v-if="getPreviewContentSlide(preset, slide).legalText"
                      class="slide-legal"
                      :style="{
                        '--legal-scale': getPreviewContentSlide(preset, slide).legalSize / 100,
                        '--legal-opacity': getPreviewContentSlide(preset, slide).legalOpacity / 100
                      }"
                    >
                      {{ getPreviewContentSlide(preset, slide).legalText }}
                    </span>
                  </span>
                </span>
              </span>
            </span>
          </span>
          <span class="aspect-preview-card__meta">
            <span>
              <strong>{{ preset.exportWidth }} x {{ preset.exportHeight }}</strong>
            </span>
            <span
              v-if="preset.custom"
              role="button"
              tabindex="0"
              aria-label="Remove custom size"
              class="aspect-preview-card__remove"
              @click.stop="emit('remove', preset.label)"
              @keydown.enter.stop.prevent="emit('remove', preset.label)"
              @keydown.space.stop.prevent="emit('remove', preset.label)"
            >
              Remove
            </span>
          </span>
        </button>
      </div>
    </div>

    <AspectGroupRenderControl
      v-if="!isCollapsed"
      :group-label="activePackLabel"
      :count="visiblePresets.length"
      :disabled="renderDisabled"
      :rendering="isRendering"
      :render-progress="renderProgress"
      @render="renderGroup"
    />
  </section>
</template>
