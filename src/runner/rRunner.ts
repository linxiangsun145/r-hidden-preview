import { ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { buildExecutionScripts } from "./scriptBuilder";
import { parsePreviewResult } from "./resultParser";
import { PreviewResult } from "../types";
import { resolveRscriptPath } from "../util/rscriptResolver";
import { safeRemoveDir } from "../util/tempFiles";

export interface RunPreviewInput {
  rscriptPath: string;
  fullCode: string;
  timeoutMs: number;
  maxOutputLength: number;
}

export interface RunningPreviewTask {
  promise: Promise<PreviewResult>;
  cancel: () => void;
}

export class RRunner {
  run(input: RunPreviewInput): RunningPreviewTask {
    let processRef: ChildProcessWithoutNullStreams | undefined;
    let timeoutHandle: NodeJS.Timeout | undefined;
    let cancelled = false;

    const promise = new Promise<PreviewResult>(async (resolve) => {
      const built = await buildExecutionScripts(input.fullCode);
      let stdoutBuffer = "";
      let stderrBuffer = "";
      let settled = false;

      const finalize = async (result: PreviewResult): Promise<void> => {
        if (settled) {
          return;
        }
        settled = true;

        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }

        await safeRemoveDir(built.tempDir);
        resolve(result);
      };

      const resolvedRscriptPath = await resolveRscriptPath(input.rscriptPath);
      console.log("[R Hidden Preview] Running with resolved path:", resolvedRscriptPath);

      try {
        processRef = spawn(
          resolvedRscriptPath,
          ["--vanilla", built.runnerScriptPath, built.payloadPath, String(input.maxOutputLength)],
          {
            windowsHide: true,
            stdio: "pipe"
          }
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await finalize({
          kind: "error",
          summary: "Failed to start Rscript.",
          detail: `${message}\n\nPlease check rHiddenPreview.rscriptPath. Current resolved value: ${resolvedRscriptPath}`
        });
        return;
      }

      processRef.stdout.setEncoding("utf8");
      processRef.stderr.setEncoding("utf8");

      processRef.stdout.on("data", (chunk: string) => {
        stdoutBuffer += chunk;
      });

      processRef.stderr.on("data", (chunk: string) => {
        stderrBuffer += chunk;
      });

      processRef.on("error", async (err) => {
        await finalize({
          kind: "error",
          summary: "Rscript is not available.",
          detail: `${err.message}\n\nConfigure rHiddenPreview.rscriptPath to the full Rscript path. Current resolved value: ${resolvedRscriptPath}`
        });
      });

      processRef.on("close", async () => {
        if (cancelled) {
          await finalize({
            kind: "text",
            summary: "Preview cancelled.",
            detail: "The previous preview task was cancelled because a new selection was made."
          });
          return;
        }

        const parsed = parsePreviewResult(stdoutBuffer, stderrBuffer, input.maxOutputLength);
        const result = await withPlotImage(parsed.result, parsed.plotFilePath);
        await finalize(result);
      });

      timeoutHandle = setTimeout(() => {
        if (!processRef || processRef.killed) {
          return;
        }
        cancelled = true;
        processRef.kill();
        void finalize({
          kind: "error",
          summary: "预览超时",
          detail: `Execution exceeded ${input.timeoutMs} ms and was terminated.`
        });
      }, input.timeoutMs);
    });

    return {
      promise,
      cancel: () => {
        cancelled = true;
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }
        if (processRef && !processRef.killed) {
          processRef.kill();
        }
      }
    };
  }
}

async function withPlotImage(result: PreviewResult, plotFilePath?: string): Promise<PreviewResult> {
  if (!plotFilePath) {
    return result;
  }

  try {
    const pngBuffer = await readFile(plotFilePath);
    if (pngBuffer.length === 0) {
      return result;
    }

    return {
      ...result,
      plotPngBase64: pngBuffer.toString("base64")
    };
  } catch {
    return result;
  }
}
