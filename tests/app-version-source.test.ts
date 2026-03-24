import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const APP_VERSION_HELPER_PATH = new URL(
  "../app/(internal)/_lib/app-version.ts",
  import.meta.url
);

test("app version helper exposes version source details and keeps a tauri config fallback", async () => {
  const source = await readFile(APP_VERSION_HELPER_PATH, "utf8");

  assert.match(source, /from "@tauri-apps\/api\/app"/);
  assert.match(source, /import tauriConfig from "\.\.\/\.\.\/\.\.\/src-tauri\/tauri\.conf\.json"/);
  assert.match(source, /const FALLBACK_APP_VERSION = tauriConfig\.version;/);
  assert.doesNotMatch(source, /packageJson/);
  assert.match(source, /export type AppVersionDetails = \{/);
  assert.match(source, /source: "tauri-runtime" \| "tauri-config";/);
  assert.match(source, /error: string \| null;/);
  assert.match(source, /export async function getCurrentAppVersionDetails\(\): Promise<AppVersionDetails>/);
  assert.match(source, /source: "tauri-runtime"/);
  assert.match(source, /source: "tauri-config"/);
  assert.match(source, /error: nextError instanceof Error \? nextError\.message : "unknown-error"/);
  assert.match(source, /export async function getCurrentAppVersion\(\): Promise<string>/);
  assert.match(source, /const versionDetails = await getCurrentAppVersionDetails\(\);/);
  assert.match(source, /return versionDetails\.version;/);
});
