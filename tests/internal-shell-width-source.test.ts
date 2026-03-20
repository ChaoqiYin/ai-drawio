import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const INTERNAL_SHELL_SOURCE_PATHS = [
  new URL("../app/(internal)/_components/conversation-home.tsx", import.meta.url),
  new URL("../app/(internal)/_components/session-tabs-shell.tsx", import.meta.url),
  new URL("../app/(internal)/_components/settings-page.tsx", import.meta.url),
];

test("internal app shells do not cap page width with a 1480px max width", async () => {
  const sources = await Promise.all(
    INTERNAL_SHELL_SOURCE_PATHS.map((sourcePath) => readFile(sourcePath, "utf8"))
  );

  for (const source of sources) {
    assert.match(source, /internal-app-shell/);
    assert.match(source, /w-full/);
    assert.doesNotMatch(source, /max-w-\[1480px\]/);
  }
});
