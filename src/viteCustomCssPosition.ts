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

  const globalVarName = `__vite_c_css_pos_initial`;
  const eventName = `__vite_c_css_pos_update`;

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
      console.log("injectCode", css, attributes);
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
      console.log("injectCode done", window.${globalVarName});
    `;
    },
  });

  return [
    {
      name: "vite-plugin-custom-css-position",
      config(c) {
        return c;
      },
    },
    ...(Array.isArray(cssPlugin) ? cssPlugin : [cssPlugin]),
  ];
}
