interface PreviewResultBase {
  summary: string;
  detail?: string;
  plotPngBase64?: string;
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
