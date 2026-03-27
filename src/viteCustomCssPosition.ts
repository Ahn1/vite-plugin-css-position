import type { Plugin } from "vite";
import cssInjectedByJsPlugin from "vite-plugin-css-injected-by-js";
import { randomUUID, hash } from "crypto";

// Extract jsAssetsFilterFunction type from the underlying plugin
type CssInjectedPluginConfig = NonNullable<Parameters<typeof cssInjectedByJsPlugin>[0]>;
type JsAssetsFilterFunction = CssInjectedPluginConfig["jsAssetsFilterFunction"];

export interface ViteCustomCssPositionOptions {
  instanceId?: string;
  enableDev?: boolean;
  /**
   * Filter function to determine which JS entry file(s) should receive the CSS injection code.
   * Useful when building multiple entry points and you want CSS only in specific entries.
   * @param chunk - The output chunk being processed
   * @returns true if CSS should be injected into this chunk
   */
  jsAssetsFilterFunction?: JsAssetsFilterFunction;
}

export default function viteCustomCssPosition(
  options?: ViteCustomCssPositionOptions
): Plugin | Plugin[] {
  const instanceId = options?.instanceId || randomUUID().replace(/-/g, "");

  const globalVarName = `__vite_c_css_pos_initial_${instanceId}`;
  const eventName = `__vite_c_css_pos_update_${instanceId}`;

  const cssPlugin = cssInjectedByJsPlugin({
    jsAssetsFilterFunction: options?.jsAssetsFilterFunction,
    dev: {
      enableDev: options?.enableDev ?? false,
      removeStyleCode(id: string) {
        return `
    (() => {
          if(window.${globalVarName} && window.${globalVarName}.has('${id}')) {
            window.${globalVarName}.delete('${id}');
            window.dispatchEvent( new Event('${eventName}') );
          }
    })()
          `;
      },
    },
    injectCode: (css, attributes) => {
      const attributesString = JSON.stringify(attributes.attributes || {});
      const id = `"${
        attributes.attributes?.["data-vite-dev-id"] ??
        hash("sha1", css).substring(0, 12)
      }"`;
      return `const css = ${css};const id = ${id};const attributes = JSON.parse('${attributesString}');
      window.${globalVarName} = window.${globalVarName} || new Map();
      window.${globalVarName}.set(id, {css, attributes});
      window.dispatchEvent( new Event('${eventName}') );`;
    },
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
    ...(Array.isArray(cssPlugin) ? cssPlugin : [cssPlugin]),
  ];
}
