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

// Module-level cache: one fetch + parse per CSS file, shared across all
// StylesTarget instances — adoptedStyleSheets is designed to share the same
// sheet object between multiple (shadow) roots. Caching the promise (not the
// sheet) also prevents duplicate fetches when events fire in quick succession.
const sheetCache = new Map<string, Promise<CSSStyleSheet>>();

function loadSheet(href: string): Promise<CSSStyleSheet> {
  let promise = sheetCache.get(href);
  if (!promise) {
    promise = fetch(href)
      .then((response) => response.text())
      .then(async (css) => {
        const sheet = new CSSStyleSheet();
        await sheet.replace(css);
        return sheet;
      });
    // Drop failed loads so a later update can retry them.
    promise.catch(() => sheetCache.delete(href));
    sheetCache.set(href, promise);
  }
  return promise;
}

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

    const updateListener = () => {
      const newValues = getCurrent() || new Map();
      // Snapshot into a new Map: the global map is mutated in place, so a new
      // reference is needed to trigger the render (the render no longer reads
      // `version`, which previously provided that reactive dependency via keys).
      stylesMap.value = new Map(newValues);
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
      // Set: multiple entries may register the same CSS file (shared chunks).
      const hrefs = [
        ...new Set(
          Array.from(stylesMap.value?.values() || [])
            .filter(isLinkEntry)
            .map((e: LinkEntry) => e.href)
        ),
      ];
      void Promise.all(hrefs.map(loadSheet))
        .then((sheets) => {
          const existing = root.adoptedStyleSheets;
          const toAdd = sheets.filter((s) => !existing.includes(s));
          if (toAdd.length) root.adoptedStyleSheets = [...existing, ...toAdd];
        })
        // A failed fetch simply leaves that sheet out; loadSheet already
        // evicted it from the cache for a retry on the next update.
        .catch(() => {});
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
        // Keyed by id only: updates to an existing id (HMR) patch the text
        // child of the existing <style> node. A changing key would remount
        // every style element on each update and force a full re-parse.
        return h("style", { key, ...entry.attributes }, entry.css);
      });
      if (linkStrategy === "adopt") {
        nodes.push(h("span", { ref: anchor, style: "display:none", "aria-hidden": "true" }));
      }
      return nodes;
    };
  },
});
</script>
