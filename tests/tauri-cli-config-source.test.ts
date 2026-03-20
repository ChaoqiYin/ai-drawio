import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const TAURI_CONFIG_PATH = new URL('../src-tauri/tauri.conf.json', import.meta.url);
const CARGO_TOML_PATH = new URL('../src-tauri/Cargo.toml', import.meta.url);
const MAIN_SOURCE_PATH = new URL('../src-tauri/src/main.rs', import.meta.url);

test('rust cli dispatch does not rely on tauri plugin cli config', async () => {
  const [tauriConfigText, cargoToml, mainSource] = await Promise.all([
    readFile(TAURI_CONFIG_PATH, 'utf8'),
    readFile(CARGO_TOML_PATH, 'utf8'),
    readFile(MAIN_SOURCE_PATH, 'utf8')
  ]);

  const tauriConfig = JSON.parse(tauriConfigText);

  assert.equal(tauriConfig.plugins?.cli, undefined);
  assert.doesNotMatch(cargoToml, /tauri-plugin-cli\s*=/);
  assert.match(mainSource, /packaged_cli::maybe_run_from_env/);
  assert.doesNotMatch(mainSource, /tauri_plugin_cli::init/);
});
