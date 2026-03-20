import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const SOURCE_PATH = new URL(
  "../app/(internal)/_components/internal-top-navigation.tsx",
  import.meta.url
);

test("internal top navigation exposes a permanent back button and caller-provided content region", async () => {
  const source = await readFile(SOURCE_PATH, "utf8");

  assert.match(source, /type InternalTopNavigationProps = \{/);
  assert.match(source, /content: ReactNode/);
  assert.match(source, /actions\?: ReactNode/);
  assert.match(source, /onBack\?: \(\) => void/);
  assert.match(source, /backLabel\?: string/);
  assert.match(source, /const handleBack = \(\): void => \{/);
  assert.match(source, /if \(onBack\) \{/);
  assert.match(source, /window\.history\.length > 1/);
  assert.match(source, /window\.history\.back\(\)/);
  assert.match(source, /<Button type="primary" size="mini" icon=\{<IconLeft \/>\} onClick=\{handleBack\}>/);
  assert.match(source, /backLabel \?\? '返回'/);
  assert.match(source, /data-layout="workspace-top-nav"/);
  assert.match(source, /data-layout="workspace-top-nav-content"/);
  assert.match(source, /data-layout="workspace-top-nav-actions"/);
});
