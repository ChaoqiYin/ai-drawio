import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const CLI_SCHEMA_PATH = new URL('../src-tauri/src/cli_schema.rs', import.meta.url);
const CONTROL_PROTOCOL_PATH = new URL('../src-tauri/src/control_protocol.rs', import.meta.url);
const CONTROL_SERVER_PATH = new URL('../src-tauri/src/control_server.rs', import.meta.url);
const DOCUMENT_BRIDGE_PATH = new URL('../src-tauri/src/document_bridge.rs', import.meta.url);
const PACKAGED_CLI_PATH = new URL('../src-tauri/src/packaged_cli.rs', import.meta.url);

test('cli and control bridge no longer expose an orthogonal layout command', async () => {
  const [
    cliSchemaSource,
    controlProtocolSource,
    controlServerSource,
    documentBridgeSource,
    packagedCliSource,
  ] = await Promise.all([
    readFile(CLI_SCHEMA_PATH, 'utf8'),
    readFile(CONTROL_PROTOCOL_PATH, 'utf8'),
    readFile(CONTROL_SERVER_PATH, 'utf8'),
    readFile(DOCUMENT_BRIDGE_PATH, 'utf8'),
    readFile(PACKAGED_CLI_PATH, 'utf8'),
  ]);

  assert.doesNotMatch(cliSchemaSource, /Command::new\("layout\.orthogonal"\)/);
  assert.doesNotMatch(cliSchemaSource, /Apply ELK orthogonal layout/i);

  assert.doesNotMatch(controlProtocolSource, /CanvasLayoutOrthogonal/);
  assert.doesNotMatch(controlProtocolSource, /"canvas\.layout\.orthogonal"/);

  assert.doesNotMatch(controlServerSource, /CommandKind::CanvasLayoutOrthogonal/);
  assert.doesNotMatch(controlServerSource, /document_bridge::apply_orthogonal_layout/);

  assert.doesNotMatch(documentBridgeSource, /pub fn apply_orthogonal_layout/);
  assert.doesNotMatch(documentBridgeSource, /applyOrthogonalLayout\(\)/);

  assert.doesNotMatch(packagedCliSource, /CanvasLayoutOrthogonal/);
  assert.doesNotMatch(packagedCliSource, /Some\(\("layout\.orthogonal"/);
  assert.doesNotMatch(packagedCliSource, /"canvas\.layout\.orthogonal"/);
});
