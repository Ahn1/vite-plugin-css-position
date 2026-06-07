/** A registered stylesheet — either inlined CSS (`inject*` modes) or a CSS file URL (`cssChunks` mode). */
export type StyleEntry =
  | { type?: "style"; css: string; attributes: Record<string, string> }
  | { type: "link"; href: string; attributes: Record<string, string> };

export type StylesMap = Map<string, StyleEntry>;

export interface StylesTargetProps {
  onChange?: (stylesMap: StylesMap) => void;
}

export function isLinkEntry(entry: StyleEntry): entry is Extract<StyleEntry, { type: "link" }> {
  return entry.type === "link";
}
