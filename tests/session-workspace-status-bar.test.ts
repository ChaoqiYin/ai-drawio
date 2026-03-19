import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const SOURCE_PATH = new URL(
  "../app/(internal)/_components/session-workspace.tsx",
  import.meta.url
);

test("session workspace no longer renders updated time and readiness in its own header", async () => {
  const source = await readFile(SOURCE_PATH, "utf8");

  assert.doesNotMatch(source, /data-layout="workspace-top-nav-body"/);
  assert.doesNotMatch(source, /data-layout="workspace-status-bar"/);
  assert.doesNotMatch(source, /<Tag color="green">更新时间 /);
  assert.doesNotMatch(source, /draw\.io 已就绪/);
  assert.doesNotMatch(source, /正在加载 draw\.io/);
});
