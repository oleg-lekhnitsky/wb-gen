<script setup lang="ts">
import HeadingHighlightControl from '~/components/HeadingHighlightControl.vue'

type HeadingHighlight = {
  start: number
  end: number
  preset: 'white-pink' | 'purple-white'
}

defineProps<{
  heading: string
  headingHighlights?: HeadingHighlight[]
  headingSize: number
  headingAutoScale?: boolean
  subheading: string
  subheadingSize: number
  legalText: string
  legalSize: number
  legalOpacity: number
  legalShadow: boolean
  legalShadowOpacity: number
  logoWidth?: number
  showLogoWidth?: boolean
}>()

const emit = defineEmits<{
  'update:heading': [value: string]
  'update:headingHighlights': [value: HeadingHighlight[]]
  'update:headingSize': [value: number]
  'update:headingAutoScale': [value: boolean]
  'update:subheading': [value: string]
  'update:subheadingSize': [value: number]
  'update:legalText': [value: string]
  'update:legalSize': [value: number]
  'update:legalOpacity': [value: number]
  'update:legalShadow': [value: boolean]
  'update:legalShadowOpacity': [value: number]
  'update:logoWidth': [value: number]
  applyToAspects: []
}>()

function rangeStyle(value: number | undefined, min: number, max: number) {
  const numericValue = Number(value ?? min)
  const progress = ((numericValue - min) / (max - min)) * 100
  const clampedProgress = Math.min(100, Math.max(0, progress))

  return { '--range-progress': `${clampedProgress}%` }
}
</script>

<template>
  <section class="control-section text-control-group">
    <div class="control-section__heading">
      <h2>Text</h2>
      <button
        type="button"
        class="button button--ghost button--pill button--sm apply-to-all-button"
        @click="emit('applyToAspects')"
      >
        Apply to all
      </button>
    </div>

    <HeadingHighlightControl
      :heading="heading"
      :highlights="headingHighlights"
      @update:heading="emit('update:heading', $event)"
      @update:highlights="emit('update:headingHighlights', $event)"
    />

    <div class="control-field">
      <label for="subheading">Subheading <span>optional</span></label>
      <input
        id="subheading"
        :value="subheading"
        placeholder="Add subheading"
        @input="emit('update:subheading', ($event.target as HTMLInputElement).value)"
      >
    </div>

    <div class="control-field">
      <label for="legal">Legal text <span>optional</span></label>
      <textarea
        id="legal"
        :value="legalText"
        placeholder="Add legal text"
        @input="emit('update:legalText', ($event.target as HTMLTextAreaElement).value)"
      />
    </div>

    <div class="text-size-control">
      <label
        class="auto-fit-toggle"
        :class="{ 'is-active': headingAutoScale }"
      >
        <span class="auto-fit-toggle__icon" aria-hidden="true">↔</span>
        <span class="auto-fit-toggle__copy">
          <span class="auto-fit-toggle__title">
            Auto-fit heading
            <small>Experimental</small>
          </span>
          <span class="auto-fit-toggle__description">
            One shared size · balances short words around the longest line
          </span>
        </span>
        <input
          class="auto-fit-toggle__input"
          :checked="headingAutoScale"
          type="checkbox"
          @change="emit('update:headingAutoScale', ($event.target as HTMLInputElement).checked)"
        >
        <span class="auto-fit-toggle__switch" aria-hidden="true" />
      </label>

      <label>
        <span>Heading size</span>
        <div class="range-row">
          <input
            :value="headingSize"
            :style="rangeStyle(headingSize, 25, 200)"
            type="range"
            min="25"
            max="200"
            step="1"
            @input="emit('update:headingSize', Number(($event.target as HTMLInputElement).value))"
          >
          <output>{{ Math.round(headingSize) }}%</output>
        </div>
      </label>

      <label>
        <span>Subheading size</span>
        <div class="range-row">
          <input
            :value="subheadingSize"
            :style="rangeStyle(subheadingSize, 25, 200)"
            type="range"
            min="25"
            max="200"
            step="1"
            @input="emit('update:subheadingSize', Number(($event.target as HTMLInputElement).value))"
          >
          <output>{{ Math.round(subheadingSize) }}%</output>
        </div>
      </label>

      <label v-if="showLogoWidth">
        <span>Logo width</span>
        <div class="range-row">
          <input
            :value="logoWidth"
            :style="rangeStyle(logoWidth, 1, 100)"
            type="range"
            min="1"
            max="100"
            step="1"
            @input="emit('update:logoWidth', Number(($event.target as HTMLInputElement).value))"
          >
          <output>{{ Math.round(logoWidth || 0) }}%</output>
        </div>
      </label>

      <label>
        <span>Legal size</span>
        <div class="range-row">
          <input
            :value="legalSize"
            :style="rangeStyle(legalSize, 25, 800)"
            type="range"
            min="25"
            max="800"
            step="1"
            @input="emit('update:legalSize', Number(($event.target as HTMLInputElement).value))"
          >
          <output>{{ Math.round(legalSize) }}%</output>
        </div>
      </label>

      <label>
        <span>Legal opacity</span>
        <div class="range-row">
          <input
            :value="legalOpacity"
            :style="rangeStyle(legalOpacity, 0, 100)"
            type="range"
            min="0"
            max="100"
            step="1"
            @input="emit('update:legalOpacity', Number(($event.target as HTMLInputElement).value))"
          >
          <output>{{ Math.round(legalOpacity) }}%</output>
        </div>
      </label>

      <label class="text-shadow-toggle">
        <span>Legal shadow</span>
        <input
          :checked="legalShadow"
          type="checkbox"
          @change="emit('update:legalShadow', ($event.target as HTMLInputElement).checked)"
        >
      </label>

      <label>
        <span>Shadow opacity</span>
        <div class="range-row">
          <input
            :value="legalShadowOpacity"
            :style="rangeStyle(legalShadowOpacity, 0, 100)"
            type="range"
            min="0"
            max="100"
            step="1"
            :disabled="!legalShadow"
            @input="emit('update:legalShadowOpacity', Number(($event.target as HTMLInputElement).value))"
          >
          <output>{{ Math.round(legalShadowOpacity) }}%</output>
        </div>
      </label>
    </div>
  </section>
</template>
