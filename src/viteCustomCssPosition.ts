import type { Plugin, Rollup } from "vite";
import { randomUUID } from "crypto";
import { cssInjectionPlugins } from "./cssInjection";

type JsAssetsFilterFunction = (chunk: Rollup.OutputChunk) => boolean;

/** How `StylesTarget` includes CSS files in `cssChunks` mode. */
export type CssChunksStrategy = "link" | "adopt";

/** Options shared by every mode. */
interface BaseCssPositionOptions {
  instanceId?: string;
  enableDev?: boolean;
  /**
   * Filter function to determine which JS file(s) should receive the CSS injection code.
   * Useful when building multiple entry points and you want CSS only in specific entries.
   * @param chunk - The output chunk being processed
   * @returns true if CSS should be injected into this chunk
   */
  jsAssetsFilterFunction?: JsAssetsFilterFunction;
}

/**
 * Mode-specific options. A discriminated union so that `cssChunksStrategy` is
 * only assignable when `mode: "cssChunks"`.
 */
type ModeCssPositionOptions =
  | {
      /**
       * How CSS is delivered and registered:
       * - `"inject"` (default): all CSS is concatenated and inlined into the entry
       *   JS, registered as `<style>`. The previous default behavior.
       * - `"injectPerChunk"`: each chunk's CSS is inlined into its JS, registered
       *   as `<style>` — component-level granular lazy-loading via inlined styles.
       *
       * @default "inject"
       */
      mode?: "inject" | "injectPerChunk";
      /** Only valid with `mode: "cssChunks"`. */
      cssChunksStrategy?: never;
    }
  | {
      /**
       * `"cssChunks"`: Vite's emitted `.css` chunk files are kept; each chunk only
       * registers its CSS file URL, and `StylesTarget` links/adopts it at its
       * position. Closest to standard Vite (cacheable files, lean JS, CSP-friendly).
       */
      mode: "cssChunks";
      /**
       * How `StylesTarget` includes the CSS file:
       * - `"link"` (default): render `<link rel="stylesheet">`. Simple; may FOUC in
       *   Shadow DOM (link is not render-blocking there).
       * - `"adopt"`: fetch the CSS and apply it via `adoptedStyleSheets`. No FOUC,
       *   CSP-ideal, dedup across roots; requires `fetch` + modern browsers (2023+).
       *
       * @default "link"
       */
      cssChunksStrategy?: CssChunksStrategy;
    };

export type ViteCustomCssPositionOptions = BaseCssPositionOptions & ModeCssPositionOptions;

export default function viteCustomCssPosition(
  options?: ViteCustomCssPositionOptions
): Plugin | Plugin[] {
  const instanceId =
    options?.instanceId || randomUUID().replace(/-/g, "").slice(0, 4);

  const globalVarName = `__vcssp_c_${instanceId}`;
  const eventName = `__vcssp_e_${instanceId}`;
  const linkStrategy: CssChunksStrategy = options?.cssChunksStrategy ?? "link";

  const cssPlugins = cssInjectionPlugins({
    globalVarName,
    eventName,
    enableDev: options?.enableDev ?? false,
    mode: options?.mode ?? "inject",
    jsAssetsFilterFunction: options?.jsAssetsFilterFunction,
  });

  return [
    {
      name: "vite-plugin-custom-css-position",
      config(c) {
        return {
          ...c,
          define: {
            ...c.define,
            __VITE_CSS_POS_GLOBAL_VAR_NAME__: JSON.stringify(globalVarName),
            __VITE_CSS_POS_EVENT_NAME__: JSON.stringify(eventName),
            __VITE_CSS_POS_LINK_STRATEGY__: JSON.stringify(linkStrategy),
          },
        };
      },
    },
    ...cssPlugins,
  ];
}
