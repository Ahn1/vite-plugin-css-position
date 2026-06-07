<script lang="ts">
import { defineComponent, ref, h, onMounted, onUnmounted, watch } from "vue";
import type { StyleEntry, StylesMap, StylesTargetProps } from "./StylesTarget.types";
import { isLinkEntry } from "./StylesTarget.types";

declare const __VITE_CSS_POS_GLOBAL_VAR_NAME__: string;
declare const __VITE_CSS_POS_EVENT_NAME__: string;
declare const __VITE_CSS_POS_LINK_STRATEGY__: "link" | "adopt";

const globalVarName = __VITE_CSS_POS_GLOBAL_VAR_NAME__;
const eventName = __VITE_CSS_POS_EVENT_NAME__;
const linkStrategy = __VITE_CSS_POS_LINK_STRATEGY__;

const getCurrent = (): StylesMap | undefined => (window as any)[globalVarName];

type LinkEntry = Extract<StyleEntry, { type: "link" }>;

export default defineComponent({
  name: "StylesTarget",
  props: {
    onChange: {
      type: Function as unknown as () => StylesTargetProps["onChange"],
      required: false,
    },
  },
  setup(props) {
    const stylesMap = ref<StylesMap>(getCurrent() || new Map());
    const version = ref(0);
    const anchor = ref<HTMLSpanElement | null>(null);
    // Cache constructed sheets per href so the same file is parsed once.
    const adopted = new Map<string, CSSStyleSheet>();

    const updateListener = () => {
      const newValues = getCurrent() || new Map();
      stylesMap.value = newValues;
      version.value++;
      (props.onChange as StylesTargetProps["onChange"])?.(newValues);
    };

    // `cssChunks` + "adopt": fetch each CSS file and apply it to the containing
    // (shadow) root via adoptedStyleSheets — no FOUC, deduped across roots.
    const applyAdopted = () => {
      if (linkStrategy !== "adopt") return;
      const el = anchor.value;
      if (!el) return;
      const root = el.getRootNode() as ShadowRoot;
      if (!("adoptedStyleSheets" in root)) return;
      const hrefs = Array.from(stylesMap.value?.values() || [])
        .filter(isLinkEntry)
        .map((e: LinkEntry) => e.href);
      void Promise.all(
        hrefs.map(async (href) => {
          if (adopted.has(href)) return;
          const sheet = new CSSStyleSheet();
          sheet.replaceSync(await (await fetch(href)).text());
          adopted.set(href, sheet);
        })
      ).then(() => {
        const desired = hrefs.map((h) => adopted.get(h)).filter(Boolean) as CSSStyleSheet[];
        const existing = root.adoptedStyleSheets;
        const toAdd = desired.filter((s) => !existing.includes(s));
        if (toAdd.length) root.adoptedStyleSheets = [...existing, ...toAdd];
      });
    };

    onMounted(() => {
      window.addEventListener(eventName, updateListener);
      updateListener();
    });
    onUnmounted(() => {
      window.removeEventListener(eventName, updateListener);
    });
    watch(version, () => applyAdopted(), { flush: "post" });

    return () => {
      const nodes = Array.from(stylesMap.value?.entries() || []).map(([key, entry]) => {
        if (isLinkEntry(entry)) {
          if (linkStrategy === "adopt") return null;
          return h("link", { key, rel: "stylesheet", href: entry.href, ...entry.attributes });
        }
        return h("style", { key: `${key}-${version.value}`, ...entry.attributes }, entry.css);
      });
      if (linkStrategy === "adopt") {
        nodes.push(h("span", { ref: anchor, style: "display:none", "aria-hidden": "true" }));
      }
      return nodes;
    };
  },
});
</script>
