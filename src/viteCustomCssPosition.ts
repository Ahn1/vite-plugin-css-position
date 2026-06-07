import type { Plugin, Rollup } from "vite";
import { randomUUID } from "crypto";
import { cssInjectionPlugins } from "./cssInjection";

type JsAssetsFilterFunction = (chunk: Rollup.OutputChunk) => boolean;

export interface ViteCustomCssPositionOptions {
  instanceId?: string;
  enableDev?: boolean;
  /**
   * Inject each (including lazily loaded) chunk's CSS relative to that chunk
   * instead of bundling all CSS into the entry. Enables component-level granular
   * lazy-loading of stylesheets: a code-split component's styles are only injected
   * when the component is actually loaded.
   *
   * `false` (default) keeps the previous behavior (all CSS in the entry, loaded
   * up front) and is fully backward compatible.
   *
   * @default false
   */
  lazy?: boolean;
  /**
   * Filter function to determine which JS file(s) should receive the CSS injection code.
   * Useful when building multiple entry points and you want CSS only in specific entries.
   * @param chunk - The output chunk being processed
   * @returns true if CSS should be injected into this chunk
   */
  jsAssetsFilterFunction?: JsAssetsFilterFunction;
}

export default function viteCustomCssPosition(
  options?: ViteCustomCssPositionOptions,
): Plugin | Plugin[] {
  const instanceId =
    options?.instanceId || randomUUID().replace(/-/g, "").slice(0, 4);

  const globalVarName = `__vcssp_c_${instanceId}`;
  const eventName = `__vcssp_e_${instanceId}`;

  const cssPlugins = cssInjectionPlugins({
    globalVarName,
    eventName,
    enableDev: options?.enableDev ?? false,
    relative: options?.lazy ?? false,
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
          },
        };
      },
    },
    ...cssPlugins,
  ];
}
