/**
 * CSS-by-JS injection core, vendored and trimmed from
 * `vite-plugin-css-injected-by-js` (v3.5.2) by Marco Prontera.
 *
 * Original: https://github.com/marco-prontera/vite-plugin-css-injected-by-js
 * Licensed under the MIT License — Copyright (c) 2023 Marco Prontera.
 *
 * This is a focused port: instead of creating `<style>` elements directly, the
 * generated injection code stores the CSS into a global Map and dispatches an
 * event, which the `StylesTarget` component reacts to in order to render the
 * styles at a custom position (e.g. inside a Shadow DOM). Unlike the original it
 * does NOT run a nested Vite build to produce the injection code; the snippet is
 * built directly and wrapped in an IIFE.
 */
import { hash } from "crypto";
import type { Plugin, ResolvedConfig, Rollup } from "vite";

export interface CssInjectionOptions {
  /** Name of the global variable holding the styles Map. */
  globalVarName: string;
  /** Name of the window event dispatched on style updates. */
  eventName: string;
  /** Enable the experimental dev-mode (HMR) transform. */
  enableDev: boolean;
  /**
   * Inject CSS relative to each JS chunk (incl. lazily loaded ones) instead of
   * concatenating everything into the entry chunk. Enables component-level
   * granular lazy-loading of stylesheets.
   */
  relative: boolean;
  /** Filter which JS chunks receive the CSS injection code. */
  jsAssetsFilterFunction?: ((chunk: Rollup.OutputChunk) => boolean) | undefined;
}

// CSS is injected before the rest of the chunk's code (parity with the original
// plugin's default `topExecutionPriority: true`).
const TOP_EXECUTION_PRIORITY = true;

// `viteMetadata.importedCss` is a Vite augmentation of Rollup's chunk type that
// isn't surfaced through Vite's re-exported `Rollup` namespace; access it via a
// local typed view.
type ChunkWithCssMeta = Rollup.OutputChunk & {
  viteMetadata?: { importedCss: Set<string> };
};

function importedCssOf(chunk: Rollup.OutputChunk): Set<string> | undefined {
  return (chunk as ChunkWithCssMeta).viteMetadata?.importedCss;
}

function warnLog(msg: string): void {
  console.warn(`\x1b[33m \n${msg} \x1b[39m`);
}

/* -------------------------------------------------------------------------- */
/* Injection code generation                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Build the runtime snippet that registers the given CSS in the global Map and
 * notifies listeners. Wrapped in an IIFE so the local `const`s don't leak into
 * (or collide within) the chunk scope it is appended to.
 *
 * @param cssCodeExpr A JS expression evaluating to the CSS string. In build mode
 *   this is a JSON string literal; in dev mode it's the `__vite__css` variable.
 * @param attributes Attributes to attach to the rendered `<style>` (dev only).
 */
function buildInjectionCode(
  globalVarName: string,
  eventName: string,
  cssCodeExpr: string,
  attributes?: Record<string, string>
): string {
  const attributesString = JSON.stringify(attributes || {});
  const id = `"${
    attributes?.["data-vite-dev-id"] ?? hash("sha1", cssCodeExpr).substring(0, 12)
  }"`;
  const body =
    `const css = ${cssCodeExpr};const id = ${id};const attributes = JSON.parse('${attributesString}');` +
    `window.${globalVarName} = window.${globalVarName} || new Map();` +
    `window.${globalVarName}.set(id, {css, attributes});` +
    `window.dispatchEvent( new Event('${eventName}') );`;
  return `(()=>{${body}})();`;
}

/** Code executed (dev mode) to remove a previously injected style on HMR update. */
function buildRemoveStyleCode(globalVarName: string, eventName: string, id: string): string {
  return `(() => {
    if(window.${globalVarName} && window.${globalVarName}.has('${id}')) {
      window.${globalVarName}.delete('${id}');
      window.dispatchEvent( new Event('${eventName}') );
    }
  })()`;
}

/* -------------------------------------------------------------------------- */
/* Bundle helpers (ported from vite-plugin-css-injected-by-js utils)          */
/* -------------------------------------------------------------------------- */

// The cache must be global since the execution context differs per entry.
const cssSourceCache: Record<string, string> = {};

function extractCss(bundle: Rollup.OutputBundle, cssName: string): string {
  const cssAsset = bundle[cssName] as Rollup.OutputAsset | undefined;
  if (cssAsset !== undefined && cssAsset.source) {
    const cssSource = cssAsset.source;
    cssSourceCache[cssName] =
      cssSource instanceof Uint8Array ? new TextDecoder().decode(cssSource) : `${cssSource}`;
  }
  return cssSourceCache[cssName] ?? "";
}

function concatCssAndDeleteFromBundle(bundle: Rollup.OutputBundle, cssAssets: string[]): string {
  return cssAssets.reduce((previous, cssName) => {
    const cssSource = extractCss(bundle, cssName);
    delete bundle[cssName];
    return previous + cssSource;
  }, "");
}

function isJsOutputChunk(chunk: Rollup.OutputAsset | Rollup.OutputChunk): chunk is Rollup.OutputChunk {
  return chunk.type == "chunk" && chunk.fileName.match(/.[cm]?js(?:\?.+)?$/) != null;
}

function defaultJsAssetsFilter(chunk: Rollup.OutputChunk): boolean {
  return chunk.isEntry && !chunk.fileName.includes("polyfill");
}

function getJsTargetBundleKeys(
  bundle: Rollup.OutputBundle,
  jsAssetsFilterFunction?: (chunk: Rollup.OutputChunk) => boolean
): string[] {
  if (typeof jsAssetsFilterFunction != "function") {
    const jsAssets = Object.keys(bundle).filter((i) => {
      const asset = bundle[i];
      return asset !== undefined && isJsOutputChunk(asset) && defaultJsAssetsFilter(asset);
    });
    const jsTargetFileName = jsAssets[jsAssets.length - 1];
    if (jsTargetFileName === undefined) {
      return [];
    }
    if (jsAssets.length > 1) {
      warnLog(
        `[vite-plugin-css-position] identified "${jsTargetFileName}" as one of multiple "entry" output files to put the CSS injection code. ` +
          'If this is not the intended file, use the "jsAssetsFilterFunction" option to specify the desired output file.'
      );
    }
    return [jsTargetFileName];
  }
  return Object.entries(bundle)
    .filter(([, chunk]) => isJsOutputChunk(chunk) && jsAssetsFilterFunction(chunk))
    .map(([key]) => key);
}

function buildJsCssMap(
  bundle: Rollup.OutputBundle,
  jsAssetsFilterFunction?: (chunk: Rollup.OutputChunk) => boolean
): Record<string, string[]> {
  const chunksWithCss: Record<string, string[]> = {};
  const bundleKeys = getJsTargetBundleKeys(
    bundle,
    typeof jsAssetsFilterFunction == "function" ? jsAssetsFilterFunction : () => true
  );
  if (bundleKeys.length === 0) {
    throw new Error(
      "Unable to locate the JavaScript asset for adding the CSS injection code. It is recommended to review your configurations."
    );
  }
  for (const key of bundleKeys) {
    const chunk = bundle[key];
    if (chunk === undefined || chunk.type === "asset") {
      continue;
    }
    const importedCss = importedCssOf(chunk);
    if (!importedCss || importedCss.size === 0) {
      continue;
    }
    const chunkStyles = chunksWithCss[key] || [];
    chunkStyles.push(...importedCss.values());
    chunksWithCss[key] = chunkStyles;
  }
  return chunksWithCss;
}

function buildOutputChunkWithCssInjectionCode(
  jsAssetCode: string,
  cssInjectionCode: string,
  topExecutionPriorityFlag: boolean
): string {
  const appCode = jsAssetCode.replace(/\/\*\s*empty css\s*\*\//g, "");
  jsAssetCode = topExecutionPriorityFlag ? "" : appCode;
  jsAssetCode += cssInjectionCode;
  jsAssetCode += !topExecutionPriorityFlag ? "" : appCode;
  return jsAssetCode;
}

function clearImportedCssViteMetadataFromBundle(
  bundle: Rollup.OutputBundle,
  unusedCssAssets: string[]
): void {
  // Required to exclude removed files from manifest.json
  for (const key in bundle) {
    const chunk = bundle[key];
    if (chunk === undefined || chunk.type !== "chunk") {
      continue;
    }
    const meta = (chunk as ChunkWithCssMeta).viteMetadata;
    if (meta && meta.importedCss.size > 0) {
      meta.importedCss.forEach((importedCssFileName: string) => {
        if (!unusedCssAssets.includes(importedCssFileName)) {
          meta.importedCss = new Set();
        }
      });
    }
  }
}

function removeLinkStyleSheets(html: string, cssFileName: string): string {
  const removeCSS = new RegExp(`<link rel=".*"[^>]*?href=".*/?${cssFileName}"[^>]*?>`);
  return html.replace(removeCSS, "");
}

function isCSSRequest(request: string): boolean {
  const CSS_LANGS_RE = /\.(css|less|sass|scss|styl|stylus|pcss|postcss|sss)(?:$|\?)/;
  return CSS_LANGS_RE.test(request);
}

/* -------------------------------------------------------------------------- */
/* Injection modes                                                            */
/* -------------------------------------------------------------------------- */

function relativeCssInjection(
  bundle: Rollup.OutputBundle,
  assetsWithCss: Record<string, string[]>,
  makeInjection: (css: string) => string
): void {
  for (const [jsAssetName, cssAssets] of Object.entries(assetsWithCss)) {
    const assetCss = concatCssAndDeleteFromBundle(bundle, cssAssets);
    const cssInjectionCode = assetCss.length > 0 ? makeInjection(assetCss) : "";
    const jsAsset = bundle[jsAssetName] as Rollup.OutputChunk;
    jsAsset.code = buildOutputChunkWithCssInjectionCode(
      jsAsset.code,
      cssInjectionCode,
      TOP_EXECUTION_PRIORITY
    );
  }
}

// Reuse CSS across sequential builds for the same entry (e.g. multiple formats).
const globalCSSCodeEntryCache = new Map<string, string>();
let previousFacadeModuleId = "";

function globalCssInjection(
  bundle: Rollup.OutputBundle,
  cssAssets: string[],
  makeInjection: (css: string) => string,
  jsAssetsFilterFunction: ((chunk: Rollup.OutputChunk) => boolean) | undefined
): void {
  const jsTargetBundleKeys = getJsTargetBundleKeys(bundle, jsAssetsFilterFunction);
  if (jsTargetBundleKeys.length == 0) {
    throw new Error(
      "Unable to locate the JavaScript asset for adding the CSS injection code. It is recommended to review your configurations."
    );
  }
  const allCssCode = concatCssAndDeleteFromBundle(bundle, cssAssets);
  let cssInjectionCode = allCssCode.length > 0 ? makeInjection(allCssCode) : "";

  for (const jsTargetKey of jsTargetBundleKeys) {
    const jsAsset = bundle[jsTargetKey] as Rollup.OutputChunk;
    if (jsAsset.facadeModuleId != null && jsAsset.isEntry && cssInjectionCode != "") {
      if (jsAsset.facadeModuleId != previousFacadeModuleId) {
        globalCSSCodeEntryCache.clear();
      }
      previousFacadeModuleId = jsAsset.facadeModuleId;
      globalCSSCodeEntryCache.set(jsAsset.facadeModuleId, cssInjectionCode);
    }
    if (
      cssInjectionCode == "" &&
      jsAsset.isEntry &&
      jsAsset.facadeModuleId != null &&
      typeof globalCSSCodeEntryCache.get(jsAsset.facadeModuleId) == "string"
    ) {
      cssInjectionCode = globalCSSCodeEntryCache.get(jsAsset.facadeModuleId) as string;
    }
    jsAsset.code = buildOutputChunkWithCssInjectionCode(
      jsAsset.code,
      cssInjectionCode,
      TOP_EXECUTION_PRIORITY
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Plugin factory                                                             */
/* -------------------------------------------------------------------------- */

export function cssInjectionPlugins(options: CssInjectionOptions): Plugin[] {
  const { globalVarName, eventName, relative, jsAssetsFilterFunction } = options;
  let config: ResolvedConfig;

  const plugins: Plugin[] = [
    {
      apply: "build",
      enforce: "post",
      name: "vite-plugin-css-position-injection",
      config(c, env) {
        if (env.command === "build" && relative) {
          c.build ??= {};
          if (c.build.cssCodeSplit === false) {
            warnLog(
              "[vite-plugin-css-position] Override of 'build.cssCodeSplit' to true; it must be true when 'lazy' is enabled."
            );
          }
          c.build.cssCodeSplit = true;
        }
      },
      configResolved(resolved) {
        config = resolved;
      },
      generateBundle(_opts, bundle) {
        if (config.build.ssr) {
          return;
        }
        const makeInjection = (css: string) =>
          buildInjectionCode(globalVarName, eventName, JSON.stringify(css.trim()));

        const cssAssets = Object.keys(bundle).filter((i) => {
          const asset = bundle[i];
          return asset !== undefined && asset.type == "asset" && asset.fileName.endsWith(".css");
        });
        let unusedCssAssets: string[] = [];

        if (relative) {
          const assetsWithCss = buildJsCssMap(bundle, jsAssetsFilterFunction);
          relativeCssInjection(bundle, assetsWithCss, makeInjection);
          unusedCssAssets = cssAssets.filter((cssAsset) => !!bundle[cssAsset]);
          if (unusedCssAssets.length > 0) {
            warnLog(
              `[vite-plugin-css-position] Some CSS assets were not included in any known JS: ${unusedCssAssets.join(",")}`
            );
          }
        } else {
          globalCssInjection(bundle, cssAssets, makeInjection, jsAssetsFilterFunction);
        }

        clearImportedCssViteMetadataFromBundle(bundle, unusedCssAssets);

        const htmlFiles = Object.keys(bundle).filter((i) => i.endsWith(".html"));
        for (const name of htmlFiles) {
          const htmlChunk = bundle[name] as Rollup.OutputAsset;
          let replacedHtml =
            htmlChunk.source instanceof Uint8Array
              ? new TextDecoder().decode(htmlChunk.source)
              : `${htmlChunk.source}`;
          cssAssets.forEach((cssName) => {
            if (!unusedCssAssets.includes(cssName)) {
              replacedHtml = removeLinkStyleSheets(replacedHtml, cssName);
              htmlChunk.source = replacedHtml;
            }
          });
        }
      },
    },
  ];

  if (options.enableDev) {
    warnLog("[vite-plugin-css-position] Experimental dev mode activated!");
    plugins.push({
      name: "vite-plugin-css-position-injection-dev",
      apply: "serve",
      enforce: "post",
      transform(src, id) {
        if (!isCSSRequest(id)) {
          return;
        }
        const removeStyleCode = buildRemoveStyleCode(globalVarName, eventName, id);
        const injectCode = buildInjectionCode(globalVarName, eventName, "__vite__css", {
          type: "text/css",
          "data-vite-dev-id": id,
        });
        // removeStyleCode runs first since the inject snippet doesn't handle the
        // dev update case on its own.
        let injectionCode = src.replace(
          "__vite__updateStyle(__vite__id, __vite__css)",
          ";\n" + removeStyleCode + ";\n" + injectCode
        );
        injectionCode = injectionCode.replace("__vite__removeStyle(__vite__id)", removeStyleCode);
        return { code: injectionCode, map: null };
      },
    });
  }

  return plugins;
}
