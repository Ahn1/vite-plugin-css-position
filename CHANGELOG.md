# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.0]

This release rewrites the CSS handling internals and adds a flexible `mode` option,
including a new `cssChunks` mode that keeps Vite's emitted `.css` files instead of
inlining CSS into JavaScript.

> **Migration:** Upgrading from `2.0.9` requires no code changes — the default
> behavior (`mode: "inject"`) is identical to before.

### Added

- **`mode` option** controlling how CSS is delivered and registered:
  - `"inject"` (default) — all CSS is concatenated and inlined into the entry JS
    and rendered as `<style>`. Same behavior as `2.0.9`.
  - `"injectPerChunk"` — each chunk's CSS is inlined into its own JS chunk, enabling
    **component-level granular lazy-loading**: a code-split component's styles only
    reach the `StylesTarget` position once the component loads.
  - `"cssChunks"` — keeps Vite's emitted, cacheable `.css` chunk files; each chunk
    registers only its CSS file URL, which `StylesTarget` includes at its position.
    The plugin suppresses Vite's default `<head>` injection. Benefits: HTTP-cacheable
    CSS, leaner JS bundles, and CSP-friendliness.
- **`cssChunksStrategy` option** (`"link"` | `"adopt"`, only valid with
  `mode: "cssChunks"`):
  - `"link"` (default) — renders `<link rel="stylesheet">`.
  - `"adopt"` — fetches the CSS and applies it via `adoptedStyleSheets` (no FOUC,
    deduped across shadow roots, CSP-ideal; requires `fetch` and modern browsers).

### Changed

- The CSS-by-JS injection is now **built in** (vendored and trimmed from
  `vite-plugin-css-injected-by-js`, MIT, by Marco Prontera) instead of being a
  runtime dependency. The injected snippet is generated directly and IIFE-wrapped;
  it is no longer transpiled to `build.target` (negligible for modern browsers).

[3.0.0]: https://github.com/Ahn1/vite-plugin-css-position/compare/v2.0.9...v3.0.0
[2.0.9]: https://github.com/Ahn1/vite-plugin-css-position/releases/tag/v2.0.9
