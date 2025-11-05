<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import type { StylesTargetProps } from "./StylesTarget.types";

declare const __VITE_CSS_POS_GLOBAL_VAR_NAME__: string;
declare const __VITE_CSS_POS_EVENT_NAME__: string;

const globalVarName = __VITE_CSS_POS_GLOBAL_VAR_NAME__;
const eventName = __VITE_CSS_POS_EVENT_NAME__;

const getCurrent = () => (window as any)[globalVarName];

const props = defineProps<StylesTargetProps>();

const stylesMap = ref<Map<string, { css: string; attributes: Record<string, string> }>>(
  getCurrent() || new Map()
);
const version = ref(0);

const updateListener = (_e: Event | undefined) => {
  const newValues = getCurrent() || new Map();
  stylesMap.value = newValues;
  version.value++;
  props.onChange?.(newValues);
};

const styleEntries = computed(() => {
  return Array.from(stylesMap.value?.keys() || []).map((key) => ({
    key,
    entry: stylesMap.value.get(key),
  }));
});

onMounted(() => {
  window.addEventListener(eventName, updateListener);
  updateListener(undefined);
});

onUnmounted(() => {
  window.removeEventListener(eventName, updateListener);
});
</script>

<template>
  <style
    v-for="item in styleEntries"
    :key="`${item.key}-${version}`"
    v-bind="item.entry?.attributes"
  >
    {{ item.entry?.css }}
  </style>
</template>
