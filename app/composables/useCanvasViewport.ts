import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'

export function useCanvasViewport(zoom: Ref<number>, ratio: Ref<number>, enabled: Ref<boolean>) {
  const viewport = ref<HTMLElement | null>(null)
  const size = ref({ width: 900, height: 700 })
  const pan = ref({ x: 0, y: 0 })
  const dragging = ref(false)
  const baseWidth = computed(() => Math.max(1, Math.min(
    ratio.value <= 1 ? 520 : 900, size.value.width - 48, (size.value.height - 48) * ratio.value
  )))
  let observer: ResizeObserver | undefined
  let drag: { id: number, x: number, y: number } | undefined
  let gestureZoom: number | undefined

  function reset() { zoom.value = 100; pan.value = { x: 0, y: 0 } }
  function zoomAt(value: number, clientX?: number, clientY?: number) {
    const next = Math.max(10, Math.min(400, value))
    const rect = viewport.value?.getBoundingClientRect()
    if (rect && clientX !== undefined && clientY !== undefined) {
      const x = clientX - rect.left - rect.width / 2
      const y = clientY - rect.top - rect.height / 2
      const factor = next / zoom.value
      pan.value = { x: x - (x - pan.value.x) * factor, y: y - (y - pan.value.y) * factor }
    }
    zoom.value = next
  }
  function wheel(event: WheelEvent) {
    if (!enabled.value) return
    event.preventDefault()
    if (gestureZoom !== undefined) return
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? size.value.height : 1
    if (event.ctrlKey || event.metaKey) zoomAt(zoom.value * Math.exp(-event.deltaY * unit * .01), event.clientX, event.clientY)
    else pan.value = { x: pan.value.x - event.deltaX * unit, y: pan.value.y - event.deltaY * unit }
  }
  function pointerDown(event: PointerEvent) {
    if (!enabled.value || (event.button !== 1 && !(event.button === 0 && event.target === viewport.value))) return
    event.preventDefault()
    event.stopPropagation()
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY }
    dragging.value = true
    viewport.value?.setPointerCapture(event.pointerId)
  }
  function pointerMove(event: PointerEvent) {
    if (!drag || event.pointerId !== drag.id) return
    pan.value = { x: pan.value.x + event.clientX - drag.x, y: pan.value.y + event.clientY - drag.y }
    drag.x = event.clientX; drag.y = event.clientY
  }
  function pointerUp(event: PointerEvent) {
    if (!drag || event.pointerId !== drag.id) return
    if (viewport.value?.hasPointerCapture(event.pointerId)) viewport.value.releasePointerCapture(event.pointerId)
    drag = undefined; dragging.value = false
  }
  type Gesture = Event & { scale?: number, clientX?: number, clientY?: number }
  function gestureStart(event: Event) {
    if (!enabled.value) return
    event.preventDefault(); gestureZoom = zoom.value
  }
  function gestureChange(event: Gesture) {
    if (gestureZoom === undefined) return
    event.preventDefault()
    zoomAt(gestureZoom * (event.scale ?? 1), event.clientX, event.clientY)
  }
  function gestureEnd(event: Event) {
    if (gestureZoom !== undefined) event.preventDefault()
    gestureZoom = undefined
  }
  watch(ratio, reset)
  onMounted(() => {
    const element = viewport.value
    if (!element) return
    observer = new ResizeObserver(([entry]) => {
      if (entry) size.value = { width: entry.contentRect.width, height: entry.contentRect.height }
    })
    observer.observe(element)
    element.addEventListener('wheel', wheel, { passive: false })
    element.addEventListener('gesturestart', gestureStart, { passive: false })
    element.addEventListener('gesturechange', gestureChange, { passive: false })
    element.addEventListener('gestureend', gestureEnd, { passive: false })
  })
  onBeforeUnmount(() => {
    observer?.disconnect()
    const element = viewport.value
    element?.removeEventListener('wheel', wheel)
    element?.removeEventListener('gesturestart', gestureStart)
    element?.removeEventListener('gesturechange', gestureChange)
    element?.removeEventListener('gestureend', gestureEnd)
  })
  return { viewport, pan, dragging, baseWidth, reset, pointerDown, pointerMove, pointerUp }
}
