import { PreviewResult } from "../types";

const KIND_TOKEN = "<<RPREVIEW_KIND>>";
const SUMMARY_BEGIN = "<<RPREVIEW_SUMMARY>>";
const SUMMARY_END = "<<RPREVIEW_SUMMARY_END>>";
const DETAIL_BEGIN = "<<RPREVIEW_DETAIL>>";
const DETAIL_END = "<<RPREVIEW_DETAIL_END>>";
const PLOT_BEGIN = "<<RPREVIEW_PLOT>>";
const PLOT_END = "<<RPREVIEW_PLOT_END>>";

export interface ParsedPreviewResult {
  result: PreviewResult;
  plotFilePath?: string;
}

export function parsePreviewResult(stdout: string, stderr: string, fallbackMaxLength: number): ParsedPreviewResult {
  const kind = extractLineValue(stdout, KIND_TOKEN);
  const summary = normalizeText(extractBlock(stdout, SUMMARY_BEGIN, SUMMARY_END));
  const detail = normalizeText(extractBlock(stdout, DETAIL_BEGIN, DETAIL_END));
  const plotFilePath = normalizeText(extractBlock(stdout, PLOT_BEGIN, PLOT_END));

  if (kind === "text" || kind === "error") {
    const computedSummary = cleanupSummaryLine(pickSummary(summary, detail, kind));
    const computedDetail = detail || normalizeText(stderr) || fallbackSummary(kind);

    return {
      result: {
        kind,
        summary: truncate(computedSummary, fallbackMaxLength),
        detail: truncate(computedDetail, fallbackMaxLength)
      },
      plotFilePath
    };
  }

  const normalizedStderr = normalizeText(stderr);
  if (normalizedStderr && normalizedStderr.length > 0) {
    const short = truncate(normalizedStderr, fallbackMaxLength);
    return {
      result: {
        kind: "error",
        summary: short,
        detail: short
      }
    };
  }

  const unknown = "No structured preview result was produced.";
  return {
    result: {
      kind: "error",
      summary: truncate(unknown, fallbackMaxLength),
      detail: truncate(stdout.trim() || unknown, fallbackMaxLength)
    }
  };
}

function extractLineValue(text: string, token: string): string | undefined {
  const start = text.indexOf(token);
  if (start === -1) {
    return undefined;
  }
  const valueStart = start + token.length;
  const lineEnd = text.indexOf("\n", valueStart);
  const raw = lineEnd === -1 ? text.slice(valueStart) : text.slice(valueStart, lineEnd);
  return raw.trim();
}

function extractBlock(text: string, begin: string, end: string): string | undefined {
  const start = text.indexOf(begin);
  if (start === -1) {
    return undefined;
  }

  const contentStart = start + begin.length;
  const endIndex = text.indexOf(end, contentStart);
  if (endIndex === -1) {
    return undefined;
  }

  const value = text.slice(contentStart, endIndex);
  return value.replace(/^\n/, "").replace(/\n$/, "");
}

function truncate(value: string, maxLen: number): string {
  if (value.length <= maxLen) {
    return value;
  }
  return `${value.slice(0, maxLen)}...[truncated]`;
}

function pickSummary(
  summary: string | undefined,
  detail: string | undefined,
  kind: "text" | "error"
): string {
  if (summary && summary.length > 0) {
    return summary;
  }

  if (detail && detail.length > 0) {
    const firstNonEmpty = detail
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0);

    if (firstNonEmpty) {
      return firstNonEmpty;
    }
  }

  return fallbackSummary(kind);
}

function normalizeText(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const withoutAnsi = value.replace(/\u001b\[[0-9;]*m/g, "");
  const normalized = withoutAnsi.replace(/\r\n/g, "\n").trim();
  return normalized.length > 0 ? normalized : undefined;
}

function cleanupSummaryLine(value: string): string {
  // R console output often starts with index labels like "[1] " for printed vectors.
  return value.replace(/^\[\d+\]\s*/, "");
}

function fallbackSummary(kind: "text" | "error"): string {
  return kind === "text" ? "Preview completed." : "Preview failed.";
}
