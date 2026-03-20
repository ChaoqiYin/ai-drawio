import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const HOME_SOURCE_PATH = new URL(
  "../app/(internal)/_components/conversation-home.tsx",
  import.meta.url
);
const SETTINGS_ROUTE_PATH = new URL(
  "../app/(internal)/settings/page.tsx",
  import.meta.url
);
const SETTINGS_COMPONENT_PATH = new URL(
  "../app/(internal)/_components/settings-page.tsx",
  import.meta.url
);
const TAURI_CLI_INSTALL_PATH = new URL(
  "../app/(internal)/_lib/tauri-cli-install.ts",
  import.meta.url
);

test("home page links to settings and settings page renders cli integration actions", async () => {
  const [homeSource, routeSource, settingsSource] = await Promise.all([
    readFile(HOME_SOURCE_PATH, "utf8"),
    readFile(SETTINGS_ROUTE_PATH, "utf8"),
    readFile(SETTINGS_COMPONENT_PATH, "utf8"),
  ]);

  assert.match(homeSource, /设置/);
  assert.match(homeSource, /router\.push\(["'`]\/settings["'`]\)/);
  assert.match(routeSource, /SettingsPage/);
  assert.match(settingsSource, /useRouter/);
  assert.match(settingsSource, /InternalTopNavigation/);
  assert.match(settingsSource, /InternalBreadcrumb/);
  assert.match(settingsSource, /const handleNavigateBack = \(\): void => \{/);
  assert.match(settingsSource, /router\.push\("\/"\)/);
  assert.match(settingsSource, /<div className=\{shellClassName\}>/);
  assert.match(
    settingsSource,
    /const shellClassName =\s*"internal-app-shell mx-auto flex h-screen min-h-0 min-w-0 w-full flex-col overflow-hidden px-3! py-3! md:px-5! md:py-5!";/
  );
  assert.match(settingsSource, /data-layout="settings-shell-header"/);
  assert.match(settingsSource, /data-layout="settings-body"/);
  assert.match(settingsSource, /data-layout="settings-card-list"/);
  assert.match(sourceSafe(settingsSource), /className="mb-\[14px\]! h-auto shrink-0 bg-transparent p-0" data-layout="settings-shell-header"/);
  assert.match(sourceSafe(settingsSource), /className="relative z-\[1\] flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden" data-layout="settings-body"/);
  assert.match(
    sourceSafe(settingsSource),
    /className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto" data-layout="settings-card-list"/
  );
  assert.match(
    sourceSafe(settingsSource),
    /className="internal-panel bg-transparent shrink-0" data-layout="settings-tray-card"/
  );
  assert.match(settingsSource, /data-layout="settings-top-nav-body"/);
  assert.match(settingsSource, /dataLayout="settings-breadcrumb"/);
  assert.match(settingsSource, /const breadcrumbRoutes:\s*InternalBreadcrumbRoute\[\]\s*=\s*\[/);
  assert.match(settingsSource, /breadcrumbName: "首页"/);
  assert.match(settingsSource, /breadcrumbName: "设置"/);
  assert.match(settingsSource, /router\.push\('\/'\)|router\.push\("\/"\)/);
  assert.match(
    settingsSource,
    /<InternalTopNavigation[\s\S]*content=\{\s*<div[\s\S]*data-layout="settings-top-nav-body"[\s\S]*<InternalBreadcrumb[\s\S]*dataLayout="settings-breadcrumb"[\s\S]*routes=\{breadcrumbRoutes\}/
  );
  assert.match(settingsSource, /getTraySettings/);
  assert.match(settingsSource, /setTrayEnabled/);
  assert.match(settingsSource, /subscribeTrayRuntimeStateChange/);
  assert.match(settingsSource, /TraySettingsState/);
  assert.match(settingsSource, /mainWindowVisible/);
  assert.match(settingsSource, /系统托盘/);
  assert.match(settingsSource, /当前状态：/);
  assert.match(settingsSource, /托盘中/);
  assert.match(settingsSource, /主界面/);
  assert.match(settingsSource, /未启用/);
  assert.match(
    settingsSource,
    /const trayRuntimeStatus = traySettings\.mainWindowVisible\s*\?\s*"当前状态：主界面"\s*:\s*traySettings\.enabled\s*\?\s*"当前状态：托盘中"\s*:\s*"当前状态：未启用";/
  );
  assert.match(settingsSource, /读取托盘状态失败。/);
  assert.match(settingsSource, /更新托盘设置失败。/);
  assert.match(settingsSource, /<Switch/);
  assert.match(settingsSource, /checked=\{traySettings\.enabled\}/);
  assert.match(settingsSource, /loading=\{isTogglingTray\}/);
  assert.match(settingsSource, /onChange=\{handleTrayEnabledChange\}/);
  assert.match(settingsSource, /disabled=\{isLoadingTray \|\| isTogglingTray\}/);
  assert.match(settingsSource, /window\.addEventListener\("focus", handleWindowFocus\)/);
  assert.match(settingsSource, /document\.addEventListener\("visibilitychange", handleVisibilityChange\)/);
  assert.match(settingsSource, /const unsubscribeTrayRuntimeStateChange = subscribeTrayRuntimeStateChange\(\(\) => \{/);
  assert.match(settingsSource, /void loadTrayStatus\(\{ clearError: false \}\);/);
  assert.match(settingsSource, /unsubscribeTrayRuntimeStateChange\(\);/);
  assert.match(settingsSource, /data-layout="settings-tray-card"/);
  assert.match(settingsSource, /data-testid="tray-runtime-status"/);
  assert.doesNotMatch(settingsSource, /label: "托盘状态"/);
  assert.doesNotMatch(settingsSource, /label: "关闭按钮行为"/);
  assert.doesNotMatch(settingsSource, /<Text key=\{trayRenderDebugState\} type="secondary">\s*\{trayRuntimeStatus\}\s*<\/Text>/);
  assert.doesNotMatch(settingsSource, /\[tray-debug\]/);
  assert.doesNotMatch(settingsSource, /debug instance=/);
  assert.doesNotMatch(settingsSource, /render state=/);
  assert.doesNotMatch(settingsSource, /dom text=/);
  assert.doesNotMatch(settingsSource, /CLI Integration|CLI 集成/);
  assert.doesNotMatch(settingsSource, /接入终端环境/);
  assert.doesNotMatch(settingsSource, /安装 ai-drawio 命令/);
  assert.doesNotMatch(settingsSource, /重新安装 ai-drawio 命令/);
  assert.doesNotMatch(settingsSource, /ai-drawio status/);
  assert.doesNotMatch(settingsSource, /如果当前终端仍未识别命令，请重新打开终端/);
  assert.doesNotMatch(settingsSource, /getCliInstallStatus/);
  assert.doesNotMatch(settingsSource, /installCliToPath/);
  assert.doesNotMatch(settingsSource, /getCliInstallStatusLabel/);
  assert.doesNotMatch(settingsSource, /getCliInstallStatusColor/);
  assert.doesNotMatch(settingsSource, /data-layout="settings-cli-card"/);
  assert.doesNotMatch(settingsSource, /function getStatusLabel/);
  assert.doesNotMatch(settingsSource, /function getStatusColor/);
  assert.doesNotMatch(settingsSource, /<Layout/);
  assert.doesNotMatch(settingsSource, /<Header/);
  assert.doesNotMatch(settingsSource, /<Content/);
  assert.doesNotMatch(settingsSource, /将 <Text code>\/usr\/local\/bin\/ai-drawio<\/Text> 安装到系统 PATH/);
  assert.doesNotMatch(settingsSource, /const renderBreadcrumbItem = \(/);
  assert.doesNotMatch(settingsSource, /type BreadcrumbRoute = \{/);
  assert.doesNotMatch(settingsSource, /<Space size=\{10\} align="center" wrap>/);
  assert.doesNotMatch(settingsSource, /<Tag color="arcoblue">CLI Integration<\/Tag>/);
  assert.doesNotMatch(settingsSource, /<Text code>hash -r<\/Text>/);
});

test("settings page no longer depends on tauri cli install helpers", async () => {
  const settingsSource = await readFile(SETTINGS_COMPONENT_PATH, "utf8");

  await assert.rejects(() => access(TAURI_CLI_INSTALL_PATH));
  assert.doesNotMatch(settingsSource, /tauri-cli-install/);
  assert.doesNotMatch(settingsSource, /CliInstallStatus/);
  assert.doesNotMatch(settingsSource, /CliInstallResult/);
});

function sourceSafe(source: string): string {
  return source.replace(/\s+/g, " ");
}
