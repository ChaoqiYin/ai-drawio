import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const MAIN_SOURCE_PATH = new URL("../src-tauri/src/main.rs", import.meta.url);
const BUILD_SOURCE_PATH = new URL("../src-tauri/build.rs", import.meta.url);
const CARGO_TOML_PATH = new URL("../src-tauri/Cargo.toml", import.meta.url);
const TAURI_CONFIG_PATH = new URL("../src-tauri/tauri.conf.json", import.meta.url);
const PACKAGED_CLI_SOURCE_PATH = new URL("../src-tauri/src/packaged_cli.rs", import.meta.url);
const PACKAGE_JSON_PATH = new URL("../package.json", import.meta.url);
const MACOS_APP_ICON_PATH = new URL("../assets/ai-drawio.icns", import.meta.url);
const MACOS_PKG_SCRIPT_PATH = new URL("../scripts/build-macos-cli-pkg.sh", import.meta.url);
const MACOS_POSTINSTALL_PATH = new URL(
  "../src-tauri/pkg/macos/scripts/postinstall",
  import.meta.url
);

test("packaged tauri cli wires plugin, parser, and completion generation", async () => {
  const [mainSource, buildSource, cargoToml, tauriConfig] = await Promise.all([
    readFile(MAIN_SOURCE_PATH, "utf8"),
    readFile(BUILD_SOURCE_PATH, "utf8"),
    readFile(CARGO_TOML_PATH, "utf8"),
    readFile(TAURI_CONFIG_PATH, "utf8")
  ]);

  let packagedCliSource = "";
  try {
    packagedCliSource = await readFile(PACKAGED_CLI_SOURCE_PATH, "utf8");
  } catch {
    packagedCliSource = "";
  }

  assert.match(cargoToml, /tauri-plugin-cli\s*=/);
  assert.match(cargoToml, /clap_complete\s*=/);
  assert.match(mainSource, /mod packaged_cli;/);
  assert.match(mainSource, /tauri_plugin_cli::init/);
  assert.match(mainSource, /packaged_cli::/);
  assert.match(buildSource, /clap_complete/);
  assert.match(buildSource, /generate_to/);
  assert.match(tauriConfig, /"plugins"\s*:\s*\{/);
  assert.match(tauriConfig, /"cli"\s*:/);
  assert.match(tauriConfig, /"document\.apply"/);
  assert.match(packagedCliSource, /document\.svg/);
  assert.match(packagedCliSource, /session open <session-id>|session-id/);
  assert.match(packagedCliSource, /xml-stdin/);
});

test("macOS installer automation registers ai-drawio into PATH", async () => {
  const [packageJson, tauriConfig, pkgScript, postinstallScript, readme] = await Promise.all([
    readFile(PACKAGE_JSON_PATH, "utf8"),
    readFile(TAURI_CONFIG_PATH, "utf8"),
    readFile(MACOS_PKG_SCRIPT_PATH, "utf8"),
    readFile(MACOS_POSTINSTALL_PATH, "utf8"),
    readFile(new URL("../README.md", import.meta.url), "utf8")
  ]);

  assert.match(packageJson, /"build:macos:dmg"\s*:/);
  assert.match(pkgScript, /pkgbuild/);
  assert.match(pkgScript, /--component/);
  assert.match(postinstallScript, /\/usr\/local\/bin\/ai-drawio/);
  assert.match(postinstallScript, /vendor_completions\.d|bash_completion\.d|site-functions/);
  assert.match(tauriConfig, /"targets"\s*:\s*"dmg"|\"targets\"\s*:\s*\[\s*\"dmg\"\s*\]/);
  assert.match(tauriConfig, /"SharedSupport\/cli-completions\/_ai-drawio"/);
  assert.match(tauriConfig, /"SharedSupport\/cli-completions\/ai-drawio\.bash"/);
  assert.match(tauriConfig, /"SharedSupport\/cli-completions\/ai-drawio\.fish"/);
  assert.match(readme, /build:macos:dmg/);
  assert.match(readme, /Install ai-drawio into PATH/);
});

test("macOS dmg bundle sources the packaged app icon from the shared icns asset", async () => {
  const [tauriConfig, macosIcon] = await Promise.all([
    readFile(TAURI_CONFIG_PATH, "utf8"),
    readFile(MACOS_APP_ICON_PATH)
  ]);

  assert.ok(macosIcon.length > 0);
  assert.match(tauriConfig, /"icon"\s*:\s*\[/);
  assert.match(tauriConfig, /\.\.\/assets\/ai-drawio\.icns/);
});
