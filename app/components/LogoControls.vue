<script setup lang="ts">
defineProps<{
  logo: string
  isLogoImage: boolean
  isDefaultLogo: boolean
}>()

const emit = defineEmits<{
  'update:logo': [value: string]
  applyToAspects: []
  useDefault: []
  clear: []
  rememberScroll: []
  upload: [event: Event]
}>()

</script>

<template>
  <section class="control-section control-field">
    <div class="control-section__heading">
      <h2>Logo</h2>
      <button
        type="button"
        class="button button--ghost button--pill button--sm apply-to-all-button"
        @click="emit('applyToAspects')"
      >
        Apply to all
      </button>
    </div>

    <input
      v-if="!isLogoImage"
      id="logo-text"
      :value="logo"
      placeholder="Logo text"
      @input="emit('update:logo', ($event.target as HTMLInputElement).value)"
    >
    <div v-else class="logo-upload-status">
      {{ isDefaultLogo ? 'Default logo' : 'Uploaded logo' }}
    </div>

    <div class="asset-control">
      <button
        type="button"
        class="button button--outline upload-button"
        @click="emit('useDefault')"
      >
        Default logo
      </button>
      <label
        class="button button--outline upload-button"
        for="logo"
        @pointerdown="emit('rememberScroll')"
      >
        Upload logo
      </label>
      <button
        v-if="logo"
        type="button"
        class="button button--secondary clear-button"
        @click="emit('clear')"
      >
        Clear
      </button>
    </div>
    <input
      id="logo"
      class="visually-hidden"
      type="file"
      accept="image/*"
      @change="emit('upload', $event)"
    >

  </section>
</template>
