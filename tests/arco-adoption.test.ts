import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const LAYOUT_SOURCE_PATH = new URL("../app/layout.tsx", import.meta.url);
const SESSION_SOURCE_PATH = new URL(
  "../app/(internal)/_components/session-workspace.tsx",
  import.meta.url
);

test("root layout enables Arco light mode", async () => {
  const source = await readFile(LAYOUT_SOURCE_PATH, "utf8");

  assert.match(source, /@arco-design\/web-react\/dist\/css\/arco\.css/);
  assert.match(source, /ConfigProvider/);
  assert.match(source, /arco-theme="light"/);
});

test("session workspace uses inline utility-driven flex shell classes", async () => {
  const source = await readFile(SESSION_SOURCE_PATH, "utf8");

  assert.match(source, /const shellBodyClassName = 'min-h-0 min-w-0 flex flex-1 overflow-hidden gap-4 bg-transparent!';/);
  assert.match(source, /const workspaceClassName = 'min-h-0 flex min-w-0 flex-1 flex-col gap-4 lg:gap-\[18px\] bg-transparent!';/);
  assert.doesNotMatch(source, /workspace-head/);
});
