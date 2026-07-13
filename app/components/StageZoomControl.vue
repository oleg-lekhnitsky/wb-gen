<script setup lang="ts">
const props = withDefaults(defineProps<{
  modelValue: number
  min?: number
  max?: number
  step?: number
}>(), {
  min: 25,
  max: 100,
  step: 5
})

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

function clampZoom(value: number) {
  return Math.max(props.min, Math.min(props.max, Math.round(value)))
}

function updateZoom(value: number) {
  emit('update:modelValue', clampZoom(value))
}

function stepZoom(direction: -1 | 1) {
  updateZoom(props.modelValue + props.step * direction)
}

function rangeStyle(value: number, min: number, max: number) {
  const progress = ((value - min) / (max - min)) * 100
  const clampedProgress = Math.min(100, Math.max(0, progress))

  return { '--range-progress': `${clampedProgress}%` }
}
</script>

<template>
  <div class="stage-zoom-control" aria-label="Preview zoom">
    <button
      type="button"
      :disabled="modelValue <= min"
      aria-label="Zoom out preview"
      @click="stepZoom(-1)"
    >
      -
    </button>
    <input
      :value="modelValue"
      :style="rangeStyle(modelValue, min, max)"
      type="range"
      :min="min"
      :max="max"
      :step="step"
      aria-label="Preview zoom"
      @input="updateZoom(Number(($event.target as HTMLInputElement).value))"
    >
    <button
      type="button"
      :disabled="modelValue >= max"
      aria-label="Zoom in preview"
      @click="stepZoom(1)"
    >
      +
    </button>
    <output>{{ modelValue }}%</output>
  </div>
</template>
