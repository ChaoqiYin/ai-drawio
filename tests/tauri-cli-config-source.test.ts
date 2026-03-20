import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const TAURI_CONFIG_PATH = new URL('../src-tauri/tauri.conf.json', import.meta.url);

test('tauri cli plugin config matches the packaged positional command surface', async () => {
  const tauriConfig = JSON.parse(await readFile(TAURI_CONFIG_PATH, 'utf8'));
  const cliPlugin = tauriConfig.plugins?.cli;

  assert.ok(cliPlugin);
  assert.ok(cliPlugin.subcommands?.open);
  assert.ok(cliPlugin.subcommands?.status);
  assert.ok(cliPlugin.subcommands?.conversation?.subcommands?.create);
  assert.ok(cliPlugin.subcommands?.session?.subcommands?.create);
  assert.ok(cliPlugin.subcommands?.session?.subcommands?.list);
  assert.ok(cliPlugin.subcommands?.session?.subcommands?.open);
  assert.ok(cliPlugin.subcommands?.canvas?.subcommands?.['document.get']);
  assert.ok(cliPlugin.subcommands?.canvas?.subcommands?.['document.svg']);
  assert.ok(cliPlugin.subcommands?.canvas?.subcommands?.['document.preview']);
  assert.ok(cliPlugin.subcommands?.canvas?.subcommands?.['document.apply']);
  assert.ok(cliPlugin.subcommands?.canvas?.subcommands?.['document.restore']);

  assert.deepEqual(cliPlugin.subcommands.session.subcommands.open.args, [
    {
      name: 'session-id',
      index: 1,
      required: true
    }
  ]);

  assert.deepEqual(cliPlugin.subcommands.canvas.subcommands['document.get'].args, [
    {
      name: 'session-id',
      index: 1,
      required: true
    },
    {
      name: 'output-file',
      takesValue: true,
      required: false
    }
  ]);

  assert.deepEqual(cliPlugin.subcommands.canvas.subcommands['document.svg'].args, [
    {
      name: 'session-id',
      index: 1,
      required: true
    },
    {
      name: 'output-file',
      takesValue: true,
      required: false
    }
  ]);

  assert.deepEqual(cliPlugin.subcommands.canvas.subcommands['document.preview'].args, [
    {
      name: 'session-id',
      index: 1,
      required: true
    },
    {
      name: 'output-directory',
      index: 2,
      required: true
    },
    {
      name: 'page',
      takesValue: true,
      required: false
    }
  ]);

  assert.deepEqual(cliPlugin.subcommands.canvas.subcommands['document.apply'].args, [
    {
      name: 'session-id',
      index: 1,
      required: true
    },
    {
      name: 'prompt',
      index: 2,
      required: true
    },
    {
      name: 'xml',
      index: 3,
      required: false
    },
    {
      name: 'xml-file',
      takesValue: true,
      required: false
    },
    {
      name: 'xml-stdin',
      takesValue: false,
      required: false
    },
    {
      name: 'base-version',
      takesValue: true,
      required: false
    },
    {
      name: 'output-file',
      takesValue: true,
      required: false
    }
  ]);

  assert.deepEqual(cliPlugin.subcommands.canvas.subcommands['document.restore'].args, [
    {
      name: 'session-id',
      index: 1,
      required: true
    },
    {
      name: 'xml',
      index: 2,
      required: false
    },
    {
      name: 'xml-file',
      takesValue: true,
      required: false
    },
    {
      name: 'xml-stdin',
      takesValue: false,
      required: false
    },
    {
      name: 'base-version',
      takesValue: true,
      required: false
    }
  ]);
});
