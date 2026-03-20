import assert from "node:assert/strict";
import test from "node:test";
import { access, readFile } from "node:fs/promises";

const MAIN_SOURCE_PATH = new URL("../src-tauri/src/main.rs", import.meta.url);
const BUILD_SOURCE_PATH = new URL("../src-tauri/build.rs", import.meta.url);
const CARGO_TOML_PATH = new URL("../src-tauri/Cargo.toml", import.meta.url);
const TAURI_CONFIG_PATH = new URL("../src-tauri/tauri.conf.json", import.meta.url);
const PACKAGED_CLI_SOURCE_PATH = new URL("../src-tauri/src/packaged_cli.rs", import.meta.url);
const CLI_SCHEMA_SOURCE_PATH = new URL("../src-tauri/src/cli_schema.rs", import.meta.url);
const PACKAGE_JSON_PATH = new URL("../package.json", import.meta.url);
const MACOS_APP_ICON_PATH = new URL("../assets/ai-drawio.icns", import.meta.url);

test("packaged tauri cli wires plugin, parser, and completion generation", async () => {
  const [mainSource, buildSource, cargoToml, tauriConfig, cliSchemaSource] = await Promise.all([
    readFile(MAIN_SOURCE_PATH, "utf8"),
    readFile(BUILD_SOURCE_PATH, "utf8"),
    readFile(CARGO_TOML_PATH, "utf8"),
    readFile(TAURI_CONFIG_PATH, "utf8"),
    readFile(CLI_SCHEMA_SOURCE_PATH, "utf8")
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
  assert.match(cliSchemaSource, /Command::new\("open"\)/);
  assert.match(
    cliSchemaSource,
    /Arg::new\("mode"\)[\s\S]*\.long\("mode"\)[\s\S]*\.value_name\("mode"\)[\s\S]*\.default_value\("tray"\)/
  );
  assert.match(packagedCliSource, /document\.svg/);
  assert.match(packagedCliSource, /document\.preview/);
  assert.match(packagedCliSource, /\bOpenMode::Tray\b/);
  assert.match(packagedCliSource, /\bOpenMode::Window\b/);
  assert.match(packagedCliSource, /session open <session-id>|session-id/);
  assert.match(packagedCliSource, /xml-stdin/);
  assert.match(packagedCliSource, /\bPackagedCliCommand::Open\b/);
  assert.match(packagedCliSource, /STARTUP_MODE_ENV_VAR/);
  assert.match(packagedCliSource, /std::env::current_exe/);
  assert.match(packagedCliSource, /Command::new\(current_exe\)/);
});

test("package scripts keep direct tauri build entrypoints without wrapper shell scripts", async () => {
  const [packageJson, tauriConfig, readme] = await Promise.all([
    readFile(PACKAGE_JSON_PATH, "utf8"),
    readFile(TAURI_CONFIG_PATH, "utf8"),
    readFile(new URL("../README.md", import.meta.url), "utf8")
  ]);

  await assert.rejects(() => access(new URL("../scripts/build-macos-cli-dmg.sh", import.meta.url)));
  await assert.rejects(() => access(new URL("../scripts/build-macos-cli-pkg.sh", import.meta.url)));
  await assert.rejects(() => access(new URL("../scripts/ai-drawio-cli.ts", import.meta.url)));
  assert.doesNotMatch(packageJson, /"build:macos:dmg"\s*:/);
  assert.doesNotMatch(packageJson, /"build:macos:pkg"\s*:/);
  assert.doesNotMatch(packageJson, /"bin"\s*:\s*\{/);
  assert.doesNotMatch(packageJson, /"cli"\s*:\s*"node --experimental-strip-types \.\/scripts\/ai-drawio-cli\.ts"/);
  assert.match(packageJson, /"build"\s*:\s*"[^"]*tauri build"/);
  assert.match(tauriConfig, /"targets"\s*:\s*"dmg"|\"targets\"\s*:\s*\[\s*\"dmg\"\s*\]/);
  assert.match(tauriConfig, /"SharedSupport\/cli-completions\/_ai-drawio"/);
  assert.match(tauriConfig, /"SharedSupport\/cli-completions\/ai-drawio\.bash"/);
  assert.match(tauriConfig, /"SharedSupport\/cli-completions\/ai-drawio\.fish"/);
  assert.match(readme, /npm run build -- --bundles dmg/);
  assert.match(readme, /Install ai-drawio into PATH/);
  assert.match(readme, /ai-drawio session create/);
  assert.match(readme, /ai-drawio session open <session-id>/);
  assert.match(readme, /ai-drawio canvas document\.get <session-id>/);
  assert.match(readme, /ai-drawio canvas document\.preview <session-id> <output-directory>/);
  assert.match(readme, /ai-drawio canvas document\.preview <session-id> <output-directory> --page <page-number>/);
  assert.match(readme, /ai-drawio canvas document\.apply <session-id> <prompt>/);
  assert.doesNotMatch(readme, /session open --title/);
  assert.doesNotMatch(readme, /canvas document\.get --session/);
  assert.match(readme, /ai-drawio open/);
  assert.match(readme, /ai-drawio open --mode window/);
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
