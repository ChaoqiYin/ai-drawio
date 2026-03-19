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

test("session workspace uses inline utilities for page shell spacing", async () => {
  const source = await readFile(SESSION_SOURCE_PATH, "utf8");

  assert.match(source, /flex flex-col h-full min-h-full p-\[18px\] lg:p-\[22px\]/);
  assert.doesNotMatch(source, /workspace-head/);
});
