import type { Plugin } from "vite";
import cssInjectedByJsPlugin from "vite-plugin-css-injected-by-js";
import { randomUUID } from "crypto";

export interface ViteCustomCssPositionOptions {
  instanceId?: string;
  enableDev?: boolean;
}

export default function viteCustomCssPosition(
  options?: ViteCustomCssPositionOptions
): Plugin | Plugin[] {
  const instanceId = options?.instanceId || randomUUID().replace(/-/g, "");

  const globalVarName = `__vite_c_css_pos_initial_${instanceId}`;
  const eventName = `__vite_c_css_pos_update_${instanceId}`;

  const cssPlugin = cssInjectedByJsPlugin({
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
      const attributesString = JSON.stringify(attributes.attributes);
      const id = `"${
        attributes.attributes?.["data-vite-dev-id"] ?? "__nokey__"
      }"`;
      return `
    const css = ${css};
    const id = ${id};
      const attributes = JSON.parse('${attributesString}');
      window.${globalVarName} = window.${globalVarName} || new Map();
      window.${globalVarName}.set(id, {css, attributes});

      window.dispatchEvent( new Event('${eventName}') );
    `;
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
