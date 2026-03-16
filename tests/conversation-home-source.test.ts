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
  assert.match(source, /openConversation/);
  assert.match(source, /setNavigationTarget\(title\)/);
  assert.match(source, /internal-app-shell/);
  assert.match(source, /px-3! py-3! md:px-5! md:py-5!/);
  assert.match(source, /internal-page-list-card/);
  assert.match(source, /accentSurfaceClassName/);
  assert.match(source, /softSurfaceClassName/);
  assert.match(source, /overlaySurfaceClassName/);
  assert.match(source, /before:bg-\[linear-gradient\(135deg,rgba\(96,165,250,0\.18\)_0%,rgba\(14,165,233,0\.08\)_32%,transparent_64%\),radial-gradient\(circle_at_top_right,rgba\(45,212,191,0\.14\),transparent_34%\)\]/);
  assert.match(source, /bg-\[linear-gradient\(180deg,rgba\(24,30,46,0\.96\)_0%,rgba\(13,17,26,0\.92\)_100%\)\]/);
  assert.match(source, /data-navigation-overlay="true"/);
  assert.match(source, /重命名/);
  assert.match(source, /清空全部本地数据/);
  assert.match(source, /删除/);
  assert.doesNotMatch(source, /internal-page-hero-card/);
  assert.doesNotMatch(source, /internal-page-section-card/);
  assert.doesNotMatch(source, /internal-page-overlay-card/);
  assert.doesNotMatch(source, /window\.confirm/);
});
