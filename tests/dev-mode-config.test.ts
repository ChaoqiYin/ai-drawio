import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const PACKAGE_JSON_PATH = new URL("../package.json", import.meta.url);
const TAURI_CONFIG_PATH = new URL("../src-tauri/tauri.conf.json", import.meta.url);
const NEXT_CONFIG_PATH = new URL("../next.config.mjs", import.meta.url);

test("desktop dev mode uses a live Next dev server", async () => {
  const packageJson = JSON.parse(await readFile(PACKAGE_JSON_PATH, "utf8"));
  const tauriConfig = JSON.parse(await readFile(TAURI_CONFIG_PATH, "utf8"));
  const nextConfigSource = await readFile(NEXT_CONFIG_PATH, "utf8");

  assert.equal(
    packageJson.scripts["web:dev"],
    "next dev --hostname 127.0.0.1 --port 3001"
  );
  assert.equal(tauriConfig.build.beforeDevCommand, "npm run web:dev");
  assert.equal(tauriConfig.build.devUrl, "http://127.0.0.1:3001");
  assert.match(nextConfigSource, /process\.env\.NODE_ENV/);
  assert.match(nextConfigSource, /output:\s*"export"/);
  assert.doesNotMatch(nextConfigSource, /^\s*const nextConfig = \{\s*output:\s*"export"/m);
});
