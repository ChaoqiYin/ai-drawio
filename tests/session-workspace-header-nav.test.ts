import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const SOURCE_PATH = new URL(
  "../app/(internal)/_components/session-workspace.tsx",
  import.meta.url
);

test("session workspace renders a standalone top navigation with breadcrumb and back action", async () => {
  const source = await readFile(SOURCE_PATH, "utf8");

  assert.match(source, /InternalBreadcrumb/);
  assert.match(source, /dataLayout="workspace-breadcrumb"/);
  assert.match(source, /InternalTopNavigation/);
  assert.match(source, /const breadcrumbRoutes = \[/);
  assert.match(source, /breadcrumbName: '首页'/);
  assert.match(source, /breadcrumbName: '工作区详情'/);
  assert.match(source, /router\.push\('\/'\)/);
  assert.match(source, /const handleNavigateBack = \(\): void => \{[\s\S]*router\.push\('\/'\)/);
  assert.match(
    source,
    /<InternalTopNavigation[\s\S]*onBack=\{handleNavigateBack\}[\s\S]*content=\{\s*<div[\s\S]*data-layout="workspace-top-nav-body"[\s\S]*<InternalBreadcrumb[\s\S]*dataLayout="workspace-breadcrumb"[\s\S]*routes=\{breadcrumbRoutes\}/
  );
  assert.match(
    source,
    /data-layout="workspace-top-nav-body"[\s\S]*重命名[\s\S]*更新时间[\s\S]*draw\.io 已就绪/
  );
  assert.doesNotMatch(source, /const renderBreadcrumbItem = \(/);
  assert.doesNotMatch(source, /<Breadcrumb[\s\S]*itemRender=/);
  assert.doesNotMatch(source, /<Breadcrumb\.Item/);
  assert.doesNotMatch(source, /href=\"\/\"/);
  assert.doesNotMatch(source, /返回历史记录/);
  assert.doesNotMatch(source, /会话工作区/);
  assert.doesNotMatch(source, /请先加载一条本地会话，再打开 draw\.io。/);
});
