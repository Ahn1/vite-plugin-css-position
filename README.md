[![npm version](https://img.shields.io/npm/v/vite-plugin-css-position)](https://www.npmjs.com/package/vite-plugin-css-position)
[![npm version](https://img.shields.io/npm/dm/vite-plugin-css-position)](https://www.npmjs.com/package/vite-plugin-css-position)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A Vite plugin that allows you to control where CSS stylesheets are injected in your React or Vue application. Perfect for scenarios where you need precise control over style placement, especially when working with Shadow DOM.

## Features

- **Custom CSS positioning** - Place stylesheets exactly where you need them in your component tree
- **Shadow DOM support** - Ideal for Shadow DOM implementations where styles need to be scoped
- **Component-level lazy-loading** - Optionally inject each (code-split) component's CSS only when it loads
- **Development mode** - Optional hot module replacement support

## Installation

```bash
npm install vite-plugin-css-position
```

or

```bash
pnpm add vite-plugin-css-position
```

or

```bash
yarn add vite-plugin-css-position
```

## Quick Start

### 1. Configure Vite

Add the plugin to your `vite.config.ts`:

```typescript
...
import { viteCssPosition } from "vite-plugin-css-position";

export default defineConfig({
  plugins: [react(), /* or vue(), */ viteCssPosition({ mode: "injectPerChunk" /* or cssChunks */ })],
});
```

### 2. Use StylesTarget Component

Import and place the `StylesTarget` component where you want your styles to be injected:

#### In React

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

#### In Vue

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

Your stylesheets will now be injected at the position of the `<StylesTarget />` component.

## Configuration

The plugin accepts optional configuration:

```typescript
viteCssPosition({
  enableDev: true,
  mode: "cssChunks",
});
```

### Options

- **`instanceId`** - A custom identifier for the plugin instance. Useful when you have multiple instances or need to avoid conflicts. Defaults to a random UUID.
- **`enableDev`** - When `true`, enables CSS injection during development mode. Defaults to `false`. Enable this for HMR support.
- **`mode`** - How CSS is delivered and registered. Defaults to `"inject"`. See [Modes](#modes) below.
- **`cssChunksStrategy`** - Only used when `mode: "cssChunks"`. `"link"` (default) renders `<link rel="stylesheet">`; `"adopt"` fetches the CSS and applies it via `adoptedStyleSheets`. See [Modes](#modes).
- **`jsAssetsFilterFunction`** - Filter function `(chunk) => boolean` to control which JS output chunk(s) receive the CSS injection code. Useful with multiple entry points.

### Modes

`mode` controls how stylesheets reach the `StylesTarget` position:

| `mode`                 | CSS delivery                         | Rendered as                     | Lazy-loading               |
| ---------------------- | ------------------------------------ | ------------------------------- | -------------------------- |
| `"inject"` _(default)_ | all CSS inlined into the entry JS    | `<style>`                       | no — loaded up front       |
| `"injectPerChunk"`     | each chunk's CSS inlined into its JS | `<style>`                       | yes — per code-split chunk |
| `"cssChunks"`          | Vite's emitted `.css` files are kept | `<link>` / `adoptedStyleSheets` | yes — per code-split chunk |

`"inject"` is the original behavior and fully backward compatible. The per-chunk modes require
`build.cssCodeSplit` (Vite's default; forced on automatically).

**`mode` only affects the production build.** In dev (`enableDev: true`) CSS is always injected
per-module for HMR.

#### Component-level lazy-loading (`injectPerChunk` / `cssChunks`)

With a per-chunk mode, styles imported by a dynamically imported component live with that
component's chunk and only reach the `StylesTarget` position once the component loads — ideal for
Shadow-DOM micro frontends that should not ship all CSS up front:

```tsx
import { Suspense, lazy } from "react";
import StylesTarget from "vite-plugin-css-position/react";

const Chart = lazy(() => import("./Chart")); // Chart imports its own ./chart.css

export function App() {
  return (
    <div>
      <StylesTarget />
      <Suspense fallback={null}>
        <Chart /> {/* chart.css is included only once this loads */}
      </Suspense>
    </div>
  );
}
```

#### `cssChunks` mode — keep Vite's CSS files

`mode: "cssChunks"` keeps Vite's normal, cacheable `.css` chunk files instead of inlining CSS into
JavaScript, and only registers each chunk's CSS **URL**. `StylesTarget` then includes it at its
position (and the plugin suppresses Vite's default `<head>` injection). Benefits: HTTP-cacheable CSS,
leaner JS bundles, and CSP-friendliness (no inline styles).

The `cssChunksStrategy` option chooses how the CSS is included:

- **`"link"`** (default) — renders `<link rel="stylesheet">`. Simplest, but note that a `<link>`
  inside a Shadow DOM is _not_ render-blocking, so a brief flash of unstyled content (FOUC) is
  possible while it loads.
- **`"adopt"`** — fetches the CSS file and applies it via
  [`adoptedStyleSheets`](https://developer.mozilla.org/en-US/docs/Web/API/Document/adoptedStyleSheets).
  No FOUC, deduplicated across multiple shadow roots, and CSP-ideal. Requires `fetch` and a modern
  browser (Chrome 73+ / Firefox 101+ / Safari 16.4+);

## Development

```bash
# Install dependencies
npm install

# Run the playground
npm run play

# Build the library
npm run build
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
