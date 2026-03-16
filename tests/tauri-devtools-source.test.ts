import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const SOURCE_PATH = new URL("../src-tauri/src/main.rs", import.meta.url);

test("tauri main does not auto-open devtools during startup", async () => {
  const source = await readFile(SOURCE_PATH, "utf8");

  assert.doesNotMatch(source, /open_devtools\(\)/);
});
