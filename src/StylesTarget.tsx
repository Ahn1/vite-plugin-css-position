import { useEffect, useState } from "react";
import type { StylesTargetProps } from "./StylesTarget.types";

declare const __VITE_CSS_POS_GLOBAL_VAR_NAME__: string;
declare const __VITE_CSS_POS_EVENT_NAME__: string;

const globalVarName = __VITE_CSS_POS_GLOBAL_VAR_NAME__;
const eventName = __VITE_CSS_POS_EVENT_NAME__;

const getCurrent = () => (window as any)[globalVarName];

const StylesTarget = (props: StylesTargetProps) => {
  const [stylesMap, setStylesMap] = useState<
    Map<string, { css: string; attributes: Record<string, string> }>
  >(getCurrent() || new Map());

  const [version, setVersion] = useState(0);

  useEffect(() => {
    const updateListener = (_e: Event | undefined) => {
      const newValues = getCurrent() || new Map();
      setStylesMap(newValues);
      setVersion((v) => v + 1);
      props.onChange?.(newValues);
    };
    window.addEventListener(eventName, updateListener);

    updateListener(undefined);

    return () => {
      window.removeEventListener(eventName, updateListener);
    };
  }, [props.onChange]);

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

export default StylesTarget;
