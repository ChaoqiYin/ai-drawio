import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const APP_VERSION_HELPER_PATH = new URL(
  "../app/(internal)/_lib/app-version.ts",
  import.meta.url
);

test("app version helper keeps a tauri config fallback without exposing debug-only details", async () => {
  const source = await readFile(APP_VERSION_HELPER_PATH, "utf8");

  assert.match(source, /from "@tauri-apps\/api\/app"/);
  assert.match(source, /import tauriConfig from "\.\.\/\.\.\/\.\.\/src-tauri\/tauri\.conf\.json"/);
  assert.match(source, /const FALLBACK_APP_VERSION = tauriConfig\.version;/);
  assert.doesNotMatch(source, /packageJson/);
  assert.match(source, /export async function getCurrentAppVersion\(\): Promise<string>/);
  assert.match(source, /const runtimeVersion = await getVersion\(\);/);
  assert.match(source, /return FALLBACK_APP_VERSION;/);
  assert.doesNotMatch(source, /AppVersionDetails/);
  assert.doesNotMatch(source, /getCurrentAppVersionDetails/);
});
