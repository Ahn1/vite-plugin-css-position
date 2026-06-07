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

const StylesTarget = (props: StylesTargetProps) => {
  const [stylesMap, setStylesMap] = useState<StylesMap>(getCurrent() || new Map());
  const [version, setVersion] = useState(0);

  const anchorRef = useRef<HTMLSpanElement>(null);
  // Cache constructed sheets per href so the same file is parsed once.
  const adoptedRef = useRef<Map<string, CSSStyleSheet>>(new Map());

  useEffect(() => {
    const updateListener = () => {
      const newValues = getCurrent() || new Map();
      setStylesMap(newValues);
      setVersion((v) => v + 1);
      props.onChange?.(newValues);
    };
    window.addEventListener(eventName, updateListener);
    updateListener();
    return () => {
      window.removeEventListener(eventName, updateListener);
    };
  }, [props.onChange]);

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
    const cache = adoptedRef.current;
    const hrefs = entries.filter(([, e]) => isLinkEntry(e)).map(([, e]) => (e as LinkEntry).href);

    void Promise.all(
      hrefs.map(async (href) => {
        if (cache.has(href)) return;
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(await (await fetch(href)).text());
        cache.set(href, sheet);
      })
    ).then(() => {
      if (cancelled) return;
      const desired = hrefs.map((h) => cache.get(h)).filter(Boolean) as CSSStyleSheet[];
      const existing = root.adoptedStyleSheets;
      const toAdd = desired.filter((s) => !existing.includes(s));
      if (toAdd.length) root.adoptedStyleSheets = [...existing, ...toAdd];
    });

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
        return (
          <style {...entry.attributes} key={`${key}-${version}`}>
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
