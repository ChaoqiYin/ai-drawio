import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

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
  assert.match(settingsSource, /CLI Integration|CLI 集成/);
  assert.match(settingsSource, /接入终端环境/);
  assert.match(settingsSource, /安装 ai-drawio 命令/);
  assert.match(settingsSource, /重新安装 ai-drawio 命令/);
  assert.match(settingsSource, /ai-drawio status/);
  assert.match(settingsSource, /如果当前终端仍未识别命令，请重新打开终端/);
  assert.match(settingsSource, /getCliInstallStatus/);
  assert.match(settingsSource, /installCliToPath/);
  assert.match(settingsSource, /getCliInstallStatusLabel/);
  assert.match(settingsSource, /getCliInstallStatusColor/);
  assert.match(
    settingsSource,
    /label: "当前状态"[\s\S]*value:\s*<Tag color=\{getCliInstallStatusColor\(status\.status\)\}>[\s\S]*getCliInstallStatusLabel\(status\.status\)[\s\S]*<\/Tag>/
  );
  assert.match(
    settingsSource,
    /label: "终端集成"[\s\S]*value:\s*\([\s\S]*<Tag color=\{status\.targetPath \? "green" : "gray"\}>[\s\S]*status\.targetPath \? "已连接" : "尚未接入"[\s\S]*<\/Tag>/
  );
  assert.doesNotMatch(settingsSource, /function getStatusLabel/);
  assert.doesNotMatch(settingsSource, /function getStatusColor/);
  assert.doesNotMatch(settingsSource, /将 <Text code>\/usr\/local\/bin\/ai-drawio<\/Text> 安装到系统 PATH/);
  assert.doesNotMatch(settingsSource, /const renderBreadcrumbItem = \(/);
  assert.doesNotMatch(settingsSource, /type BreadcrumbRoute = \{/);
  assert.doesNotMatch(settingsSource, /<Space size=\{10\} align="center" wrap>/);
  assert.doesNotMatch(settingsSource, /<Tag color="arcoblue">CLI Integration<\/Tag>/);
  assert.doesNotMatch(settingsSource, /<Text code>hash -r<\/Text>/);
});

test("settings page uses tauri cli install helpers", async () => {
  const helperSource = await readFile(TAURI_CLI_INSTALL_PATH, "utf8");

  assert.match(helperSource, /get_cli_install_status/);
  assert.match(helperSource, /install_cli_to_path/);
  assert.match(
    helperSource,
    /status:\s*"not_installed"\s*\|\s*"installed"\s*\|\s*"installed_other_build"\s*\|\s*"mismatched"\s*\|\s*"error"/
  );
  assert.match(helperSource, /commandInstalled:\s*boolean/);
  assert.match(helperSource, /completionInstalled:\s*boolean/);
  assert.match(helperSource, /__TAURI__\?\.core/);
});
