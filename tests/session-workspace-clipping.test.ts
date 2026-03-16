import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const SOURCE_PATH = new URL(
  "../app/(internal)/_components/session-workspace.tsx",
  import.meta.url
);

test("session workspace clips sidebar history and iframe content within rounded containers", async () => {
  const source = await readFile(SOURCE_PATH, "utf8");

  assert.match(source, /className=\{`internal-panel overflow-hidden \$\{sidebarSurfaceClassName\}`\}/);
  assert.match(source, /min-h-0 flex-1 overflow-y-auto pr-1/);
  assert.match(source, /className="internal-panel overflow-hidden"/);
  assert.match(
    source,
    /bodyStyle=\{\{ padding: 0, height: ['"]100%['"], display: ['"]flex['"], overflow: ['"]hidden['"] \}\}/
  );
});
