import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const SOURCE_PATH = new URL(
  "../app/(internal)/_components/session-workspace.tsx",
  import.meta.url
);

test("session workspace sidebar keeps a transparent background utility", async () => {
  const source = await readFile(SOURCE_PATH, "utf8");

  assert.match(source, /const sidebarClassName = 'h-full overflow-hidden bg-transparent!';/);
});
