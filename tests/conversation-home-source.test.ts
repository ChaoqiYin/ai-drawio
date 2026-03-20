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
  assert.match(source, /@arco-design\/web-react\/icon/);
  assert.match(source, /Popconfirm/);
  assert.match(source, /Card/);
  assert.match(source, /Button/);
  assert.match(source, /Tag/);
  assert.match(source, /Typography/);
  assert.match(source, /Modal/);
  assert.match(source, /Input/);
  assert.match(source, /Pagination/);
  assert.match(source, /IconSettings/);
  assert.match(source, /handleDeleteConversation/);
  assert.match(source, /handleClearAllData/);
  assert.match(source, /handleRenameConversation/);
  assert.match(source, /renameDraftTitle/);
  assert.match(source, /renameDialogConversationId/);
  assert.match(source, /loadConversations/);
  assert.match(source, /searchQuery/);
  assert.match(source, /currentPage/);
  assert.match(source, /const PAGE_SIZE = 10/);
  assert.match(source, /consumeHomeRedirectError/);
  assert.match(source, /subscribeConversationChanges/);
  assert.match(source, /updateConversationTitle/);
  assert.match(source, /listConversationSummaryPage/);
  assert.match(source, /getConversationById/);
  assert.match(source, /clearAllAppData/);
  assert.match(source, /useWorkspaceSessionStore/);
  assert.match(source, /navigationTarget/);
  assert.match(source, /shouldSuppressNavigation/);
  assert.match(source, /suppressNavigationForDelete/);
  assert.match(source, /openConversation/);
  assert.match(source, /if \(shouldSuppressNavigation\(\)\) \{/);
  assert.match(source, /enterSessionDetail/);
  assert.match(source, /setNavigationTarget\(conversation\.title\)/);
  assert.match(source, /router\.push\("\/session"\)/);
  assert.doesNotMatch(source, /onOpenSessionTab/);
  assert.doesNotMatch(source, /ConversationHomeProps/);
  assert.match(source, /internal-app-shell/);
  assert.match(source, /px-3! py-3! md:px-5! md:py-5!/);
  assert.match(source, /<div className=\{shellClassName\}>/);
  assert.match(source, /<div className="relative z-\[1\]">/);
  assert.match(source, /internal-page-list-card/);
  assert.match(source, /按标题搜索会话/);
  assert.match(source, /<Pagination/);
  assert.match(source, /accentSurfaceClassName/);
  assert.match(source, /softSurfaceClassName/);
  assert.match(source, /overlaySurfaceClassName/);
  assert.match(source, /data-navigation-overlay="true"/);
  assert.match(source, /const pageCardStyle = \{[\s\S]*borderRadius: 8,/);
  assert.match(source, /const listCardStyle = \{[\s\S]*borderRadius: 8,/);
  assert.match(source, /选择历史会话开启工作区/);
  assert.match(source, /data-layout="home-settings-fab"/);
  assert.match(
    source,
    /className="fixed right-6 bottom-\[16vh\] z-\[12\]" data-layout="home-settings-fab"/
  );
  assert.match(
    source,
    /<Button[\s\S]*icon=\{<IconSettings style=\{\{ display: 'block', fontSize: 20 \}\} \/>\}[\s\S]*aria-label="打开设置"[\s\S]*onClick=\{openSettings\}[\s\S]*><\/Button>/
  );
  assert.match(
    source,
    /<Button[\s\S]*shape="circle"[\s\S]*type="primary"[\s\S]*className="flex! h-10! w-10! items-center! justify-center! rounded-full border-0 bg-\[rgb\(15,23,42\)\]! p-0! shadow-\[0_14px_28px_rgba\(15,23,42,0\.22\)\]"/
  );
  assert.match(
    source,
    /<Card[\s\S]*title=\{\s*<Title heading=\{6\} style=\{\{ margin: 0 \}\}>\s*\{item\.title\}\s*<\/Title>\s*\}[\s\S]*extra=\{\s*<Space size=\{8\}>/
  );
  assert.match(
    source,
    /<Space direction="vertical" size=\{8\} style=\{\{ width: '100%', alignItems: 'stretch' \}\}>[\s\S]*<Text style=\{\{[\s\S]*color: 'var\(--color-text-4\)'[\s\S]*fontSize: 12[\s\S]*fontWeight: 400[\s\S]*\}\}>[\s\S]*formatDate\(item\.updatedAt\)[\s\S]*<\/Text>[\s\S]*<Paragraph/
  );
  assert.doesNotMatch(source, /CLI 集成 \{getCliInstallStatusLabel\(cliInstallStatus\.status\)\}/);
  assert.doesNotMatch(source, /getCliInstallStatus/);
  assert.doesNotMatch(source, /getCliInstallStatusLabel/);
  assert.doesNotMatch(source, /getCliInstallStatusColor/);
  assert.doesNotMatch(source, /tauri-cli-install/);
  assert.doesNotMatch(source, /cli-install-status-presentation/);
  assert.doesNotMatch(source, /const \[cliInstallStatus, setCliInstallStatus\] = useState/);
  assert.doesNotMatch(source, /const \[cliStatusError, setCliStatusError\] = useState/);
  assert.doesNotMatch(source, /data-layout="home-cli-status"/);
  assert.doesNotMatch(source, /data-status=\{cliInstallStatus\.status\}/);
  assert.doesNotMatch(source, /cliInstallStatus\.commandPath/);
  assert.doesNotMatch(source, /data-layout="home-toolbar"/);
  assert.doesNotMatch(
    source,
    /<Card[\s\S]*<div[\s\S]*data-layout="home-settings-fab"/
  );
  assert.doesNotMatch(source, /<Text type="secondary">\{formatDate\(item\.updatedAt\)\}<\/Text>/);
  assert.match(source, /重命名/);
  assert.match(source, /清空全部本地数据/);
  assert.match(source, /删除/);
  assert.doesNotMatch(source, /<Button disabled=\{isNavigating \|\| isClearingAll\} onClick=\{openSettings\}>\s*设置\s*<\/Button>/);
  assert.doesNotMatch(source, /borderRadius: 24,/);
  assert.doesNotMatch(source, /borderRadius: 20,/);
  assert.doesNotMatch(source, /internal-gradient-text/);
  assert.doesNotMatch(source, /linear-gradient/);
  assert.doesNotMatch(source, /radial-gradient/);
  assert.doesNotMatch(source, /本地 AI 历史记录/);
  assert.doesNotMatch(source, /当前桌面壳会将 AI 会话历史仅保存在浏览器 IndexedDB 中/);
  assert.doesNotMatch(source, /先选择一条已保存的 AI 会话，再进入画布工作区/);
  assert.doesNotMatch(source, /bg-\[rgba\(4,8,12,0\.52\)\]/);
  assert.doesNotMatch(source, /<Layout/);
  assert.doesNotMatch(source, /<Content/);
  assert.doesNotMatch(source, /internal-page-hero-card/);
  assert.doesNotMatch(source, /internal-page-section-card/);
  assert.doesNotMatch(source, /internal-page-overlay-card/);
  assert.doesNotMatch(source, /window\.confirm/);
  assert.doesNotMatch(source, /router\.push\(buildSessionHref\(conversationId\)\)/);
  assert.doesNotMatch(source, /listConversations\(/);
});
