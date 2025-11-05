[![npm version](https://img.shields.io/npm/v/vite-plugin-css-position)](https://www.npmjs.com/package/vite-plugin-css-position)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A Vite plugin that allows you to control where CSS stylesheets are injected in your React or Vue application. Perfect for scenarios where you need precise control over style placement, especially when working with Shadow DOM.

## ✨ Features

- 🎯 **Custom CSS positioning** - Place stylesheets exactly where you need them in your component tree
- 🌗 **Shadow DOM support** - Ideal for Shadow DOM implementations where styles need to be scoped
- 🚀 **Development mode** - Optional hot module replacement support

## 📦 Installation

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

## 🚀 Quick Start

### 1. Configure Vite

Add the plugin to your `vite.config.ts`:

```typescript
...
import { viteCssPosition } from "vite-plugin-css-position";

export default defineConfig({
  plugins: [react(), /* or vue(), */ viteCssPosition()],
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

That's it! Your stylesheets will now be injected at the position of the `<StylesTarget />` component.

## ⚙️ Configuration

The plugin accepts optional configuration:

```typescript
viteCssPosition({
  enableDev: true,
});
```

### Options

- **`instanceId`** - A custom identifier for the plugin instance. Useful when you have multiple instances or need to avoid conflicts. Defaults to a random UUID.
- **`enableDev`** - When `true`, enables CSS injection during development mode. Defaults to `false`. Enable this for HMR support

## 🛠️ Development

```bash
# Install dependencies
npm install

# Run the playground
npm run play

# Build the library
npm run build

# Run tests
npm test

# Type check
npm run typecheck
```

## 📝 License

MIT © [Alexander Bogoslawski](https://github.com/Ahn1)

## 🔗 Links

- [GitHub Repository](https://github.com/Ahn1/vite-plugin-css-position)
- [Issue Tracker](https://github.com/Ahn1/vite-plugin-css-position/issues)
- [npm Package](https://www.npmjs.com/package/vite-plugin-css-position)
