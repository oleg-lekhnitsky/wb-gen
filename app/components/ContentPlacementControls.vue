<script setup lang="ts">
import { ref } from 'vue'
import { updateContentPlacement } from '~/utils/content-placement'
import type { ContentPlacement } from '~/utils/content-placement'
defineProps<{ modelValue: ContentPlacement, portrait: boolean, formatLabel: string, packs: Array<{id: string, label: string}> }>()
const emit = defineEmits<{ 'update:modelValue': [value: ContentPlacement], applyPack: [id: string] }>()
const pack = ref('google')
const rows = [{key:'background1',label:'Background 1'},{key:'copy',label:'Headline + subheading'},{key:'logo',label:'Logo'},{key:'cta',label:'CTA'},{key:'legal',label:'Legal'}] as const
</script>
<template>
  <section class="control-section content-placement-controls">
    <div class="control-section__heading"><h2>Placement</h2><span>{{ formatLabel }}</span></div>
    <div v-for="row in rows" :key="row.key" class="placement-row">
      <span>{{ row.label }}</span>
      <div class="placement-buttons" role="group" :aria-label="`${row.label} placement`">
        <button v-for="target in (['first', 'second'] as const)" :key="target"
          type="button" :aria-pressed="modelValue[row.key] === target"
          :class="{ 'is-selected': modelValue[row.key] === target }"
          @click="emit('update:modelValue', updateContentPlacement(modelValue, row.key, target))">
          {{ target === 'first' ? (portrait ? 'Top' : 'Left') : (portrait ? 'Bottom' : 'Right') }}
        </button>
      </div>
    </div>
    <div class="placement-pack-action">
      <select v-model="pack" aria-label="Placement destination pack"><option v-for="item in packs" :key="item.id" :value="item.id">{{ item.label }}</option></select>
      <button type="button" class="button button--outline button--compact" @click="emit('applyPack', pack)">Apply placement to pack</button>
    </div>
  </section>
</template>
