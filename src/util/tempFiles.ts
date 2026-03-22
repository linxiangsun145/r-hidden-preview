import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

export async function createTempDir(prefix = "r-hidden-preview-"): Promise<string> {
  const baseDir = os.tmpdir();
  return fs.mkdtemp(path.join(baseDir, prefix));
}

export async function writeUtf8File(filePath: string, content: string): Promise<void> {
  await fs.writeFile(filePath, content, { encoding: "utf8" });
}

export async function safeRemoveDir(dirPath: string): Promise<void> {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
  } catch {
    // Ignore cleanup failures to avoid affecting extension stability.
  }
}
