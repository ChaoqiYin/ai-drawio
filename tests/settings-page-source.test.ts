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
  assert.match(settingsSource, /CLI Integration|CLI 集成/);
  assert.match(settingsSource, /Install ai-drawio into PATH/);
  assert.match(settingsSource, /Reinstall ai-drawio into PATH/);
  assert.match(settingsSource, /未安装/);
  assert.match(settingsSource, /已安装/);
  assert.match(settingsSource, /安装目标异常/);
  assert.match(settingsSource, /ai-drawio status/);
  assert.match(settingsSource, /hash -r/);
  assert.match(settingsSource, /getCliInstallStatus/);
  assert.match(settingsSource, /installCliToPath/);
});

test("settings page uses tauri cli install helpers", async () => {
  const helperSource = await readFile(TAURI_CLI_INSTALL_PATH, "utf8");

  assert.match(helperSource, /get_cli_install_status/);
  assert.match(helperSource, /install_cli_to_path/);
  assert.match(helperSource, /status:\s*"not_installed"\s*\|\s*"installed"\s*\|\s*"mismatched"\s*\|\s*"error"/);
  assert.match(helperSource, /commandInstalled:\s*boolean/);
  assert.match(helperSource, /completionInstalled:\s*boolean/);
  assert.match(helperSource, /__TAURI__\?\.core/);
});
