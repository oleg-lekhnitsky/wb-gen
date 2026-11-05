<script setup lang="ts">
import { cleanTextPaste } from '~/utils/text-paste'
import HeadingHighlightControl from '~/components/HeadingHighlightControl.vue'

type HeadingHighlight = {
  start: number
  end: number
  preset: 'white-pink' | 'purple-white'
}

defineProps<{
  heading: string
  headingHighlights?: HeadingHighlight[]
  textAlign?: 'left' | 'center'
  headingSize: number
  headingAutoScale?: boolean
  subheading: string
  subheadingSize: number
  subheadingRelative?: boolean
  subheadingHeadingRatio?: number
  legalText: string
  legalSize: number
  legalRelative?: boolean
  legalHeadingRatio?: number
  legalOpacity: number
  legalShadow: boolean
  legalShadowOpacity: number
  logoWidth?: number
  showLogoWidth?: boolean
}>()

const emit = defineEmits<{
  'update:heading': [value: string]
  'update:headingHighlights': [value: HeadingHighlight[]]
  'update:textAlign': [value: 'left' | 'center']
  'update:headingSize': [value: number]
  'update:headingAutoScale': [value: boolean]
  'update:subheading': [value: string]
  'update:subheadingSize': [value: number]
  'update:subheadingRelative': [value: boolean]
  'update:subheadingHeadingRatio': [value: number]
  'update:legalText': [value: string]
  'update:legalSize': [value: number]
  'update:legalRelative': [value: boolean]
  'update:legalHeadingRatio': [value: number]
  'update:legalOpacity': [value: number]
  'update:legalShadow': [value: boolean]
  'update:legalShadowOpacity': [value: number]
  'update:logoWidth': [value: number]
  applyToAspects: []
}>()

function setRelativeSizing(enabled: boolean) {
  emit('update:subheadingRelative', enabled)
  emit('update:legalRelative', enabled)
}

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

    <div class="control-field">
      <label id="text-alignment-label">Text alignment</label>
      <div class="placement-buttons" role="group" aria-labelledby="text-alignment-label">
        <button v-for="alignment in (['left', 'center'] as const)" :key="alignment"
          type="button" :aria-pressed="(textAlign || 'left') === alignment"
          :class="{ 'is-selected': (textAlign || 'left') === alignment }"
          @click="emit('update:textAlign', alignment)">
          {{ alignment === 'left' ? 'Left' : 'Center' }}
        </button>
      </div>
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
        @paste="cleanTextPaste"
        :value="subheading"
        placeholder="Add subheading"
        @input="emit('update:subheading', ($event.target as HTMLInputElement).value)"
      >
    </div>

    <div class="control-field">
      <label for="legal">Legal text <span>optional</span></label>
      <textarea
        id="legal"
        @paste="cleanTextPaste"
        :value="legalText"
        placeholder="Add legal text"
        @input="emit('update:legalText', ($event.target as HTMLTextAreaElement).value)"
      />
    </div>

    <div class="text-size-control relative-sizing-control" role="group" aria-label="Relative sizing">
      <label class="auto-fit-toggle" :class="{ 'is-active': subheadingRelative || legalRelative }">
        <span class="auto-fit-toggle__icon" aria-hidden="true">↔</span>
        <span class="auto-fit-toggle__copy">
          <span class="auto-fit-toggle__title">Relative sizing</span>
          <span class="auto-fit-toggle__description">Subheading, legal and logo relative to heading</span>
        </span>
        <input class="auto-fit-toggle__input" type="checkbox"
          :checked="!!subheadingRelative && !!legalRelative"
          :indeterminate="!!subheadingRelative !== !!legalRelative"
          @change="setRelativeSizing(($event.target as HTMLInputElement).checked)">
        <span class="auto-fit-toggle__switch" aria-hidden="true" />
      </label>
      <template v-if="subheadingRelative || legalRelative">
        <label>
          <span>Subheading / heading cap height</span>
          <div class="range-row">
            <input type="range" min="1" max="100" step="1" :disabled="!subheadingRelative"
              :value="subheadingHeadingRatio ?? 50" :style="rangeStyle(subheadingHeadingRatio ?? 50, 1, 100)"
              @input="emit('update:subheadingHeadingRatio', Number(($event.target as HTMLInputElement).value))">
            <output>{{ subheadingHeadingRatio ?? 50 }}%</output>
          </div>
        </label>
        <label>
          <span>Legal / heading cap height</span>
          <div class="range-row">
            <input type="range" min="1" max="100" step="1" :disabled="!legalRelative"
              :value="legalHeadingRatio ?? 50" :style="rangeStyle(legalHeadingRatio ?? 50, 1, 100)"
              @input="emit('update:legalHeadingRatio', Number(($event.target as HTMLInputElement).value))">
            <output>{{ legalHeadingRatio ?? 50 }}%</output>
          </div>
        </label>
      </template>
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
            Fits the available space · heading size sets the maximum
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

      <label v-if="!subheadingRelative">
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

      <label v-if="!legalRelative">
        <span>Legal size</span>
        <div class="range-row">
          <input :value="legalSize" :style="rangeStyle(legalSize, 25, 800)" type="range" min="25" max="800" step="1" @input="emit('update:legalSize', Number(($event.target as HTMLInputElement).value))">
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
