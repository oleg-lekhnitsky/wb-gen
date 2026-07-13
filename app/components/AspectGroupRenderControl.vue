<script setup lang="ts">
import { computed, ref } from 'vue'

const props = defineProps<{
  groupLabel: string
  count: number
  disabled?: boolean
  rendering?: boolean
  renderProgress?: number
}>()

const emit = defineEmits<{
  render: [scale: number]
}>()

const renderScale = ref(1)
const renderButtonLabel = computed(() => {
  return props.rendering
    ? 'Rendering'
    : `Render ${props.groupLabel} · ${props.count} PNGs`
})
const renderProgressStyle = computed(() => props.rendering
  ? { '--render-progress': `${Math.max(0, Math.min(1, props.renderProgress || 0)) * 100}%` }
  : undefined
)
</script>

<template>
  <div class="aspect-group-render-control">
    <div class="aspect-group-render-quality" aria-label="Export quality">
      <button
        type="button"
        :class="{ 'is-selected': renderScale === 1 }"
        @click="renderScale = 1"
      >
        1x
      </button>
      <button
        type="button"
        :class="{ 'is-selected': renderScale === 2 }"
        @click="renderScale = 2"
      >
        2x
      </button>
    </div>

    <button
      type="button"
      class="button button--accent button--sm aspect-group-render render-progress-button"
      :class="{ 'is-rendering': rendering }"
      :disabled="disabled || count === 0"
      :style="renderProgressStyle"
      aria-live="polite"
      @click="emit('render', renderScale)"
    >
      <span>{{ renderButtonLabel }}</span>
    </button>
  </div>
</template>
