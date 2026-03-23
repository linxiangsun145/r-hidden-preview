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
        enableScripts: true,
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
    const hasTable = Boolean(payload.result.tablePreview);
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
    const tableSection = hasTable
      ? renderTableSection(
          payload.result.tablePreview!.columns,
          payload.result.tablePreview!.columnTypes,
          payload.result.tablePreview!.rows,
          payload.result.tablePreview!.totalRows,
          payload.result.tablePreview!.isTibble,
          payload.result.tablePreview!.truncated
        )
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
    .table-wrap {
      max-height: 320px;
      overflow: auto;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 8px;
      background: color-mix(in srgb, var(--vscode-editorWidget-background) 85%, transparent);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    th,
    td {
      border-bottom: 1px solid var(--vscode-panel-border);
      padding: 6px 8px;
      text-align: left;
      white-space: nowrap;
    }
    th {
      position: sticky;
      top: 0;
      background: var(--vscode-editor-background);
      z-index: 1;
      font-weight: 600;
      cursor: pointer;
    }
    th.sorted {
      color: var(--vscode-textLink-foreground);
    }
    .col-type {
      display: block;
      font-weight: normal;
      opacity: 0.75;
      font-size: 11px;
      margin-top: 2px;
    }
    .table-toolbar {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
      flex-wrap: wrap;
      font-size: 12px;
    }
    .table-toolbar button {
      border: 1px solid var(--vscode-button-border, var(--vscode-panel-border));
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      padding: 2px 8px;
      border-radius: 4px;
      cursor: pointer;
    }
    .table-toolbar button:disabled {
      opacity: 0.5;
      cursor: default;
    }
    .table-toolbar select {
      background: var(--vscode-dropdown-background);
      color: var(--vscode-dropdown-foreground);
      border: 1px solid var(--vscode-dropdown-border);
      border-radius: 4px;
      padding: 2px 6px;
    }
    .table-note {
      margin: 8px 0 0;
      font-size: 12px;
      opacity: 0.8;
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
  ${tableSection}
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

function renderTableSection(
  columns: string[],
  columnTypes: string[],
  rows: string[][],
  totalRows: number,
  isTibble: boolean,
  truncated: boolean
): string {
  const payload = {
    columns,
    columnTypes,
    rows,
    totalRows,
    isTibble,
    truncated
  };

  const note = truncated
    ? '<p class="table-note">Table preview is truncated for performance.</p>'
    : "";
  const sourceLabel = isTibble ? "tibble" : "data.frame";

  return `<section class="section">
    <h2>Data Frame</h2>
    <div class="table-toolbar">
      <span>Source: <strong>${escapeHtml(sourceLabel)}</strong></span>
      <span id="table-meta"></span>
      <button id="page-prev" type="button">Prev</button>
      <button id="page-next" type="button">Next</button>
      <label>Rows per page
        <select id="page-size">
          <option value="20">20</option>
          <option value="50" selected>50</option>
          <option value="100">100</option>
          <option value="200">200</option>
        </select>
      </label>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr id="table-head-row"></tr></thead>
        <tbody id="table-body"></tbody>
      </table>
    </div>
    ${note}
    <script type="application/json" id="table-data">${escapeForJsonScript(JSON.stringify(payload))}</script>
    <script>
      (function() {
        const dataNode = document.getElementById('table-data');
        if (!dataNode) return;
        const data = JSON.parse(dataNode.textContent || '{}');
        const columns = data.columns || [];
        const columnTypes = data.columnTypes || [];
        let rows = Array.isArray(data.rows) ? data.rows.slice() : [];
        const totalRows = Number.isFinite(data.totalRows) ? data.totalRows : rows.length;
        const metaNode = document.getElementById('table-meta');
        const headRow = document.getElementById('table-head-row');
        const body = document.getElementById('table-body');
        const prevBtn = document.getElementById('page-prev');
        const nextBtn = document.getElementById('page-next');
        const pageSizeSelect = document.getElementById('page-size');

        let page = 1;
        let pageSize = Number(pageSizeSelect.value || '50');
        let sortColumn = -1;
        let sortDir = 1;

        function compareValues(a, b) {
          const aNum = Number(a);
          const bNum = Number(b);
          const aOk = Number.isFinite(aNum) && a.trim() !== '';
          const bOk = Number.isFinite(bNum) && b.trim() !== '';
          if (aOk && bOk) return aNum - bNum;
          return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
        }

        function sortRows(colIndex) {
          if (sortColumn === colIndex) {
            sortDir = -sortDir;
          } else {
            sortColumn = colIndex;
            sortDir = 1;
          }

          rows.sort((left, right) => {
            const l = String(left[colIndex] || '');
            const r = String(right[colIndex] || '');
            return compareValues(l, r) * sortDir;
          });

          page = 1;
          render();
        }

        function renderHead() {
          headRow.innerHTML = '';
          columns.forEach((col, idx) => {
            const th = document.createElement('th');
            if (idx === sortColumn) {
              th.classList.add('sorted');
            }
            const arrow = idx === sortColumn ? (sortDir > 0 ? ' ▲' : ' ▼') : '';
            th.innerHTML =
              escapeHtmlForDom(col) +
              arrow +
              '<span class="col-type">&lt;' +
              escapeHtmlForDom(columnTypes[idx] || 'unknown') +
              '&gt;</span>';
            th.addEventListener('click', () => sortRows(idx));
            headRow.appendChild(th);
          });
        }

        function renderBody() {
          body.innerHTML = '';
          const start = (page - 1) * pageSize;
          const pageRows = rows.slice(start, start + pageSize);
          pageRows.forEach((row) => {
            const tr = document.createElement('tr');
            columns.forEach((_, colIdx) => {
              const td = document.createElement('td');
              td.textContent = String(row[colIdx] ?? '');
              tr.appendChild(td);
            });
            body.appendChild(tr);
          });
        }

        function renderMeta() {
          const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
          metaNode.textContent = 'Rows: ' + totalRows + ' | Showing ' + rows.length + ' | Page ' + page + '/' + pageCount;
          prevBtn.disabled = page <= 1;
          nextBtn.disabled = page >= pageCount;
        }

        function render() {
          renderHead();
          renderBody();
          renderMeta();
        }

        prevBtn.addEventListener('click', () => {
          page = Math.max(1, page - 1);
          render();
        });

        nextBtn.addEventListener('click', () => {
          const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
          page = Math.min(pageCount, page + 1);
          render();
        });

        pageSizeSelect.addEventListener('change', () => {
          pageSize = Number(pageSizeSelect.value || '50');
          page = 1;
          render();
        });

        function escapeHtmlForDom(value) {
          return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
        }

        render();
      })();
    </script>
  </section>`;
}

function escapeForJsonScript(value: string): string {
  return value.replace(/<\//g, "<\\/").replace(/</g, "\\u003c");
}
