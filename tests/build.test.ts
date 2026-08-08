// @vitest-environment node
/**
 * Integration tests: run real Vite builds against the fixture project in
 * tests/fixtures/basic and assert on the produced bundle for every mode.
 */
import { fileURLToPath } from "node:url";
import { build, createServer, type Rollup } from "vite";
import { describe, expect, test } from "vitest";
import viteCssPosition, {
  type ViteCustomCssPositionOptions,
} from "../src/viteCustomCssPosition";

const fixtureRoot = fileURLToPath(new URL("./fixtures/basic", import.meta.url));

const ENTRY_CSS_MARKER = ".entry-style-marker";
const LAZY_CSS_MARKER = ".lazy-style-marker";

async function buildFixture(options: ViteCustomCssPositionOptions) {
  const result = await build({
    root: fixtureRoot,
    logLevel: "silent",
    configFile: false,
    plugins: [viteCssPosition({ instanceId: "test", ...options })],
    build: { write: false, minify: false },
  });
  const { output } = result as Rollup.RollupOutput;

  const chunks = output.filter((o): o is Rollup.OutputChunk => o.type === "chunk");
  const entry = chunks.find((c) => c.isEntry);
  const lazy = chunks.find((c) => !c.isEntry && c.fileName.includes("lazy"));
  const cssAssets = output.filter(
    (o): o is Rollup.OutputAsset => o.type === "asset" && o.fileName.endsWith(".css")
  );
  const htmlAsset = output.find(
    (o): o is Rollup.OutputAsset => o.type === "asset" && o.fileName.endsWith(".html")
  );
  const html = String(htmlAsset?.source ?? "");
  if (!entry) throw new Error("no entry chunk in build output");
  return { output, entry, lazy, cssAssets, html };
}

describe("mode: inject (default)", () => {
  test("inlines all CSS into the entry chunk and removes CSS assets", async () => {
    const { entry, lazy, cssAssets, html } = await buildFixture({});

    // No .css files remain in the bundle.
    expect(cssAssets).toHaveLength(0);

    // All CSS (entry + lazy) is registered from the entry chunk.
    expect(entry.code).toContain("window.__vcssp_c_test");
    expect(entry.code).toContain("__vcssp_e_test");
    expect(entry.code).toContain(ENTRY_CSS_MARKER);
    expect(entry.code).toContain(LAZY_CSS_MARKER);
    expect(lazy?.code ?? "").not.toContain(LAZY_CSS_MARKER);

    // Vite's stylesheet <link> is stripped from the HTML.
    expect(html).not.toContain('rel="stylesheet"');
  });

  test("injection code runs before the app code (top execution priority)", async () => {
    const { entry } = await buildFixture({});
    const injectionPos = entry.code.indexOf("window.__vcssp_c_test");
    const appPos = entry.code.indexOf('textContent = "main"');
    expect(injectionPos).toBeGreaterThanOrEqual(0);
    expect(appPos).toBeGreaterThan(injectionPos);
  });
});

describe("mode: injectPerChunk", () => {
  test("inlines each chunk's CSS into that chunk", async () => {
    const { entry, lazy, cssAssets, html } = await buildFixture({
      mode: "injectPerChunk",
    });

    expect(cssAssets).toHaveLength(0);

    // Entry only carries its own CSS…
    expect(entry.code).toContain(ENTRY_CSS_MARKER);
    expect(entry.code).not.toContain(LAZY_CSS_MARKER);

    // …the lazy chunk carries (and registers) its own.
    expect(lazy).toBeDefined();
    expect(lazy!.code).toContain(LAZY_CSS_MARKER);
    expect(lazy!.code).toContain("window.__vcssp_c_test");

    expect(html).not.toContain('rel="stylesheet"');
  });

  test("forces build.cssCodeSplit back on when the user disabled it", async () => {
    const result = await build({
      root: fixtureRoot,
      logLevel: "silent",
      configFile: false,
      plugins: [viteCssPosition({ instanceId: "test", mode: "injectPerChunk" })],
      build: { write: false, minify: false, cssCodeSplit: false },
    });
    const { output } = result as Rollup.RollupOutput;
    const lazy = output.find(
      (o): o is Rollup.OutputChunk => o.type === "chunk" && o.fileName.includes("lazy")
    );
    // With cssCodeSplit=false the lazy CSS would end up in a single global file;
    // per-chunk injection requires it inlined into the lazy chunk instead.
    expect(lazy?.code).toContain(LAZY_CSS_MARKER);
  });
});

describe("mode: cssChunks", () => {
  test("keeps CSS files and registers their URLs per chunk", async () => {
    const { entry, lazy, cssAssets, html } = await buildFixture({ mode: "cssChunks" });

    // Both CSS files stay in the bundle as cacheable assets.
    expect(cssAssets).toHaveLength(2);
    const sources = cssAssets.map((a) => String(a.source)).join("\n");
    expect(sources).toContain(ENTRY_CSS_MARKER);
    expect(sources).toContain(LAZY_CSS_MARKER);

    // No CSS is inlined into JS; instead link registrations are appended.
    expect(entry.code).not.toContain(ENTRY_CSS_MARKER);
    expect(entry.code).toContain('type:"link"');
    expect(entry.code).toContain("new URL(");
    expect(entry.code).toContain("window.__vcssp_c_test");
    expect(lazy!.code).toContain('type:"link"');

    // The render-blocking <link> is removed; StylesTarget takes over.
    expect(html).not.toContain('rel="stylesheet"');
  });

  test("strips CSS deps from the preload helper so Vite doesn't inject them into <head>", async () => {
    const { entry } = await buildFixture({ mode: "cssChunks" });

    // Locate Vite's asset array (m.f=[...]) and determine the CSS indices.
    const arrMatch = entry.code.match(/m\.f=\[([^\]]*)\]/);
    expect(arrMatch).not.toBeNull();
    const files = [...arrMatch![1]!.matchAll(/"([^"]*)"/g)].map((m) => m[1]!);
    const cssIndices = new Set(
      files.flatMap((f, i) => (f.endsWith(".css") ? [i] : []))
    );
    expect(cssIndices.size).toBeGreaterThan(0);

    // No __vite__mapDeps call may still reference a CSS index.
    const calls = [...entry.code.matchAll(/__vite__mapDeps\(\[([^\]]*)\]\)/g)];
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      const indices = call[1]!
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s !== "")
        .map(Number);
      for (const idx of indices) {
        expect(cssIndices.has(idx)).toBe(false);
      }
    }
  });

  test("registered URLs resolve relative to the importing chunk", async () => {
    const { lazy } = await buildFixture({ mode: "cssChunks" });
    // Both chunk and CSS live in assets/, so the relative path is ./<file>.css
    expect(lazy!.code).toMatch(/\[\["[0-9a-f]{12}","\.\/[^"]+\.css"\]\]/);
  });

  test("keeps the manifest entries for CSS files intact", async () => {
    const result = await build({
      root: fixtureRoot,
      logLevel: "silent",
      configFile: false,
      plugins: [viteCssPosition({ instanceId: "test", mode: "cssChunks" })],
      build: { write: false, minify: false, manifest: true },
    });
    const { output } = result as Rollup.RollupOutput;
    const manifestAsset = output.find(
      (o): o is Rollup.OutputAsset =>
        o.type === "asset" && o.fileName === ".vite/manifest.json"
    );
    expect(manifestAsset).toBeDefined();
    const manifest = JSON.parse(String(manifestAsset!.source)) as Record<
      string,
      { css?: string[] }
    >;
    const entryManifest = manifest["index.html"];
    expect(entryManifest?.css?.length).toBe(1);
  });
});

describe("options", () => {
  test("jsAssetsFilterFunction picks the chunk receiving the injection code", async () => {
    const { entry, lazy } = await buildFixture({
      mode: "injectPerChunk",
      jsAssetsFilterFunction: (chunk) => chunk.isEntry,
    });
    expect(entry.code).toContain(ENTRY_CSS_MARKER);
    // Lazy chunk was filtered out — it must not register anything.
    expect(lazy!.code).not.toContain("window.__vcssp_c_test");
  });

  test("instanceId determines the global variable and event names", async () => {
    const { entry } = await buildFixture({ instanceId: "custom42" });
    expect(entry.code).toContain("window.__vcssp_c_custom42");
    expect(entry.code).toContain("__vcssp_e_custom42");
  });
});

describe("dev mode (enableDev)", () => {
  test("rewrites CSS modules served by the dev server to register instead of inject", async () => {
    const server = await createServer({
      root: fixtureRoot,
      logLevel: "silent",
      configFile: false,
      plugins: [viteCssPosition({ instanceId: "test", enableDev: true })],
      server: { middlewareMode: true },
      optimizeDeps: { noDiscovery: true },
    });
    try {
      const result = await server.transformRequest("/src/style.css");
      expect(result?.code).toContain("window.__vcssp_c_test");
      expect(result?.code).toContain("__vcssp_e_test");
      // The default style injection must be replaced, not duplicated.
      expect(result?.code).not.toContain("__vite__updateStyle(__vite__id, __vite__css)");
    } finally {
      await server.close();
    }
  });

  test("without enableDev the dev transform is not applied", async () => {
    const server = await createServer({
      root: fixtureRoot,
      logLevel: "silent",
      configFile: false,
      plugins: [viteCssPosition({ instanceId: "test" })],
      server: { middlewareMode: true },
      optimizeDeps: { noDiscovery: true },
    });
    try {
      const result = await server.transformRequest("/src/style.css");
      expect(result?.code).not.toContain("window.__vcssp_c_test");
    } finally {
      await server.close();
    }
  });
});
