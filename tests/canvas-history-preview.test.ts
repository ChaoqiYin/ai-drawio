import test from "node:test";
import assert from "node:assert/strict";

import {
  buildBlankCanvasHistoryPreviewPages,
  normalizeCanvasHistoryPreviewPages
} from "../app/(internal)/_lib/canvas-history-preview.ts";

test("normalizeCanvasHistoryPreviewPages keeps valid preview pages and fills fallback names", () => {
  const pages = normalizeCanvasHistoryPreviewPages([
    {
      id: "page-1",
      name: "Overview",
      svgDataUri: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
    },
    {
      id: "page-2",
      name: "   ",
      svgDataUri: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
    },
  ]);

  assert.equal(pages.length, 2);
  assert.deepEqual(pages[0], {
    id: "page-1",
    name: "Overview",
    svgDataUri: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
  });
  assert.equal(pages[1].name, "Page 2");
});

test("normalizeCanvasHistoryPreviewPages rejects invalid preview payloads", () => {
  assert.throws(
    () =>
      normalizeCanvasHistoryPreviewPages([
        {
          id: "",
          name: "Broken",
          svgDataUri: "not-a-data-uri",
        },
      ]),
    /preview/i,
  );
});

test("buildBlankCanvasHistoryPreviewPages returns a restorable empty-canvas preview", () => {
  const pages = buildBlankCanvasHistoryPreviewPages();

  assert.equal(pages.length, 1);
  assert.equal(pages[0].id, "page-1");
  assert.equal(pages[0].name, "Blank Canvas");
  assert.match(pages[0].svgDataUri, /^data:image\/svg\+xml/);
});
