# vite-plugin-css-position

[![npm version](https://img.shields.io/npm/v/vite-plugin-css-position)](https://www.npmjs.com/package/vite-plugin-css-position)
[![npm version](https://img.shields.io/npm/dm/vite-plugin-css-position)](https://www.npmjs.com/package/vite-plugin-css-position)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Control **where** your Vite app's CSS ends up — instead of `<head>`, styles are rendered exactly at the position of a `<StylesTarget />` component in your React or Vue tree.

## Why?

Vite normally injects all stylesheets into `document.head`. That breaks down when:

- your app renders inside a **Shadow DOM** (styles in `<head>` don't reach it),
- you build **micro-frontends / widgets** that must not leak styles into the host page,
- you simply need styles scoped to a specific part of the DOM.

This plugin intercepts Vite's CSS output and hands it to a `<StylesTarget />` component that you place wherever the styles should live.

## How it works

1. The **Vite plugin** rewrites the build so each chunk *registers* its CSS (inlined string or file URL) in a global map and fires an event — nothing touches `<head>`.
2. The **`<StylesTarget />` component** (React or Vue) listens for that event and renders the registered styles at its own position — including inside a shadow root.

## Quick Start

```bash
npm install vite-plugin-css-position
```

**1. Add the plugin** to your `vite.config.ts`:

```typescript
import { viteCssPosition } from "vite-plugin-css-position";

export default defineConfig({
  plugins: [react(), /* or vue(), */ viteCssPosition()],
});
```

**2. Place `<StylesTarget />`** where the styles should be rendered:

<table>
<tr><th>React</th><th>Vue</th></tr>
<tr>
<td>

```tsx
import StylesTarget from "vite-plugin-css-position/react";

export function App() {
  return (
    <div>
      <StylesTarget />
      <span>Your App Content</span>
    </div>
  );
}
```

</td>
<td>

```vue
<script setup lang="ts">
import StylesTarget from "vite-plugin-css-position/vue";
</script>

<template>
  <div>
    <StylesTarget />
  </div>
</template>
```

</td>
</tr>
</table>

That's it — a production build now renders all stylesheets at the `<StylesTarget />` position.

> **Note:** By default the plugin only affects **production builds**. For dev-server/HMR support see [Development mode](#development-mode-hmr).

## Choosing a mode

The `mode` option controls how CSS is delivered. Rule of thumb:

- **Just want it to work like v2?** Use the default `"inject"`.
- **Large app with code splitting?** Use `"injectPerChunk"` — lazy components bring their CSS along only when loaded.
- **Want real, cacheable `.css` files (CSP, caching, lean JS)?** Use `"cssChunks"`.

| | `"inject"` *(default)* | `"injectPerChunk"` | `"cssChunks"` |
| --- | --- | --- | --- |
| CSS delivery | all CSS inlined into the entry JS | each chunk's CSS inlined into its JS | Vite's emitted `.css` files are kept |
| Rendered as | `<style>` | `<style>` | `<link>` or `adoptedStyleSheets` |
| Lazy-loading | no — all CSS up front | yes — per code-split chunk | yes — per code-split chunk |
| Separate `.css` files (cacheable) | no | no | yes |
| JS bundle size | largest | large | smallest |

```typescript
viteCssPosition({ mode: "injectPerChunk" }); // or "cssChunks"
```

The per-chunk modes require `build.cssCodeSplit` (Vite's default; forced on automatically).

### `mode: "cssChunks"` — link vs. adopt

In `cssChunks` mode the `cssChunksStrategy` option chooses how `StylesTarget` includes the CSS files:

- **`"link"`** *(default)* — renders `<link rel="stylesheet">`. Simplest, but a `<link>` inside a Shadow DOM is *not* render-blocking, so a brief flash of unstyled content (FOUC) is possible while it loads.
- **`"adopt"`** — fetches the CSS file and applies it via [`adoptedStyleSheets`](https://developer.mozilla.org/en-US/docs/Web/API/Document/adoptedStyleSheets). No FOUC, deduplicated across multiple shadow roots, and CSP-ideal. Requires `fetch` and a modern browser (Chrome 73+ / Firefox 101+ / Safari 16.4+).

```typescript
viteCssPosition({ mode: "cssChunks", cssChunksStrategy: "adopt" });
```

## Options

```typescript
viteCssPosition({
  mode: "cssChunks",
  cssChunksStrategy: "adopt",
  enableDev: true,
});
```

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `mode` | `"inject"` \| `"injectPerChunk"` \| `"cssChunks"` | `"inject"` | How CSS is delivered. See [Choosing a mode](#choosing-a-mode). |
| `cssChunksStrategy` | `"link"` \| `"adopt"` | `"link"` | Only with `mode: "cssChunks"`: how CSS files are included. See [link vs. adopt](#mode-csschunks--link-vs-adopt). |
| `enableDev` | `boolean` | `false` | Enable CSS handling in the dev server (HMR). See [Development mode](#development-mode-hmr). |
| `instanceId` | `string` | random | Identifier for this plugin instance. Set it when running multiple instances side by side to avoid conflicts. |
| `jsAssetsFilterFunction` | `(chunk) => boolean` | entry chunks | Which JS output chunk(s) receive the CSS injection code. Useful with multiple entry points. |

## Development mode (HMR)

`mode` only affects the production build. In the dev server, CSS is injected per module for HMR — but only if you opt in:

```typescript
viteCssPosition({ enableDev: true });
```

Without `enableDev`, the dev server behaves like plain Vite (styles in `<head>`).

## Migrating from v2 to v3

No code changes required — the default `mode: "inject"` behaves exactly like `2.0.9`.

What's new in `3.0.0`:

- New **`mode`** option: `"injectPerChunk"` and `"cssChunks"` add component-level lazy-loading; `"cssChunks"` keeps Vite's emitted `.css` files (see [Choosing a mode](#choosing-a-mode)).
- **Zero runtime dependencies** — the CSS-by-JS injection is now built in.

See the [CHANGELOG](./CHANGELOG.md) for details.

## Requirements

- Vite 5, 6, or 7
- Node.js ≥ 20.12
- React 18/19 or Vue 3 (for the bundled `StylesTarget` components)

## Development

```bash
# Install dependencies
pnpm install

# Run the playground
pnpm run play

# Run the tests
pnpm test

# Build the library
pnpm run build
```

## Credits

The built-in CSS-by-JS injection is a trimmed, vendored port of
[`vite-plugin-css-injected-by-js`](https://github.com/marco-prontera/vite-plugin-css-injected-by-js)
by Marco Prontera (MIT License).

## License

MIT © [Alexander Bogoslawski](https://github.com/Ahn1)

## Links

- [GitHub Repository](https://github.com/Ahn1/vite-plugin-css-position)
- [Issue Tracker](https://github.com/Ahn1/vite-plugin-css-position/issues)
- [npm Package](https://www.npmjs.com/package/vite-plugin-css-position)
