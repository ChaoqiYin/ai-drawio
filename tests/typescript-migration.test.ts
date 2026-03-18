import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

async function exists(path) {
  try {
    await access(new URL(`../${path}`, import.meta.url));
    return true;
  } catch {
    return false;
  }
}

test("project source files follow the ts and tsx migration rules", async () => {
  assert.equal(await exists("tsconfig.json"), true);
  assert.equal(await exists("app/layout.tsx"), true);
  assert.equal(await exists("app/(internal)/page.tsx"), true);
  assert.equal(await exists("app/(internal)/session/page.tsx"), true);
  assert.equal(await exists("app/(internal)/_components/conversation-home.tsx"), true);
  assert.equal(await exists("app/(internal)/_components/session-workspace.tsx"), true);
  assert.equal(await exists("app/(internal)/_lib/conversation-model.ts"), true);
  assert.equal(await exists("app/(internal)/_lib/conversation-store.ts"), true);
  assert.equal(await exists("scripts/prepare-drawio.ts"), true);
  assert.equal(await exists("scripts/ai-drawio-cli.ts"), false);
  assert.equal(await exists("tests/conversation-model.test.ts"), true);
  assert.equal(await exists("tests/typescript-migration.test.ts"), true);

  assert.equal(await exists("app/layout.js"), false);
  assert.equal(await exists("app/(internal)/page.js"), false);
  assert.equal(await exists("app/(internal)/session/page.js"), false);
  assert.equal(await exists("scripts/prepare-drawio.mjs"), false);
  assert.equal(await exists("scripts/ai-drawio-cli.mjs"), false);

  const packageJson = await readFile(new URL("../package.json", import.meta.url), "utf8");
  assert.match(packageJson, /--experimental-strip-types/);
});
