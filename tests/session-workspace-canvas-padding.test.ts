import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const SOURCE_PATH = new URL(
  "../app/(internal)/_components/session-workspace.tsx",
  import.meta.url
);

test("session workspace canvas wrapper does not add outer padding around the iframe frame", async () => {
  const source = await readFile(SOURCE_PATH, "utf8");

  assert.match(source, /const workspaceCanvasClassName =/);
  assert.doesNotMatch(source, /workspaceCanvasClassName[\s\S]*p-\[2px\]/);
});
