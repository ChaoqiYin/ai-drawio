import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const SHELL_SOURCE_PATH = new URL(
  "../app/(internal)/_components/session-tabs-shell.tsx",
  import.meta.url
);
const WORKSPACE_SOURCE_PATH = new URL(
  "../app/(internal)/_components/session-workspace.tsx",
  import.meta.url
);

test("workspace detail shell moves rename and readiness into the active tab header", async () => {
  const [shellSource, workspaceSource] = await Promise.all([
    readFile(SHELL_SOURCE_PATH, "utf8"),
    readFile(WORKSPACE_SOURCE_PATH, "utf8"),
  ]);

  assert.match(shellSource, /renderSessionTabTitle/);
  assert.match(shellSource, /session\.isReady \? 'draw\.io 已就绪' : '正在加载 draw\.io'/);
  assert.match(shellSource, /重命名/);
  assert.match(shellSource, /IconClose/);
  assert.match(shellSource, /session\.id === activeSessionId/);

  assert.doesNotMatch(workspaceSource, /<Tag color="green">更新时间 /);
  assert.doesNotMatch(workspaceSource, /draw\.io 已就绪/);
  assert.doesNotMatch(workspaceSource, /正在加载 draw\.io/);
  assert.doesNotMatch(workspaceSource, /IconEdit/);
});
