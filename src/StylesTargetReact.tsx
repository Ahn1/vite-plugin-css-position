import { useEffect, useRef, useState } from "react";
import type { StyleEntry, StylesMap, StylesTargetProps } from "./StylesTarget.types";
import { isLinkEntry } from "./StylesTarget.types";

declare const __VITE_CSS_POS_GLOBAL_VAR_NAME__: string;
declare const __VITE_CSS_POS_EVENT_NAME__: string;
declare const __VITE_CSS_POS_LINK_STRATEGY__: "link" | "adopt";

const globalVarName = __VITE_CSS_POS_GLOBAL_VAR_NAME__;
const eventName = __VITE_CSS_POS_EVENT_NAME__;
const linkStrategy = __VITE_CSS_POS_LINK_STRATEGY__;

const getCurrent = (): StylesMap | undefined => (window as any)[globalVarName];

type LinkEntry = Extract<StyleEntry, { type: "link" }>;

// Module-level cache: one fetch + parse per CSS file, shared across all
// StylesTarget instances — adoptedStyleSheets is designed to share the same
// sheet object between multiple (shadow) roots. Caching the promise (not the
// sheet) also prevents duplicate fetches when events fire in quick succession.
const sheetCache = new Map<string, Promise<CSSStyleSheet>>();

function loadSheet(href: string): Promise<CSSStyleSheet> {
  let promise = sheetCache.get(href);
  if (!promise) {
    promise = fetch(href)
      .then((response) => response.text())
      .then(async (css) => {
        const sheet = new CSSStyleSheet();
        await sheet.replace(css);
        return sheet;
      });
    // Drop failed loads so a later update can retry them.
    promise.catch(() => sheetCache.delete(href));
    sheetCache.set(href, promise);
  }
  return promise;
}

const StylesTarget = (props: StylesTargetProps) => {
  const [stylesMap, setStylesMap] = useState<StylesMap>(getCurrent() || new Map());
  const [version, setVersion] = useState(0);

  const anchorRef = useRef<HTMLSpanElement>(null);

  // Keep the latest onChange in a ref so the event listener can stay
  // registered once for the component's lifetime — re-subscribing on every
  // parent render (inline callbacks!) would force a full extra update each time.
  const onChangeRef = useRef(props.onChange);
  onChangeRef.current = props.onChange;

  useEffect(() => {
    const updateListener = () => {
      const newValues = getCurrent() || new Map();
      setStylesMap(newValues);
      setVersion((v) => v + 1);
      onChangeRef.current?.(newValues);
    };
    window.addEventListener(eventName, updateListener);
    updateListener();
    return () => {
      window.removeEventListener(eventName, updateListener);
    };
  }, []);

  const entries = Array.from(stylesMap?.entries() || []);

  // `cssChunks` + "adopt": fetch each CSS file and apply it to the containing
  // (shadow) root via adoptedStyleSheets — no FOUC, deduped across roots.
  useEffect(() => {
    if (linkStrategy !== "adopt") return;
    const anchor = anchorRef.current;
    if (!anchor) return;
    const root = anchor.getRootNode() as ShadowRoot;
    if (!("adoptedStyleSheets" in root)) return;

    let cancelled = false;
    // Set: multiple entries may register the same CSS file (shared chunks).
    const hrefs = [
      ...new Set(entries.filter(([, e]) => isLinkEntry(e)).map(([, e]) => (e as LinkEntry).href)),
    ];

    void Promise.all(hrefs.map(loadSheet))
      .then((sheets) => {
        if (cancelled) return;
        const existing = root.adoptedStyleSheets;
        const toAdd = sheets.filter((s) => !existing.includes(s));
        if (toAdd.length) root.adoptedStyleSheets = [...existing, ...toAdd];
      })
      // A failed fetch simply leaves that sheet out; loadSheet already
      // evicted it from the cache for a retry on the next update.
      .catch(() => {});

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  return (
    <>
      {entries.map(([key, entry]) => {
        if (isLinkEntry(entry)) {
          if (linkStrategy === "adopt") return null;
          return <link key={key} rel="stylesheet" href={entry.href} {...entry.attributes} />;
        }
        // Keyed by id only: updates to an existing id (HMR) patch the text
        // child of the existing <style> node. A changing key would remount
        // every style element on each update and force a full re-parse.
        return (
          <style {...entry.attributes} key={key}>
            {entry.css}
          </style>
        );
      })}
      {linkStrategy === "adopt" ? (
        <span ref={anchorRef} style={{ display: "none" }} aria-hidden="true" />
      ) : null}
    </>
  );
};

export default StylesTarget;
