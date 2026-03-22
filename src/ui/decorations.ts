import * as vscode from "vscode";

export class InlinePreviewDecorations implements vscode.Disposable {
  private readonly decorationType: vscode.TextEditorDecorationType;

  constructor() {
    this.decorationType = vscode.window.createTextEditorDecorationType({
      after: {
        margin: "0 0 0 1.2em",
        color: new vscode.ThemeColor("editorCodeLens.foreground"),
        fontStyle: "italic"
      },
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
    });
  }

  show(editor: vscode.TextEditor, line: number, summary: string): void {
    const targetLine = Math.max(0, Math.min(line, editor.document.lineCount - 1));
    const lineRange = editor.document.lineAt(targetLine).range;

    const safeSummary = summary.trim().length > 0 ? summary : "(no summary)";

    const decoration: vscode.DecorationOptions = {
      range: lineRange,
      renderOptions: {
        after: {
          contentText: ` => ${truncateInline(safeSummary)}`
        }
      },
      hoverMessage: safeSummary
    };

    editor.setDecorations(this.decorationType, [decoration]);
  }

  clear(editor: vscode.TextEditor): void {
    editor.setDecorations(this.decorationType, []);
  }

  dispose(): void {
    this.decorationType.dispose();
  }
}

function truncateInline(value: string): string {
  const maxInlineLength = 80;
  if (value.length <= maxInlineLength) {
    return value;
  }
  return `${value.slice(0, maxInlineLength)}...[truncated]`;
}
