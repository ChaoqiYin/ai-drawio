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

test("workspace detail shell uses a status lamp and icon actions inside the tab header", async () => {
  const [shellSource, workspaceSource] = await Promise.all([
    readFile(SHELL_SOURCE_PATH, "utf8"),
    readFile(WORKSPACE_SOURCE_PATH, "utf8"),
  ]);

  assert.match(shellSource, /renderSessionTabTitle/);
  assert.match(shellSource, /data-layout="session-tab-title"/);
  assert.match(shellSource, /data-layout="session-tab-status-lamp"/);
  assert.match(shellSource, /data-layout="session-tab-actions"/);
  assert.match(shellSource, /data-layout="session-tab-rename"/);
  assert.match(shellSource, /data-layout="session-tab-close"/);
  assert.match(shellSource, /session\.isReady \? 'rgb\(var\(--success-6\)\)' : 'rgb\(var\(--warning-6\)\)'/);
  assert.match(shellSource, /IconClose/);
  assert.match(shellSource, /session\.id === activeSessionId/);
  assert.doesNotMatch(shellSource, /<Tag color=/);
  assert.doesNotMatch(shellSource, /draw\.io 已就绪/);
  assert.doesNotMatch(shellSource, /正在加载 draw\.io/);

  assert.doesNotMatch(workspaceSource, /<Tag color="green">更新时间 /);
  assert.doesNotMatch(workspaceSource, /draw\.io 已就绪/);
  assert.doesNotMatch(workspaceSource, /正在加载 draw\.io/);
  assert.doesNotMatch(workspaceSource, /IconEdit/);
});
