import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const SOURCE_PATH = new URL(
  "../app/(internal)/_components/conversation-home.tsx",
  import.meta.url
);

test("conversation home source includes delete actions", async () => {
  const source = await readFile(SOURCE_PATH, "utf8");

  assert.match(source, /@arco-design\/web-react/);
  assert.match(source, /Popconfirm/);
  assert.match(source, /Card/);
  assert.match(source, /Button/);
  assert.match(source, /Typography/);
  assert.match(source, /Modal/);
  assert.match(source, /Input/);
  assert.match(source, /handleDeleteConversation/);
  assert.match(source, /handleClearAllData/);
  assert.match(source, /handleRenameConversation/);
  assert.match(source, /renameDraftTitle/);
  assert.match(source, /renameDialogConversationId/);
  assert.match(source, /loadConversations/);
  assert.match(source, /consumeHomeRedirectError/);
  assert.match(source, /subscribeConversationChanges/);
  assert.match(source, /updateConversationTitle/);
  assert.match(source, /navigationTarget/);
  assert.match(source, /shouldSuppressNavigation/);
  assert.match(source, /suppressNavigationForDelete/);
  assert.match(source, /openConversation/);
  assert.match(source, /if \(shouldSuppressNavigation\(\)\) \{/);
  assert.match(source, /setNavigationTarget\(title\)/);
  assert.match(source, /internal-app-shell/);
  assert.match(source, /px-3! py-3! md:px-5! md:py-5!/);
  assert.match(source, /internal-page-list-card/);
  assert.match(source, /accentSurfaceClassName/);
  assert.match(source, /softSurfaceClassName/);
  assert.match(source, /overlaySurfaceClassName/);
  assert.match(source, /data-navigation-overlay="true"/);
  assert.match(source, /const pageCardStyle = \{[\s\S]*borderRadius: 8,/);
  assert.match(source, /const listCardStyle = \{[\s\S]*borderRadius: 8,/);
  assert.match(source, /选择历史会话开启工作区/);
  assert.match(source, /重命名/);
  assert.match(source, /清空全部本地数据/);
  assert.match(source, /删除/);
  assert.doesNotMatch(source, /borderRadius: 24,/);
  assert.doesNotMatch(source, /borderRadius: 20,/);
  assert.doesNotMatch(source, /internal-gradient-text/);
  assert.doesNotMatch(source, /linear-gradient/);
  assert.doesNotMatch(source, /radial-gradient/);
  assert.doesNotMatch(source, /本地 AI 历史记录/);
  assert.doesNotMatch(source, /当前桌面壳会将 AI 会话历史仅保存在浏览器 IndexedDB 中/);
  assert.doesNotMatch(source, /先选择一条已保存的 AI 会话，再进入画布工作区/);
  assert.doesNotMatch(source, /bg-\[rgba\(4,8,12,0\.52\)\]/);
  assert.doesNotMatch(source, /internal-page-hero-card/);
  assert.doesNotMatch(source, /internal-page-section-card/);
  assert.doesNotMatch(source, /internal-page-overlay-card/);
  assert.doesNotMatch(source, /window\.confirm/);
});
