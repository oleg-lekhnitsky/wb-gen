<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps<{
  src: string
  x: number
  y: number
  scale: number
  editable?: boolean
}>()

const emit = defineEmits<{
  'update:x': [value: number]
  'update:y': [value: number]
  'update:scale': [value: number]
}>()

const root = ref<HTMLElement | null>(null)
const naturalWidth = ref(1)
const naturalHeight = ref(1)
const containerWidth = ref(1)
const containerHeight = ref(1)
const snappedX = ref<number | null>(null)
const snappedY = ref<number | null>(null)
const minBackgroundScale = 0.2
const maxBackgroundScale = 6
const minPanOffset = 100
const extraPanOffset = 50
let resizeObserver: ResizeObserver | null = null
let activeDrag:
  | {
    type: 'move' | 'resize'
    pointerId: number
    startClientX: number
    startClientY: number
    startX: number
    startY: number
    startScale: number
  }
  | null = null

const clampedScale = computed(() => clamp(props.scale, minBackgroundScale, maxBackgroundScale))
const showVerticalGuide = computed(() => snappedX.value !== null)
const showHorizontalGuide = computed(() => snappedY.value !== null)
const verticalGuideStyle = computed(() => ({ left: `${snappedX.value ?? 50}%` }))
const horizontalGuideStyle = computed(() => ({ top: `${snappedY.value ?? 50}%` }))
const isVideoSource = computed(() => props.src.startsWith('data:video/'))

const renderedSize = computed(() => {
  const coverScale = Math.max(
    containerWidth.value / naturalWidth.value,
    containerHeight.value / naturalHeight.value
  )
    * clampedScale.value

  return {
    width: naturalWidth.value * coverScale,
    height: naturalHeight.value * coverScale
  }
})

const mediaStyle = computed(() => {
  return {
    width: `${renderedSize.value.width}px`,
    height: `${renderedSize.value.height}px`,
    left: `${clampedX.value}%`,
    top: `${clampedY.value}%`,
    transform: 'translate(-50%, -50%)'
  }
})

const positionBounds = computed(() => {
  const xOverflow = Math.max(0, (renderedSize.value.width - containerWidth.value) / 2)
  const yOverflow = Math.max(0, (renderedSize.value.height - containerHeight.value) / 2)
  const xOffset = containerWidth.value > 0
    ? Math.max(minPanOffset, xOverflow / containerWidth.value * 100 + extraPanOffset)
    : minPanOffset
  const yOffset = containerHeight.value > 0
    ? Math.max(minPanOffset, yOverflow / containerHeight.value * 100 + extraPanOffset)
    : minPanOffset

  return {
    minX: 50 - xOffset,
    maxX: 50 + xOffset,
    minY: 50 - yOffset,
    maxY: 50 + yOffset
  }
})

const clampedX = computed(() =>
  clamp(props.x, positionBounds.value.minX, positionBounds.value.maxX)
)
const clampedY = computed(() =>
  clamp(props.y, positionBounds.value.minY, positionBounds.value.maxY)
)

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min))
}

function snapAxis(value: number, renderedLength: number, containerLength: number) {
  const threshold = 3
  const edgeOffset = containerLength > 0
    ? renderedLength / containerLength * 50
    : 50
  const snapPoints = [
    { value: 0, guide: 0 },
    { value: 50, guide: 50 },
    { value: 100, guide: 100 },
    { value: edgeOffset, guide: 0 },
    { value: 100 - edgeOffset, guide: 100 }
  ]
  const snappedValue = snapPoints.find(point => Math.abs(value - point.value) <= threshold)

  return {
    value: snappedValue?.value ?? value,
    point: snappedValue?.guide ?? null
  }
}

function updateNaturalSize(event: Event) {
  const media = event.target as HTMLImageElement | HTMLVideoElement
  naturalWidth.value = media instanceof HTMLVideoElement
    ? media.videoWidth || 1
    : media.naturalWidth || 1
  naturalHeight.value = media instanceof HTMLVideoElement
    ? media.videoHeight || 1
    : media.naturalHeight || 1
}

function updateContainerSize() {
  const element = root.value
  if (!element) return

  containerWidth.value = element.offsetWidth || element.clientWidth || 1
  containerHeight.value = element.offsetHeight || element.clientHeight || 1
}

function beginMove(event: PointerEvent) {
  if (!props.editable || !root.value) return
  event.preventDefault()
  event.stopPropagation()
  activeDrag = {
    type: 'move',
    pointerId: event.pointerId,
    startClientX: event.clientX,
    startClientY: event.clientY,
    startX: clampedX.value,
    startY: clampedY.value,
    startScale: clampedScale.value
  }
  root.value.setPointerCapture(event.pointerId)
}

function beginResize(event: PointerEvent) {
  if (!props.editable || !root.value) return
  event.preventDefault()
  event.stopPropagation()
  activeDrag = {
    type: 'resize',
    pointerId: event.pointerId,
    startClientX: event.clientX,
    startClientY: event.clientY,
    startX: clampedX.value,
    startY: clampedY.value,
    startScale: clampedScale.value
  }
  root.value.setPointerCapture(event.pointerId)
}

function handlePointerMove(event: PointerEvent) {
  if (!activeDrag || !root.value || event.pointerId !== activeDrag.pointerId) return
  event.preventDefault()
  event.stopPropagation()

  const rect = root.value.getBoundingClientRect()
  const deltaX = event.clientX - activeDrag.startClientX
  const deltaY = event.clientY - activeDrag.startClientY

  if (activeDrag.type === 'move') {
    const nextX = clamp(
      activeDrag.startX + deltaX / rect.width * 100,
      positionBounds.value.minX,
      positionBounds.value.maxX
    )
    const nextY = clamp(
      activeDrag.startY + deltaY / rect.height * 100,
      positionBounds.value.minY,
      positionBounds.value.maxY
    )
    const snappedNextX = snapAxis(nextX, renderedSize.value.width, rect.width)
    const snappedNextY = snapAxis(nextY, renderedSize.value.height, rect.height)
    snappedX.value = snappedNextX.point
    snappedY.value = snappedNextY.point
    emit('update:x', snappedNextX.value)
    emit('update:y', snappedNextY.value)
    return
  }

  snappedX.value = null
  snappedY.value = null
  const scaleDelta = (deltaX + deltaY) / Math.max(rect.width, rect.height) * 2
  emit('update:scale', clamp(activeDrag.startScale + scaleDelta, minBackgroundScale, maxBackgroundScale))
}

function endDrag(event: PointerEvent) {
  if (!activeDrag || event.pointerId !== activeDrag.pointerId) return
  event.preventDefault()
  event.stopPropagation()
  root.value?.releasePointerCapture(event.pointerId)
  snappedX.value = null
  snappedY.value = null
  activeDrag = null
}

onMounted(() => {
  updateContainerSize()
  if (!root.value) return
  resizeObserver = new ResizeObserver(updateContainerSize)
  resizeObserver.observe(root.value)
  requestAnimationFrame(updateContainerSize)
})

watch(
  () => props.src,
  async () => {
    await nextTick()
    updateContainerSize()
  }
)

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  snappedX.value = null
  snappedY.value = null
  activeDrag = null
})
</script>

<template>
  <div
    ref="root"
    class="draggable-background"
    :class="{ 'is-editable': editable }"
    @pointerdown="beginMove"
    @pointermove="handlePointerMove"
    @pointerup="endDrag"
    @pointercancel="endDrag"
    @click.stop
  >
    <video
      v-if="isVideoSource"
      :src="src"
      :style="mediaStyle"
      autoplay
      loop
      muted
      playsinline
      @loadedmetadata="updateNaturalSize"
      @loadeddata="updateNaturalSize"
    />
    <img
      v-else
      :src="src"
      :style="mediaStyle"
      alt=""
      draggable="false"
      @load="updateNaturalSize"
    >
    <span
      v-if="editable && showVerticalGuide"
      class="draggable-background__guide draggable-background__guide--vertical"
      :style="verticalGuideStyle"
    />
    <span
      v-if="editable && showHorizontalGuide"
      class="draggable-background__guide draggable-background__guide--horizontal"
      :style="horizontalGuideStyle"
    />
    <button
      v-if="editable"
      type="button"
      class="draggable-background__handle"
      aria-label="Resize background media"
      @pointerdown="beginResize"
      @click.stop
    />
  </div>
</template>

<style scoped>
.draggable-background {
  position: absolute;
  z-index: 1;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  user-select: none;
  touch-action: none;
}

.draggable-background.is-editable {
  pointer-events: auto;
  cursor: move;
}

.draggable-background img,
.draggable-background video {
  position: absolute;
  display: block;
  max-width: none;
  pointer-events: none;
  user-select: none;
}

.draggable-background__handle {
  position: absolute;
  right: 12px;
  bottom: 12px;
  width: 22px;
  height: 22px;
  border: 2px solid #fff;
  border-radius: 50%;
  background: #171717;
  box-shadow: 0 2px 8px rgb(0 0 0 / 28%);
  cursor: nwse-resize;
}

.draggable-background__guide {
  position: absolute;
  z-index: 2;
  pointer-events: none;
}

.draggable-background__guide--vertical {
  top: 0;
  bottom: 0;
  width: 2px;
  transform: translateX(-50%);
  background: rgb(255 255 255 / 85%);
}

.draggable-background__guide--horizontal {
  right: 0;
  left: 0;
  height: 2px;
  transform: translateY(-50%);
  background: rgb(255 255 255 / 85%);
}
</style>
