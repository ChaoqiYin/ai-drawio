import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const PACKAGED_CLI_SOURCE_PATH = new URL("../src-tauri/src/packaged_cli.rs", import.meta.url);
const SESSION_RUNTIME_SOURCE_PATH = new URL("../src-tauri/src/session_runtime.rs", import.meta.url);

test("session create and open flows do not keep the cli blocked on readiness polling", async () => {
  const [packagedCliSource, sessionRuntimeSource] = await Promise.all([
    readFile(PACKAGED_CLI_SOURCE_PATH, "utf8"),
    readFile(SESSION_RUNTIME_SOURCE_PATH, "utf8"),
  ]);

  assert.match(packagedCliSource, /send_control_request\(&build_session_create_open_request\(session_id\.clone\(\)\)\)\?/);
  assert.doesNotMatch(packagedCliSource, /wait_for_app_running\(Duration::from_millis\(CONTROL_TIMEOUT_MS\)\)\?/);
  assert.doesNotMatch(sessionRuntimeSource, /let readiness_timeout = remaining_total_timeout\(started_at, timeout\)\?/);
  assert.doesNotMatch(sessionRuntimeSource, /wait_for_session_ready\(app, bridge_state, session_id, readiness_timeout\)/);
});
