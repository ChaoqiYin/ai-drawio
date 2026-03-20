import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const SOURCE_PATH = new URL(
  "../app/(internal)/_components/session-workspace.tsx",
  import.meta.url
);

test("session workspace shell body keeps a transparent background utility", async () => {
  const source = await readFile(SOURCE_PATH, "utf8");

  assert.match(source, /const shellBodyClassName = 'min-h-0 min-w-0 flex flex-1 overflow-hidden gap-4 bg-transparent!';/);
});
