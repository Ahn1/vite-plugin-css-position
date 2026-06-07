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
  plugins: [react(), /* or vue(), */ viteCssPosition({ cssPerChunk: true })],
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
  cssPerChunk: true,
});
```

### Options

- **`instanceId`** - A custom identifier for the plugin instance. Useful when you have multiple instances or need to avoid conflicts. Defaults to a random UUID.
- **`enableDev`** - When `true`, enables CSS injection during development mode. Defaults to `false`. Enable this for HMR support
- **`cssPerChunk`** - When `true`, each chunk's CSS is injected relative to that chunk instead of being bundled into the entry. This enables **component-level granular lazy-loading**: a code-split component's styles are only injected at the `StylesTarget` position when the component is actually loaded. Defaults to `false` (all CSS is injected up front — the previous behavior, fully backward compatible). Requires `build.cssCodeSplit` (Vite's default; it is forced on when `cssPerChunk` is enabled).
- **`jsAssetsFilterFunction`** - Filter function `(chunk) => boolean` to control which JS output chunk(s) receive the CSS injection code. Useful with multiple entry points.

### Lazy-loading styles for code-split components

With `cssPerChunk: true`, styles imported by a dynamically imported component are placed in that
component's own chunk. When the component is loaded, its CSS is injected at the `StylesTarget`
position — perfect for Shadow-DOM micro frontends that should not ship all CSS up front:

```tsx
import { Suspense, lazy } from "react";
import StylesTarget from "vite-plugin-css-position/react";

const Chart = lazy(() => import("./Chart")); // Chart imports its own ./chart.css

export function App() {
  return (
    <div>
      <StylesTarget />
      <Suspense fallback={null}>
        <Chart /> {/* chart.css is injected only once this loads */}
      </Suspense>
    </div>
  );
}
```

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
