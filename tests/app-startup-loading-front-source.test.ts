import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const LAYOUT_PATH = new URL("../app/layout.tsx", import.meta.url);
const COMPONENT_PATH = new URL("../app/_components/app-startup-ready.tsx", import.meta.url);

test("root layout mounts an app startup ready reporter", async () => {
  const [layoutSource, componentSource] = await Promise.all([
    readFile(LAYOUT_PATH, "utf8"),
    readFile(COMPONENT_PATH, "utf8")
  ]);

  assert.match(layoutSource, /AppStartupReady/);
  assert.match(componentSource, /"use client"/);
  assert.match(componentSource, /useEffect/);
  assert.match(componentSource, /__TAURI_INTERNALS__/);
  assert.match(componentSource, /__TAURI__\?\.core/);
  assert.match(componentSource, /app_ready/);
});
