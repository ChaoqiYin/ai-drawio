import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const CONTROL_SERVER_SOURCE_PATH = new URL("../src-tauri/src/control_server.rs", import.meta.url);
const PACKAGED_CLI_SOURCE_PATH = new URL("../src-tauri/src/packaged_cli.rs", import.meta.url);

test("control transport supports unix domain sockets and explicit control-unreachable errors", async () => {
  const [controlServerSource, packagedCliSource] = await Promise.all([
    readFile(CONTROL_SERVER_SOURCE_PATH, "utf8"),
    readFile(PACKAGED_CLI_SOURCE_PATH, "utf8"),
  ]);

  assert.match(controlServerSource, /UnixListener/);
  assert.match(controlServerSource, /control_socket_path/);
  assert.match(packagedCliSource, /UnixStream/);
  assert.match(packagedCliSource, /CONTROL_UNREACHABLE/);
});
