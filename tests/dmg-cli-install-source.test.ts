import assert from "node:assert/strict";
import test from "node:test";
import { access, readFile } from "node:fs/promises";

const MAIN_SOURCE_PATH = new URL("../src-tauri/src/main.rs", import.meta.url);
const CLI_INSTALL_SOURCE_PATH = new URL("../src-tauri/src/cli_path_install.rs", import.meta.url);
const TAURI_CONFIG_PATH = new URL("../src-tauri/tauri.conf.json", import.meta.url);
const BUILD_SOURCE_PATH = new URL("../src-tauri/build.rs", import.meta.url);
const PACKAGE_JSON_PATH = new URL("../package.json", import.meta.url);
const README_PATH = new URL("../README.md", import.meta.url);
const INSTALL_SCRIPT_PATH = new URL(
  "../src-tauri/resources/macos/install-cli-to-path.sh",
  import.meta.url
);

test("tauri exposes dmg cli install commands and bundles install resources", async () => {
  const [mainSource, cliInstallSource, configSource, buildSource, packageJson, readme, installSource] =
    await Promise.all([
      readFile(MAIN_SOURCE_PATH, "utf8"),
      readFile(CLI_INSTALL_SOURCE_PATH, "utf8"),
      readFile(TAURI_CONFIG_PATH, "utf8"),
      readFile(BUILD_SOURCE_PATH, "utf8"),
      readFile(PACKAGE_JSON_PATH, "utf8"),
      readFile(README_PATH, "utf8"),
      readFile(INSTALL_SCRIPT_PATH, "utf8"),
    ]);

  assert.match(mainSource, /mod cli_path_install;/);
  assert.match(mainSource, /get_cli_install_status/);
  assert.match(mainSource, /install_cli_to_path/);
  assert.match(cliInstallSource, /osascript/);
  assert.match(cliInstallSource, /\/usr\/local\/bin\/ai-drawio/);
  assert.match(configSource, /"targets"\s*:\s*"dmg"|\"targets\"\s*:\s*\[\s*\"dmg\"\s*\]/);
  assert.match(configSource, /install-cli-to-path\.sh/);
  assert.match(configSource, /"SharedSupport\/cli-completions\/_ai-drawio"/);
  assert.match(buildSource, /generate_to/);
  assert.match(packageJson, /"build"\s*:\s*"[^"]*tauri build"/);
  assert.match(readme, /Install ai-drawio into PATH/);
  assert.match(installSource, /\/usr\/local\/bin\/ai-drawio/);
});

test("macOS dmg build route uses the direct tauri bundler command without a wrapper script", async () => {
  const packageJson = await readFile(PACKAGE_JSON_PATH, "utf8");

  await assert.rejects(() => access(new URL("../scripts/build-macos-cli-dmg.sh", import.meta.url)));
  assert.doesNotMatch(packageJson, /"build:macos:dmg"\s*:/);
  assert.match(packageJson, /"build"\s*:\s*"[^"]*tauri build"/);
});
