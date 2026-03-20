import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const SOURCE_PATH = new URL(
  "../app/(internal)/_components/session-workspace-host.tsx",
  import.meta.url
);

test("session workspace host keeps the active workspace in a shrinkable flex item", async () => {
  const source = await readFile(SOURCE_PATH, "utf8");

  assert.match(
    source,
    /className=\{hidden \? 'hidden' : 'flex min-h-0 min-w-0 flex-1 overflow-hidden'\}/
  );
});
