export interface StylesTargetProps {
  onChange?: (
    stylesMap: Map<string, { css: string; attributes: Record<string, string> }>
  ) => void;
}
