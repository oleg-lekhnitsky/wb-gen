<script setup lang="ts">
type BackgroundPreset = 'solid' | 'split' | 'checker'

const props = defineProps<{
  backgroundColor: string
  backgroundPreset: BackgroundPreset
  splitAngle: number
  checkerCells: number
}>()

const emit = defineEmits<{
  'update:backgroundColor': [value: string]
  'update:backgroundPreset': [value: BackgroundPreset]
  'update:splitAngle': [value: number]
  'update:checkerCells': [value: number]
  rotate: []
  applyToAspects: []
}>()

function setSolidColor(color: string) {
  emit('update:backgroundColor', color)
  emit('update:backgroundPreset', 'solid')
}

function isCustomColorSelected() {
  return (
    props.backgroundPreset === 'solid'
    && !['#ff00ff', '#7f30e3', '#ffffff'].includes(props.backgroundColor.toLowerCase())
  )
}

function rangeStyle(value: number, min: number, max: number) {
  const progress = ((value - min) / (max - min)) * 100
  const clampedProgress = Math.min(100, Math.max(0, progress))

  return { '--range-progress': `${clampedProgress}%` }
}
</script>

<template>
  <div class="control-section control-field">
    <div class="control-section__heading">
      <h2>Background color</h2>
      <button
        type="button"
        class="button button--ghost button--pill button--sm apply-to-all-button"
        @click="emit('applyToAspects')"
      >
        Apply to all
      </button>
    </div>

    <div class="background-option-grid">
      <button
        type="button"
        class="background-option background-option--pink"
        :class="{ 'is-selected': backgroundPreset === 'solid' && backgroundColor.toLowerCase() === '#ff00ff' }"
        aria-label="Use #FF00FF"
        @click="setSolidColor('#ff00ff')"
      >
        <span class="background-option__swatch" />
        <span class="background-option__label">Pink</span>
      </button>
      <button
        type="button"
        class="background-option background-option--purple"
        :class="{ 'is-selected': backgroundPreset === 'solid' && backgroundColor.toLowerCase() === '#7f30e3' }"
        aria-label="Use #7F30E3"
        @click="setSolidColor('#7f30e3')"
      >
        <span class="background-option__swatch" />
        <span class="background-option__label">Purple</span>
      </button>
      <button
        type="button"
        class="background-option background-option--white"
        :class="{ 'is-selected': backgroundPreset === 'solid' && backgroundColor.toLowerCase() === '#ffffff' }"
        aria-label="Use #FFFFFF"
        @click="setSolidColor('#ffffff')"
      >
        <span class="background-option__swatch" />
        <span class="background-option__label">White</span>
      </button>
      <label
        class="background-option background-option--custom"
        :class="{ 'is-selected': isCustomColorSelected() }"
      >
        <input
          :value="backgroundColor"
          type="color"
          aria-label="Custom background color"
          @input="setSolidColor(($event.target as HTMLInputElement).value)"
        >
        <span
          class="background-option__swatch"
          :style="isCustomColorSelected()
            ? { backgroundColor, backgroundImage: 'none' }
            : undefined"
        />
        <span class="background-option__label">Custom</span>
      </label>

      <button
        type="button"
        class="background-option"
        :class="{ 'is-selected': backgroundPreset === 'split' }"
        @click="emit('update:backgroundPreset', 'split')"
      >
        <span class="background-option__swatch background-option__swatch--split" />
        <span class="background-option__label">Split</span>
      </button>

      <button
        type="button"
        class="background-option"
        :class="{ 'is-selected': backgroundPreset === 'checker' }"
        @click="emit('update:backgroundPreset', 'checker')"
      >
        <span class="background-option__swatch background-option__swatch--checker" />
        <span class="background-option__label">Checker</span>
      </button>
    </div>

    <div
      v-if="backgroundPreset === 'split' || backgroundPreset === 'checker'"
      class="split-direction"
    >
      <label for="background-angle">
        {{ backgroundPreset === 'checker' ? 'Checker rotation' : 'Direction' }}
      </label>
      <div class="range-row">
        <input
          id="background-angle"
          :value="splitAngle"
          :style="rangeStyle(splitAngle, 0, 359)"
          type="range"
          min="0"
          max="359"
          step="1"
          @input="emit('update:splitAngle', Number(($event.target as HTMLInputElement).value))"
        >
        <output>{{ splitAngle }}°</output>
      </div>
      <button
        type="button"
        class="button button--secondary button--block"
        @click="emit('rotate')"
      >
        Rotate 90°
      </button>

      <div v-if="backgroundPreset === 'checker'" class="checker-cells">
        <label>Cells</label>
        <div class="segmented-control">
          <button
            v-for="cellCount in [2, 3, 4, 6, 8]"
            :key="cellCount"
            type="button"
            :class="{ 'is-active': checkerCells === cellCount }"
            @click="emit('update:checkerCells', cellCount)"
          >
            {{ cellCount }}
          </button>
        </div>
      </div>
    </div>

  </div>
</template>
