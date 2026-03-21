import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const LAYOUT_PATH = new URL("../app/layout.tsx", import.meta.url);
const COMPONENT_PATH = new URL("../app/_components/app-startup-ready.tsx", import.meta.url);
const TAURI_BRIDGE_PATH = new URL("../app/_lib/tauri-bridge.ts", import.meta.url);

test("root layout mounts an app startup ready reporter", async () => {
  const [layoutSource, componentSource, bridgeSource] = await Promise.all([
    readFile(LAYOUT_PATH, "utf8"),
    readFile(COMPONENT_PATH, "utf8"),
    readFile(TAURI_BRIDGE_PATH, "utf8")
  ]);

  assert.match(layoutSource, /AppStartupReady/);
  assert.match(componentSource, /"use client"/);
  assert.match(componentSource, /useEffect/);
  assert.match(componentSource, /getRequiredTauriInvoke/);
  assert.match(componentSource, /app_ready/);
  assert.match(bridgeSource, /@tauri-apps\/api\/core/);
  assert.match(bridgeSource, /__AI_DRAWIO_TAURI__/);
  assert.match(bridgeSource, /getRequiredTauriInvoke/);
});
