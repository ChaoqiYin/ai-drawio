import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const SOURCE_PATH = new URL(
  "../app/(internal)/_components/session-workspace.tsx",
  import.meta.url
);

test("session workspace uses a compact status bar layout for updated time and readiness", async () => {
  const source = await readFile(SOURCE_PATH, "utf8");

  assert.match(source, /<div className="flex items-center justify-end gap-3" data-layout="workspace-status-bar">/);
  assert.match(source, /<Space wrap size=\{8\}>[\s\S]*重命名[\s\S]*更新时间[\s\S]*draw\.io 已就绪/);
  assert.doesNotMatch(source, /data-layout="workspace-status-bar"[\s\S]*<div className="flex justify-end gap-5">/);
});
