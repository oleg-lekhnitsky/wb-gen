<script setup lang="ts">
import type { ContentLayoutPreset } from '~/utils/content-placement'

defineProps<{
  modelValue: ContentLayoutPreset
}>()

const emit = defineEmits<{
  'update:modelValue': [value: ContentLayoutPreset]
}>()

const presets: Array<{
  value: ContentLayoutPreset
  label: string
  description: string
}> = [
  {
    value: 'per-format',
    label: 'Per-format placement',
    description: 'Enter content once; choose a panel for each element in every format'
  },
  {
    value: 'stacked',
    label: 'Stacked',
    description: 'Edit the text, logo and button separately for each panel'
  },
  {
    value: 'adaptive-split',
    label: 'Top / bottom',
    description: 'Share content: copy and button above, logo and legal below. In landscape, content stays on the left.'
  }
]
</script>

<template>
  <section class="control-section layout-control">
    <div class="control-section__heading">
      <h2>Layout</h2>
      <span>Preset</span>
    </div>

    <div class="layout-preset-grid">
      <button
        v-for="preset in presets"
        :key="preset.value"
        type="button"
        class="layout-preset"
        :class="{ 'is-selected': modelValue === preset.value }"
        :aria-pressed="modelValue === preset.value"
        @click="emit('update:modelValue', preset.value)"
      >
        <span
          class="layout-preset__preview"
          :class="`layout-preset__preview--${preset.value}`"
          aria-hidden="true"
        >
          <i />
          <i />
          <i />
          <i />
        </span>
        <strong>{{ preset.label }}</strong>
        <small>{{ preset.description }}</small>
      </button>
    </div>
  </section>
</template>
