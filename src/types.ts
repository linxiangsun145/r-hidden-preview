export interface TablePreview {
  columns: string[];
  columnTypes: string[];
  rows: string[][];
  totalRows: number;
  isTibble: boolean;
  truncated: boolean;
}

interface PreviewResultBase {
  summary: string;
  detail?: string;
  plotPngBase64?: string;
  tablePreview?: TablePreview;
}

export type PreviewResult =
  | ({ kind: "text" } & PreviewResultBase)
  | ({ kind: "error" } & PreviewResultBase);

export type ContextMode = "selectionOnly" | "documentBeforeSelection";

export interface SelectionCheck {
  ok: boolean;
  shouldSkip: boolean;
  reason?: string;
}
