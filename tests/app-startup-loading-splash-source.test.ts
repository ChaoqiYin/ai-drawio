import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const TAURI_CONFIG_PATH = new URL("../src-tauri/tauri.conf.json", import.meta.url);
const SPLASH_PAGE_PATH = new URL("../public/splash.html", import.meta.url);

test("startup splash uses a bundled html file instead of a data url", async () => {
  const tauriConfig = await readFile(TAURI_CONFIG_PATH, "utf8");

  assert.match(tauriConfig, /"label"\s*:\s*"splash"/);
  assert.match(tauriConfig, /"url"\s*:\s*"splash\.html"/);
  assert.doesNotMatch(tauriConfig, /"url"\s*:\s*"data:/);
});

test("bundled splash html exists", async () => {
  await access(SPLASH_PAGE_PATH);
});

test("bundled splash html uses the window surface as the only panel", async () => {
  const source = await readFile(SPLASH_PAGE_PATH, "utf8");

  assert.match(source, /background:\s*#ffffff;/);
  assert.match(source, /border:\s*1px solid rgba\(148,\s*163,\s*184,\s*0\.24\);/);
  assert.match(source, /box-shadow:\s*0 16px 40px rgba\(15,\s*23,\s*42,\s*0\.08\);/);
  assert.doesNotMatch(source, /\.card\s*\{/);
  assert.doesNotMatch(source, /class="card"/);
});

test("bundled splash html aligns title and copy spacing with the internal shell typography", async () => {
  const source = await readFile(SPLASH_PAGE_PATH, "utf8");

  assert.match(source, /main\s*\{[\s\S]*display:\s*flex;/);
  assert.match(source, /main\s*\{[\s\S]*flex-direction:\s*column;/);
  assert.match(source, /main\s*\{[\s\S]*gap:\s*10px;/);
  assert.match(source, /h1\s*\{[\s\S]*font-size:\s*20px;/);
  assert.match(source, /h1\s*\{[\s\S]*font-weight:\s*600;/);
  assert.match(source, /p\s*\{[\s\S]*font-size:\s*14px;/);
  assert.match(source, /p\s*\{[\s\S]*line-height:\s*1\.57;/);
});

test("bundled splash html presents startup copy in Chinese", async () => {
  const [tauriConfig, splashSource] = await Promise.all([
    readFile(TAURI_CONFIG_PATH, "utf8"),
    readFile(SPLASH_PAGE_PATH, "utf8"),
  ]);

  assert.match(tauriConfig, /AI Drawio \\u6b63\\u5728\\u542f\\u52a8/);
  assert.match(splashSource, /&#65;&#73; Drawio &#27491;&#22312;&#21551;&#21160;/);
  assert.match(splashSource, /&#27491;&#22312;&#20934;&#22791;&#24037;&#20316;&#21306;&#30028;&#38754;\.\.\./);
});
