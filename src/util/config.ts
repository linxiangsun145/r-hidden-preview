import * as vscode from "vscode";
import { ContextMode } from "../types";

export interface ExtensionConfig {
  rscriptPath: string;
  timeoutMs: number;
  debounceMs: number;
  autoPreview: boolean;
  contextMode: ContextMode;
  maxOutputLength: number;
  showInlinePreview: boolean;
  showPanelPreview: boolean;
  requireWorkspaceTrust: boolean;
  ignoreIncompleteSelection: boolean;
}

const SECTION = "rHiddenPreview";
let lastLoggedConfigSignature: string | undefined;

function sanitizeRscriptPath(raw: string): string {
  const trimmed = raw.trim();

  // Be tolerant of accidental quoting in settings, e.g. "D:\\R\\...\\Rscript.exe".
  return trimmed.replace(/^"+/, "").replace(/"+$/, "");
}

export function getConfig(): ExtensionConfig {
  const config = vscode.workspace.getConfiguration(SECTION);

  const rscriptPath = sanitizeRscriptPath(config.get<string>("rscriptPath", "Rscript"));
  const timeoutMs = clampNumber(config.get<number>("timeoutMs", 3000), 300, 120000);
  const debounceMs = clampNumber(config.get<number>("debounceMs", 350), 50, 10000);
  const autoPreview = config.get<boolean>("autoPreview", true);
  const contextModeValue = config.get<string>("contextMode", "documentBeforeSelection");
  const contextMode: ContextMode =
    contextModeValue === "selectionOnly" ? "selectionOnly" : "documentBeforeSelection";
  const maxOutputLength = clampNumber(config.get<number>("maxOutputLength", 2000), 100, 100000);
  const showInlinePreview = config.get<boolean>("showInlinePreview", true);
  const showPanelPreview = config.get<boolean>("showPanelPreview", true);
  const requireWorkspaceTrust = config.get<boolean>("requireWorkspaceTrust", true);
  const ignoreIncompleteSelection = config.get<boolean>("ignoreIncompleteSelection", true);

  const signature = JSON.stringify({
    rscriptPath,
    timeoutMs,
    debounceMs,
    autoPreview,
    contextMode,
    maxOutputLength,
    showInlinePreview,
    showPanelPreview,
    requireWorkspaceTrust,
    ignoreIncompleteSelection
  });

  if (signature !== lastLoggedConfigSignature) {
    lastLoggedConfigSignature = signature;
    console.log("[R Hidden Preview] Config loaded:", {
      rscriptPath,
      timeoutMs,
      debounceMs,
      contextMode
    });
  }

  return {
    rscriptPath,
    timeoutMs,
    debounceMs,
    autoPreview,
    contextMode,
    maxOutputLength,
    showInlinePreview,
    showPanelPreview,
    requireWorkspaceTrust,
    ignoreIncompleteSelection
  };
}

function clampNumber(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
}
