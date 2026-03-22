import * as fs from "node:fs/promises";
import * as path from "node:path";

export async function resolveRscriptPath(configuredPath: string): Promise<string> {
  if (configuredPath.trim().length > 0 && configuredPath !== "Rscript") {
    return configuredPath;
  }

  if (process.platform !== "win32") {
    return configuredPath;
  }

  const discovered = await discoverWindowsRscript();
  return discovered ?? configuredPath;
}

async function discoverWindowsRscript(): Promise<string | undefined> {
  const candidates: string[] = [];

  const programFiles = process.env.ProgramFiles;
  const programFilesX86 = process.env["ProgramFiles(x86)"];

  if (programFiles) {
    candidates.push(...(await collectFromRRoot(path.join(programFiles, "R"))));
  }

  if (programFilesX86) {
    candidates.push(...(await collectFromRRoot(path.join(programFilesX86, "R"))));
  }

  for (const candidate of candidates) {
    if (await exists(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

async function collectFromRRoot(rRoot: string): Promise<string[]> {
  if (!(await exists(rRoot))) {
    return [];
  }

  const entries = await fs.readdir(rRoot, { withFileTypes: true });
  const versionDirs = entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("R-"))
    .map((entry) => entry.name)
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true, sensitivity: "base" }));

  const candidates: string[] = [];
  for (const versionDir of versionDirs) {
    const base = path.join(rRoot, versionDir, "bin");
    candidates.push(path.join(base, "Rscript.exe"));
    candidates.push(path.join(base, "x64", "Rscript.exe"));
    candidates.push(path.join(base, "i386", "Rscript.exe"));
  }

  return candidates;
}

async function exists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}
