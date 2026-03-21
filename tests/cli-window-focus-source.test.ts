import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const SESSION_RUNTIME_SOURCE_PATH = new URL(
  "../src-tauri/src/session_runtime.rs",
  import.meta.url
);

test("cli session runtime does not show the main window for session commands", async () => {
  const sessionRuntimeSource = await readFile(SESSION_RUNTIME_SOURCE_PATH, "utf8");

  const commandFunctions = sessionRuntimeSource.match(
    /pub fn (create_conversation|list_sessions|open_session|close_session)\([\s\S]*?\n\}/g
  );

  assert.ok(commandFunctions, "expected session runtime command functions");

  for (const commandFunction of commandFunctions) {
    assert.doesNotMatch(commandFunction, /show_main_window\(app\)\?/);
    assert.doesNotMatch(commandFunction, /\.show\(\)/);
    assert.doesNotMatch(commandFunction, /\.set_focus\(\)/);
  }
});
