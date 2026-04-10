import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const SOURCE_PATH = new URL("../app/(internal)/_components/session-workspace.tsx", import.meta.url);

test("session workspace waits for drawio init before bootstrapping the embed protocol", async () => {
  const source = await readFile(SOURCE_PATH, "utf8");

  assert.match(
    source,
    /const DRAWIO_EMBED_PATH = '\/drawio\/index\.html\?embed=1&proto=json&spin=1&noSaveBtn=1&noExitBtn=1&saveAndExit=0&lang=zh';/
  );
  assert.match(source, /message\.event === 'init'/);
  assert.match(source, /void bootstrapFrameBridge\(\)/);
  assert.doesNotMatch(source, /void bridge\.bootstrapFrame\?\.\(\)/);
});
