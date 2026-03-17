import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const MAIN_SOURCE_PATH = new URL("../src-tauri/src/main.rs", import.meta.url);
const TAURI_CONFIG_PATH = new URL("../src-tauri/tauri.conf.json", import.meta.url);

test("tauri startup defines a splash loading lifecycle", async () => {
  const [mainSource, tauriConfig] = await Promise.all([
    readFile(MAIN_SOURCE_PATH, "utf8"),
    readFile(TAURI_CONFIG_PATH, "utf8")
  ]);

  assert.match(tauriConfig, /"label"\s*:\s*"splash"/);
  assert.match(mainSource, /fn app_ready/);
  assert.match(mainSource, /get_webview_window\("main"\)/);
  assert.match(mainSource, /get_webview_window\("splash"\)/);
  assert.match(mainSource, /\.show\(\)/);
  assert.match(mainSource, /\.close\(\)/);
});
