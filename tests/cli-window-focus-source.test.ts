import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const SESSION_RUNTIME_SOURCE_PATH = new URL(
  "../src-tauri/src/session_runtime.rs",
  import.meta.url
);

test("cli session runtime shows the main window without forcing focus", async () => {
  const sessionRuntimeSource = await readFile(SESSION_RUNTIME_SOURCE_PATH, "utf8");

  const showWindowFunction = sessionRuntimeSource.match(
    /pub fn show_main_window\(app: &AppHandle\) -> Result<\(\), ControlError> \{[\s\S]*?\n\}/
  );

  assert.ok(showWindowFunction, "expected a dedicated show_main_window helper");
  assert.match(showWindowFunction[0], /\.show\(\)/);
  assert.doesNotMatch(showWindowFunction[0], /\.set_focus\(\)/);
});
