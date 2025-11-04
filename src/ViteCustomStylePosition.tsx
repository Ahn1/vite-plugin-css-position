import { useEffect, useState } from "react";

export const StylesTarget = () => {
  const [stylesMap, setStylesMap] = useState<
    Map<string, { css: string; attributes: Record<string, string> }>
  >(window.__vite_c_css_pos_initial || new Map());

  const [version, setVersion] = useState(0);

  useEffect(() => {
    const updateListener = (_e: Event | undefined) => {
      setStylesMap(window.__vite_c_css_pos_initial);
      setVersion((v) => v + 1);
    };
    window.addEventListener("__vite_c_css_pos_update", updateListener);

    updateListener(undefined);

    return () => {
      window.removeEventListener("__vite_c_css_pos_update", updateListener);
    };
  }, []);

  return Array.from(stylesMap?.keys() || []).map((key) => {
    const entry = stylesMap.get(key);
    if (!entry) return null;
    return (
      <style {...entry.attributes} key={`${key}-${version}`}>
        {entry.css}
      </style>
    );
  });
};
