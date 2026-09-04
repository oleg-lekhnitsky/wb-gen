<script setup lang="ts">
type ContentLayoutPreset = 'stacked' | 'adaptive-split'

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
    value: 'stacked',
    label: 'Stacked',
    description: 'Keep every element in one vertical stack'
  },
  {
    value: 'adaptive-split',
    label: 'Top / bottom',
    description: 'Copy in the top panel; logo and legal in the bottom panel'
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
