import * as vscode from "vscode";
import { PreviewResult } from "../types";

export interface PreviewPanelPayload {
  fileName: string;
  mode: string;
  result: PreviewResult;
  timestamp: string;
}

export class PreviewPanel implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined;
  private latestPayload: PreviewPanelPayload | undefined;
  private readonly disposables: vscode.Disposable[] = [];

  update(payload: PreviewPanelPayload, reveal = false): void {
    this.latestPayload = payload;
    const panel = this.ensurePanel();
    panel.webview.html = this.renderHtml(payload);

    if (reveal || !panel.visible) {
      void this.show(reveal);
    }
  }

  async show(reveal = true): Promise<void> {
    try {
      const panel = this.ensurePanel();
      panel.reveal(vscode.ViewColumn.Beside, !reveal);
    } catch (error) {
      console.error("[R Hidden Preview] Failed to show detail view:", error);
    }
  }

  dispose(): void {
    this.panel?.dispose();
    this.disposables.forEach((d) => d.dispose());
    this.disposables.length = 0;
  }

  private ensurePanel(): vscode.WebviewPanel {
    if (this.panel) {
      return this.panel;
    }

    const panel = vscode.window.createWebviewPanel(
      "rHiddenPreview.detail",
      "R Hidden Preview",
      vscode.ViewColumn.Beside,
      {
        enableScripts: false,
        retainContextWhenHidden: true
      }
    );

    panel.onDidDispose(() => {
      this.panel = undefined;
    });

    panel.onDidChangeViewState((event) => {
      if (!event.webviewPanel.visible) {
        return;
      }
      if (this.latestPayload) {
        event.webviewPanel.webview.html = this.renderHtml(this.latestPayload);
      }
    });

    this.panel = panel;
    panel.webview.html = this.latestPayload
      ? this.renderHtml(this.latestPayload)
      : this.renderEmptyHtml();
    return panel;
  }

  private renderHtml(payload: PreviewPanelPayload): string {
    const detail = normalizeBlock(payload.result.detail ?? "(no detail)");
    const summary = normalizeInline(payload.result.summary);
    const hasPlot = Boolean(payload.result.plotPngBase64);
    const isError = payload.result.kind === "error";
    const statusText = isError ? "ERROR" : "SUCCESS";
    const statusClass = isError ? "status error" : "status success";
    const fileName = payload.fileName.split(/[\\/]/).pop() ?? payload.fileName;
    const plotSection = hasPlot
      ? `<section class="section">
    <h2>Plot</h2>
    <img class="plot" alt="R plot preview" src="data:image/png;base64,${payload.result.plotPngBase64}" />
  </section>`
      : "";

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>R Hidden Preview</title>
  <style>
    :root {
      color-scheme: light dark;
      font-family: "Segoe UI", sans-serif;
    }
    body {
      margin: 0;
      padding: 16px;
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
    }
    h1 {
      margin: 0 0 12px;
      font-size: 18px;
      font-weight: 600;
    }
    .meta {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 6px 12px;
      margin-bottom: 14px;
      font-size: 12px;
      opacity: 0.9;
    }
    .status {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
      margin-bottom: 12px;
    }
    .status.success {
      color: #0f5132;
      background: #d1e7dd;
    }
    .status.error {
      color: #842029;
      background: #f8d7da;
    }
    .section {
      margin-bottom: 12px;
    }
    .section h2 {
      margin: 0 0 8px;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      opacity: 0.8;
    }
    .summary {
      margin: 0;
      white-space: pre-wrap;
      line-height: 1.5;
      background: color-mix(in srgb, var(--vscode-editorWidget-background) 85%, transparent);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 8px;
      padding: 10px 12px;
    }
    pre {
      margin: 0;
      white-space: pre-wrap;
      word-break: break-word;
      line-height: 1.45;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 8px;
      padding: 10px 12px;
      background: color-mix(in srgb, var(--vscode-editorWidget-background) 85%, transparent);
    }
    .plot {
      display: block;
      max-width: 100%;
      height: auto;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 8px;
      background: color-mix(in srgb, var(--vscode-editorWidget-background) 85%, transparent);
    }
  </style>
</head>
<body>
  <h1>R Hidden Preview</h1>
  <div class="${statusClass}">${escapeHtml(statusText)}</div>
  <div class="meta">
    <div>Updated</div><div>${escapeHtml(payload.timestamp)}</div>
    <div>File</div><div>${escapeHtml(fileName)}</div>
    <div>Mode</div><div>${escapeHtml(payload.mode)}</div>
  </div>
  <section class="section">
    <h2>Summary</h2>
    <p class="summary">${escapeHtml(summary)}</p>
  </section>
  <section class="section">
    <h2>Detail</h2>
    <pre>${escapeHtml(detail)}</pre>
  </section>
  ${plotSection}
</body>
</html>`;
  }

  private renderEmptyHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>R Hidden Preview</title>
</head>
<body style="font-family: Segoe UI, sans-serif; padding: 16px;">
  <h1>R Hidden Preview</h1>
  <p>No preview yet. Select R code to run.</p>
</body>
</html>`;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeInline(value: string): string {
  const normalized = value.replace(/\r\n/g, "\n").replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : "(empty summary)";
}

function normalizeBlock(value: string): string {
  const normalized = value.replace(/\r\n/g, "\n").trim();
  return normalized.length > 0 ? normalized : "(empty detail)";
}
