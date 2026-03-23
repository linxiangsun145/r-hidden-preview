import * as path from "node:path";
import { createTempDir, writeUtf8File } from "../util/tempFiles";

export interface BuiltScriptFiles {
  tempDir: string;
  runnerScriptPath: string;
  payloadPath: string;
}

export async function buildExecutionScripts(fullCode: string): Promise<BuiltScriptFiles> {
  const tempDir = await createTempDir();
  const payloadPath = path.join(tempDir, "payload.R");
  const runnerScriptPath = path.join(tempDir, "runner.R");

  await writeUtf8File(payloadPath, fullCode);
  await writeUtf8File(runnerScriptPath, buildRunnerScript());

  return {
    tempDir,
    runnerScriptPath,
    payloadPath
  };
}

function buildRunnerScript(): string {
  return [
    "args <- commandArgs(trailingOnly = TRUE)",
    "payloadPath <- args[[1]]",
    "maxLen <- as.integer(args[[2]])",
    "plotPath <- file.path(dirname(payloadPath), 'preview_plot.png')",
    "",
    "truncate_text <- function(x, n) {",
    "  if (is.na(n) || n <= 0) return(x)",
    "  if (nchar(x, type = 'bytes') <= n) return(x)",
    "  paste0(substr(x, 1, n), '...[truncated]')",
    "}",
    "",
    "emit <- function(kind, summary, detail, plot_file = '', table_tsv = '', table_types = '', table_total_rows = '0', table_is_tibble = 'false', table_truncated = 'false') {",
    "  cat('<<RPREVIEW_KIND>>', kind, '\\n', sep = '')",
    "  cat('<<RPREVIEW_SUMMARY>>\\n', summary, '\\n<<RPREVIEW_SUMMARY_END>>\\n', sep = '')",
    "  cat('<<RPREVIEW_DETAIL>>\\n', detail, '\\n<<RPREVIEW_DETAIL_END>>\\n', sep = '')",
    "  cat('<<RPREVIEW_PLOT>>\\n', plot_file, '\\n<<RPREVIEW_PLOT_END>>\\n', sep = '')",
    "  cat('<<RPREVIEW_TABLE_TSV>>\\n', table_tsv, '\\n<<RPREVIEW_TABLE_TSV_END>>\\n', sep = '')",
    "  cat('<<RPREVIEW_TABLE_TYPES>>\\n', table_types, '\\n<<RPREVIEW_TABLE_TYPES_END>>\\n', sep = '')",
    "  cat('<<RPREVIEW_TABLE_TOTAL_ROWS>>', table_total_rows, '\\n', sep = '')",
    "  cat('<<RPREVIEW_TABLE_IS_TIBBLE>>', table_is_tibble, '\\n', sep = '')",
    "  cat('<<RPREVIEW_TABLE_TRUNCATED>>', table_truncated, '\\n', sep = '')",
    "}",
    "",
    "sanitize_cell <- function(x) {",
    "  value <- as.character(x)",
    "  value <- gsub('\\\\t', ' ', value)",
    "  value <- gsub('\\\\r?\\\\n', ' ', value, perl = TRUE)",
    "  value",
    "}",
    "",
    "safe_read <- function(file_path) {",
    "  lines <- readLines(file_path, warn = FALSE, encoding = 'UTF-8')",
    "  paste(lines, collapse = '\\n')",
    "}",
    "",
    "code <- safe_read(payloadPath)",
    "",
    "tryCatch({",
    "  if (file.exists(plotPath)) unlink(plotPath)",
    "  oldDevice <- getOption('device')",
    "  options(device = function(...) grDevices::png(filename = plotPath, width = 960, height = 600))",
    "  on.exit(options(device = oldDevice), add = TRUE)",
    "",
    "  exprs <- parse(text = code)",
    "  if (length(exprs) == 0) {",
    "    emit('text', '(empty)', 'No expression to evaluate.', '', '', '', '0', 'false', 'false')",
    "    quit(save = 'no', status = 0)",
    "  }",
    "",
    "  last_value <- NULL",
    "  warning_buffer <- character()",
    "",
    "  output_lines <- withCallingHandlers(",
    "    capture.output({",
    "      for (expr in exprs) {",
    "        last_value <- eval(expr, envir = .GlobalEnv)",
    "      }",
    "      if (!is.null(last_value)) {",
    "        print(last_value)",
    "      }",
    "    }, type = 'output'),",
    "    warning = function(w) {",
    "      warning_buffer <<- c(warning_buffer, paste0('Warning: ', conditionMessage(w)))",
    "      invokeRestart('muffleWarning')",
    "    }",
    "  )",
    "",
    "  detail_lines <- c(warning_buffer, output_lines)",
    "  if (length(detail_lines) == 0) {",
    "    detail_lines <- c('(no textual output)')",
    "  }",
    "",
    "  detail <- paste(detail_lines, collapse = '\\n')",
    "  summary <- strsplit(detail, '\\n', fixed = TRUE)[[1]][1]",
    "",
    "  while (!is.null(grDevices::dev.list())) {",
    "    grDevices::dev.off()",
    "  }",
    "",
    "  emittedPlot <- ''",
    "  if (file.exists(plotPath)) {",
    "    fileSize <- file.info(plotPath)$size",
    "    if (!is.na(fileSize) && fileSize > 0) {",
    "      emittedPlot <- plotPath",
    "    }",
    "  }",
    "",
    "  tableTsv <- ''",
    "  tableTypes <- ''",
    "  tableTotalRows <- '0'",
    "  tableIsTibble <- 'false'",
    "  tableTruncated <- 'false'",
    "  if (is.data.frame(last_value)) {",
    "    rowCount <- nrow(last_value)",
    "    tableDf <- if (rowCount > 0) last_value[seq_len(rowCount), , drop = FALSE] else last_value[0, , drop = FALSE]",
    "    tableTotalRows <- as.character(rowCount)",
    "    tableIsTibble <- if (inherits(last_value, 'tbl_df')) 'true' else 'false'",
    "    tableTypes <- paste(vapply(last_value, function(col) paste(class(col), collapse = '/'), character(1)), collapse = '\\t')",
    "    tableDf[] <- lapply(tableDf, sanitize_cell)",
    "    header <- paste(colnames(tableDf), collapse = '\\t')",
    "    body <- if (rowCount > 0) apply(tableDf, 1, function(row) paste(row, collapse = '\\t')) else character()",
    "    tableTsv <- paste(c(header, body), collapse = '\\n')",
    "  }",
    "",
    "  emit('text', truncate_text(summary, maxLen), truncate_text(detail, maxLen), emittedPlot, tableTsv, tableTypes, tableTotalRows, tableIsTibble, tableTruncated)",
    "}, error = function(e) {",
    "  error_message <- paste0('Error: ', conditionMessage(e))",
    "  emit('error', truncate_text(error_message, maxLen), truncate_text(error_message, maxLen), '', '', '', '0', 'false', 'false')",
    "  quit(save = 'no', status = 1)",
    "})",
    ""
  ].join("\n");
}
