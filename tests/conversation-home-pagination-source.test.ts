import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const SOURCE_PATH = new URL(
  "../app/(internal)/_components/conversation-home.tsx",
  import.meta.url,
);

test("conversation home uses paginated summary queries and title search", async () => {
  const source = await readFile(SOURCE_PATH, "utf8");

  assert.match(source, /const PAGE_SIZE = 10/);
  assert.match(source, /listConversationSummaryPage\(\{/);
  assert.match(source, /searchQuery: normalizedSearchQuery/);
  assert.match(source, /page: currentPage/);
  assert.match(source, /pageSize: PAGE_SIZE/);
  assert.match(source, /setCurrentPage\(1\)/);
  assert.match(source, /data-layout="home-right-panel"/);
  assert.match(source, /data-layout="home-list-controls"/);
  assert.match(source, /data-layout="home-list-toolbar"/);
  assert.match(source, /data-layout="home-list-toolbar-actions"/);
  assert.match(source, /data-layout="home-list-pagination"/);
  assert.match(source, /data-layout="home-list-viewport"/);
  assert.match(source, /placeholder="按标题搜索会话"/);
  assert.match(source, /showTotal/);
  assert.match(
    source,
    /placeholder="按标题搜索会话"[\s\S]*data-layout="home-list-toolbar-actions"[\s\S]*data-layout="home-list-pagination"[\s\S]*data-layout="home-list-viewport"/,
  );
});
