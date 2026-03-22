import { SelectionCheck } from "../types";

const TRAILING_OPERATOR_PATTERN = /(?:[+\-*/^<>=~,&|:$@]|%%|%\/%|\|>|%>%|<-|=)\s*$/;

export function checkSelectionCompleteness(selectionText: string): SelectionCheck {
  if (selectionText.length === 0) {
    return { ok: false, shouldSkip: true, reason: "Selection is empty." };
  }

  const trimmed = selectionText.trim();
  if (trimmed.length === 0) {
    return { ok: false, shouldSkip: true, reason: "Selection is blank." };
  }

  if (isCommentOnly(selectionText)) {
    return { ok: false, shouldSkip: true, reason: "Comment-only selection is skipped." };
  }

  const scan = scanBracketsAndQuotes(selectionText);
  if (!scan.bracketsBalanced) {
    return {
      ok: false,
      shouldSkip: false,
      reason: "Selection seems incomplete: unbalanced brackets."
    };
  }

  if (!scan.quotesBalanced) {
    return {
      ok: false,
      shouldSkip: false,
      reason: "Selection seems incomplete: unclosed quote."
    };
  }

  if (looksLikeIncompleteExpression(trimmed)) {
    return {
      ok: false,
      shouldSkip: false,
      reason: "Selection does not look like a complete R expression."
    };
  }

  return { ok: true, shouldSkip: false };
}

function isCommentOnly(text: string): boolean {
  const nonEmptyLines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (nonEmptyLines.length === 0) {
    return true;
  }

  return nonEmptyLines.every((line) => line.startsWith("#"));
}

function scanBracketsAndQuotes(text: string): { bracketsBalanced: boolean; quotesBalanced: boolean } {
  const stack: string[] = [];
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const prev = i > 0 ? text[i - 1] : "";

    if (!inSingleQuote && !inDoubleQuote && ch === "#") {
      while (i < text.length && text[i] !== "\n") {
        i += 1;
      }
      continue;
    }

    if (!inDoubleQuote && ch === "'" && prev !== "\\") {
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (!inSingleQuote && ch === '"' && prev !== "\\") {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (inSingleQuote || inDoubleQuote) {
      continue;
    }

    if (ch === "(" || ch === "{" || ch === "[") {
      stack.push(ch);
      continue;
    }

    if (ch === ")" || ch === "}" || ch === "]") {
      const top = stack.pop();
      if (!top || !isMatchingBracket(top, ch)) {
        return { bracketsBalanced: false, quotesBalanced: !(inSingleQuote || inDoubleQuote) };
      }
    }
  }

  return {
    bracketsBalanced: stack.length === 0,
    quotesBalanced: !inSingleQuote && !inDoubleQuote
  };
}

function isMatchingBracket(open: string, close: string): boolean {
  return (
    (open === "(" && close === ")") ||
    (open === "{" && close === "}") ||
    (open === "[" && close === "]")
  );
}

function looksLikeIncompleteExpression(trimmed: string): boolean {
  if (TRAILING_OPERATOR_PATTERN.test(trimmed)) {
    return true;
  }

  const lines = trimmed.split(/\r?\n/);
  const lastLine = lines[lines.length - 1].trim();
  if (/^(if|for|while|function)\b/.test(lastLine) && !lastLine.includes("{")) {
    return true;
  }

  if (/\b(then|else)\s*$/.test(lastLine)) {
    return true;
  }

  return false;
}
