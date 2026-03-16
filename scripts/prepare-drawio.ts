import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export function getDrawioCopyPlan(rootDir: string): {
  sourceDir: string;
  targetDir: string;
} {
  return {
    sourceDir: join(rootDir, "webapp"),
    targetDir: join(rootDir, "public", "drawio")
  };
}

export async function prepareDrawioAssets(rootDir: string): Promise<{
  sourceDir: string;
  targetDir: string;
}> {
  const { sourceDir, targetDir } = getDrawioCopyPlan(rootDir);

  await mkdir(dirname(targetDir), { recursive: true });
  await rm(targetDir, { recursive: true, force: true });
  await cp(sourceDir, targetDir, { recursive: true, force: true });

  return { sourceDir, targetDir };
}

const scriptPath = fileURLToPath(import.meta.url);
const isDirectRun = process.argv[1] === scriptPath;

if (isDirectRun) {
  const rootDir = join(dirname(scriptPath), "..");
  prepareDrawioAssets(rootDir).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
