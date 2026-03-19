import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const SOURCE_PATH = new URL(
  "../app/(internal)/_components/session-workspace.tsx",
  import.meta.url
);

test("session workspace no longer owns the page-level top navigation or breadcrumb", async () => {
  const source = await readFile(SOURCE_PATH, "utf8");

  assert.match(source, /data-layout="workspace-body"/);
  assert.match(source, /data-layout="workspace-sidebar"/);
  assert.match(source, /data-layout="workspace-main"/);
  assert.doesNotMatch(source, /InternalBreadcrumb/);
  assert.doesNotMatch(source, /InternalTopNavigation/);
  assert.doesNotMatch(source, /breadcrumbRoutes/);
  assert.doesNotMatch(source, /handleNavigateBack/);
  assert.doesNotMatch(source, /workspace-top-nav-body/);
});
