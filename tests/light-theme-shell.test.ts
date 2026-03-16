import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const GLOBALS_PATH = new URL("../app/globals.css", import.meta.url);
const HOME_PATH = new URL("../app/(internal)/_components/conversation-home.tsx", import.meta.url);
const WORKSPACE_PATH = new URL("../app/(internal)/_components/session-workspace.tsx", import.meta.url);

test("shell globals define a transparent page background with white card surfaces", async () => {
  const source = await readFile(GLOBALS_PATH, "utf8");

  assert.match(source, /body\s*\{[\s\S]*background:\s*transparent;/);
  assert.match(source, /--internal-surface-base:\s*rgba\(255,\s*255,\s*255,\s*0\.96\)/);
  assert.match(source, /--internal-surface-muted:\s*rgba\(248,\s*250,\s*252,\s*0\.96\)/);
  assert.match(source, /\.internal-panel\s*\{[\s\S]*border-radius:\s*8px;[\s\S]*background:\s*var\(--internal-surface-base\);/);
  assert.match(source, /\.internal-page-list-card\s*\{[\s\S]*border-radius:\s*8px;[\s\S]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.98\);/);
  assert.match(source, /\.internal-message-card\s*\{[\s\S]*border-radius:\s*8px;[\s\S]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.98\);/);
  assert.doesNotMatch(source, /\.internal-gradient-text/);
  assert.doesNotMatch(source, /linear-gradient/);
  assert.doesNotMatch(source, /radial-gradient/);
  assert.doesNotMatch(source, /linear-gradient\(180deg,\s*#07111b 0%,\s*#0a1421 44%,\s*#091019 100%\)/);
});

test("home page overlay no longer uses a dark blocking backdrop", async () => {
  const source = await readFile(HOME_PATH, "utf8");

  assert.doesNotMatch(source, /bg-\[rgba\(4,8,12,0\.52\)\]/);
});

test("session workspace no longer forces dark shell chrome", async () => {
  const source = await readFile(WORKSPACE_PATH, "utf8");

  assert.doesNotMatch(source, /internal-gradient-text/);
  assert.doesNotMatch(source, /linear-gradient/);
  assert.doesNotMatch(source, /radial-gradient/);
  assert.doesNotMatch(source, /theme="dark"/);
  assert.doesNotMatch(source, /bg-\[#0b1117\]/);
  assert.doesNotMatch(source, /rgba\(15,23,42,0\.72\)/);
});
