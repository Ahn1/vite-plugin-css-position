// @vitest-environment happy-dom
/**
 * Component tests for the React StylesTarget.
 *
 * In a real app Vite's `define` replaces the __VITE_CSS_POS_* constants at
 * build time. Here they stay bare identifiers, so we provide them as globals
 * before (re-)importing the component — which also lets us switch the link
 * strategy per test via vi.resetModules().
 */
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { StylesMap } from "../src/StylesTarget.types";

const GLOBAL_VAR = "__vcssp_c_test";
const EVENT = "__vcssp_e_test";

type AnyGlobal = Record<string, unknown>;

async function loadStylesTarget(strategy: "link" | "adopt" = "link") {
  (globalThis as AnyGlobal)["__VITE_CSS_POS_GLOBAL_VAR_NAME__"] = GLOBAL_VAR;
  (globalThis as AnyGlobal)["__VITE_CSS_POS_EVENT_NAME__"] = EVENT;
  (globalThis as AnyGlobal)["__VITE_CSS_POS_LINK_STRATEGY__"] = strategy;
  vi.resetModules();
  return (await import("../src/StylesTargetReact")).default;
}

function getMap(): StylesMap {
  const g = window as unknown as AnyGlobal;
  g[GLOBAL_VAR] = g[GLOBAL_VAR] || new Map();
  return g[GLOBAL_VAR] as StylesMap;
}

function registerStyle(id: string, css: string, attributes: Record<string, string> = {}) {
  getMap().set(id, { type: "style", css, attributes });
  window.dispatchEvent(new Event(EVENT));
}

function registerLink(id: string, href: string) {
  getMap().set(id, { type: "link", href, attributes: {} });
  window.dispatchEvent(new Event(EVENT));
}

beforeEach(() => {
  delete (window as unknown as AnyGlobal)[GLOBAL_VAR];
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("StylesTarget (React)", () => {
  test("renders styles that were registered before mount", async () => {
    const StylesTarget = await loadStylesTarget();
    getMap().set("a", { type: "style", css: ".pre { color: red; }", attributes: {} });

    const { container } = render(<StylesTarget />);
    const style = container.querySelector("style");
    expect(style).not.toBeNull();
    expect(style!.textContent).toBe(".pre { color: red; }");
  });

  test("renders styles registered after mount via the update event", async () => {
    const StylesTarget = await loadStylesTarget();
    const { container } = render(<StylesTarget />);
    expect(container.querySelector("style")).toBeNull();

    act(() => {
      registerStyle("a", ".later { color: blue; }");
    });
    expect(container.querySelector("style")!.textContent).toBe(".later { color: blue; }");
  });

  test("applies registered attributes to the style element", async () => {
    const StylesTarget = await loadStylesTarget();
    const { container } = render(<StylesTarget />);

    act(() => {
      registerStyle("a", ".x{}", { "data-vite-dev-id": "/src/style.css" });
    });
    const style = container.querySelector("style")!;
    expect(style.getAttribute("data-vite-dev-id")).toBe("/src/style.css");
  });

  test("removes a style when it is deleted and the event fires again (HMR)", async () => {
    const StylesTarget = await loadStylesTarget();
    const { container } = render(<StylesTarget />);

    act(() => {
      registerStyle("a", ".gone {}");
    });
    expect(container.querySelectorAll("style")).toHaveLength(1);

    act(() => {
      getMap().delete("a");
      window.dispatchEvent(new Event(EVENT));
    });
    expect(container.querySelectorAll("style")).toHaveLength(0);
  });

  test("calls onChange with the current styles map", async () => {
    const StylesTarget = await loadStylesTarget();
    const onChange = vi.fn();
    render(<StylesTarget onChange={onChange} />);
    // Called once on mount with the initial map.
    expect(onChange).toHaveBeenCalledTimes(1);

    act(() => {
      registerStyle("a", ".x {}");
    });
    expect(onChange).toHaveBeenCalledTimes(2);
    const lastMap = onChange.mock.calls.at(-1)![0] as StylesMap;
    expect(lastMap.get("a")).toMatchObject({ css: ".x {}" });
  });

  test("stops listening after unmount", async () => {
    const StylesTarget = await loadStylesTarget();
    const onChange = vi.fn();
    const { unmount } = render(<StylesTarget onChange={onChange} />);
    unmount();
    const calls = onChange.mock.calls.length;

    act(() => {
      registerStyle("a", ".x {}");
    });
    expect(onChange).toHaveBeenCalledTimes(calls);
  });

  test('renders link entries as <link rel="stylesheet"> (strategy "link")', async () => {
    const StylesTarget = await loadStylesTarget("link");
    const { container } = render(<StylesTarget />);

    act(() => {
      registerLink("a", "https://example.test/assets/chunk.css");
    });
    const link = container.querySelector("link")!;
    expect(link).not.toBeNull();
    expect(link.getAttribute("rel")).toBe("stylesheet");
    expect(link.getAttribute("href")).toBe("https://example.test/assets/chunk.css");
  });

  test("renders style and link entries side by side", async () => {
    const StylesTarget = await loadStylesTarget("link");
    const { container } = render(<StylesTarget />);

    act(() => {
      registerStyle("s", ".inline {}");
      registerLink("l", "/assets/chunk.css");
    });
    expect(container.querySelectorAll("style")).toHaveLength(1);
    expect(container.querySelectorAll("link")).toHaveLength(1);
  });
});

describe('StylesTarget (React, strategy "adopt")', () => {
  test("does not render <link> elements and fetches the CSS instead", async () => {
    const fetchMock = vi.fn(async () => ({ text: async () => ".adopted { color: green; }" }));
    vi.stubGlobal("fetch", fetchMock);

    const StylesTarget = await loadStylesTarget("adopt");
    const { container } = render(<StylesTarget />);

    await act(async () => {
      registerLink("a", "https://example.test/assets/chunk.css");
    });

    expect(container.querySelector("link")).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith("https://example.test/assets/chunk.css");
  });

  test("adopts the fetched stylesheet on the containing root exactly once", async () => {
    const fetchMock = vi.fn(async () => ({ text: async () => ".adopted { color: green; }" }));
    vi.stubGlobal("fetch", fetchMock);

    const StylesTarget = await loadStylesTarget("adopt");
    document.adoptedStyleSheets = [];
    render(<StylesTarget />);

    await act(async () => {
      registerLink("a", "https://example.test/assets/chunk.css");
    });
    expect(document.adoptedStyleSheets).toHaveLength(1);

    // A second update must not fetch or adopt the same href again.
    await act(async () => {
      registerLink("b", "https://example.test/assets/chunk.css");
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(document.adoptedStyleSheets).toHaveLength(1);
  });
});
