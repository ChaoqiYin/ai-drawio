import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const TAURI_BRIDGE_PATH = new URL("../app/_lib/tauri-bridge.ts", import.meta.url);
const INTERNAL_TAURI_INVOKE_PATH = new URL("../app/(internal)/_lib/tauri-invoke.ts", import.meta.url);

test("shared tauri bridge exposes an invoke helper backed by the official api package", async () => {
  const [bridgeSource, internalInvokeSource] = await Promise.all([
    readFile(TAURI_BRIDGE_PATH, "utf8"),
    readFile(INTERNAL_TAURI_INVOKE_PATH, "utf8"),
  ]);

  assert.match(bridgeSource, /@tauri-apps\/api\/core/);
  assert.match(bridgeSource, /__AI_DRAWIO_TAURI__/);
  assert.match(bridgeSource, /getRequiredTauriInvoke/);
  assert.match(bridgeSource, /setTauriInvokeBridge/);
  assert.match(internalInvokeSource, /from "\.\.\/\.\.\/_lib\/tauri-bridge\.ts"/);
  assert.match(internalInvokeSource, /export function getTauriInvoke\(\): TauriInvoke \| null/);
});
