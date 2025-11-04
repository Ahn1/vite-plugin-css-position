# vite-plugin-react-css-position

Include the Stylesheets of your Vite-React-App on a custom position. This can be especially useful when using a Shadow DOM.

## Usage

### Install the package

```bash
npm install vite-plugin-react-css-position
```

### Update the Vite config

```TS
import { viteReactCssPosition } from "vite-plugin-react-css-position";

export default defineConfig({
  plugins: [viteReactCssPosition(), react()],
});
```

### Include CSS on Custom Position

```JS
import StylesTarget from "vite-plugin-react-css-position/StylesTarget";

export function App() {
  return (
    <div>
      <StylesTarget />
      <span>Your App</span>
    </div>
  );
}
```

## Development

- Install dependencies:

```bash
npm install
```

- Run the playground:

```bash
npm run play
```

- Build the library:

```bash
npm run build
```
