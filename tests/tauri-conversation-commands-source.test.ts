import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const CARGO_TOML_PATH = new URL("../src-tauri/Cargo.toml", import.meta.url);
const MAIN_SOURCE_PATH = new URL("../src-tauri/src/main.rs", import.meta.url);

test("tauri conversation storage wires bundled sqlite support", async () => {
  const [cargoToml, mainSource] = await Promise.all([
    readFile(CARGO_TOML_PATH, "utf8"),
    readFile(MAIN_SOURCE_PATH, "utf8"),
  ]);

  assert.match(cargoToml, /rusqlite\s*=\s*\{[\s\S]*bundled/);
  assert.match(mainSource, /mod conversation_db;/);
  assert.match(mainSource, /manage\(conversation_db::ConversationDatabase::new/);
});

test("tauri main registers sqlite-backed conversation commands", async () => {
  const mainSource = await readFile(MAIN_SOURCE_PATH, "utf8");

  assert.match(mainSource, /mod conversation_commands;/);
  assert.match(mainSource, /conversation_commands::list_conversation_summaries/);
  assert.match(mainSource, /conversation_commands::get_conversation/);
  assert.match(mainSource, /conversation_commands::create_conversation/);
  assert.match(mainSource, /conversation_commands::update_conversation_title/);
  assert.match(mainSource, /conversation_commands::append_conversation_message/);
  assert.match(mainSource, /conversation_commands::append_canvas_history_entry/);
  assert.match(mainSource, /conversation_commands::touch_conversation_updated_at/);
  assert.match(mainSource, /conversation_commands::delete_conversation/);
  assert.match(mainSource, /conversation_commands::clear_conversation_data/);
  assert.match(mainSource, /conversation_commands::import_legacy_conversations/);
});
