<script setup lang="ts">
import { cleanTextPaste } from '~/utils/text-paste'
defineProps<{
  text?: string
  size?: number
  pulse?: boolean
  align?: 'left' | 'right'
  bottomMargin?: boolean
  autoBottomMargin?: boolean
}>()

const emit = defineEmits<{
  'update:text': [value: string]
  'update:size': [value: number]
  'update:pulse': [value: boolean]
  'update:align': [value: 'left' | 'right']
  'update:bottomMargin': [value: boolean]
  applyToAspects: []
}>()

function rangeStyle(value: number | undefined, min: number, max: number) {
  const numericValue = Number(value ?? 100)
  const progress = ((numericValue - min) / (max - min)) * 100
  return { '--range-progress': `${Math.min(100, Math.max(0, progress))}%` }
}
</script>

<template>
  <section class="control-section cta-controls">
    <div class="control-section__heading">
      <h2>CTA button</h2>
      <button
        type="button"
        class="button button--ghost button--pill button--sm apply-to-all-button"
        @click="emit('applyToAspects')"
      >
        Apply to all
      </button>
    </div>

    <div class="control-field">
      <label for="cta-text">Button text <span>optional</span></label>
      <input
        id="cta-text"
        @paste="cleanTextPaste"
        :value="text"
        placeholder="Add CTA"
        @input="emit('update:text', ($event.target as HTMLInputElement).value)"
      >
    </div>

    <div class="text-size-control">
      <div class="text-size-control-field">
        <span id="cta-alignment-label">Alignment</span>
        <div class="placement-buttons" role="group" aria-labelledby="cta-alignment-label">
          <button
            v-for="side in (['left', 'right'] as const)"
            :key="side"
            type="button"
            :aria-pressed="(align || 'right') === side"
            :class="{ 'is-selected': (align || 'right') === side }"
            @click="emit('update:align', side)"
          >
            {{ side === 'left' ? 'Left' : 'Right' }}
          </button>
        </div>
      </div>

      <label>
        <span>Button size</span>
        <div class="range-row">
          <input
            :value="size ?? 100"
            :style="rangeStyle(size, 25, 200)"
            type="range"
            min="25"
            max="200"
            step="1"
            @input="emit('update:size', Number(($event.target as HTMLInputElement).value))"
          >
          <output>{{ Math.round(size ?? 100) }}%</output>
        </div>
      </label>

      <label class="text-shadow-toggle">
        <span>Pulse animation</span>
        <input
          :checked="pulse"
          type="checkbox"
          @change="emit('update:pulse', ($event.target as HTMLInputElement).checked)"
        >
      </label>

      <label class="text-shadow-toggle">
        <span>Bottom margin</span>
        <input
          :checked="bottomMargin || autoBottomMargin"
          :disabled="autoBottomMargin"
          :title="autoBottomMargin ? 'Applied automatically above legal text' : undefined"
          type="checkbox"
          @change="emit('update:bottomMargin', ($event.target as HTMLInputElement).checked)"
        >
      </label>
    </div>
  </section>
</template>
