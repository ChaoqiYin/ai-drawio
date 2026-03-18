import test from "node:test";
import assert from "node:assert/strict";

import { buildCanvasHistoryLabel } from "../app/(internal)/_lib/canvas-history-label.ts";

test("buildCanvasHistoryLabel keeps an explicit non-generic summary label", () => {
  assert.equal(
    buildCanvasHistoryLabel({
      fallbackLabel: "快照",
      historyLabel: "为审批节点补充失败分支",
      prompt: "把审批流里失败回退补上"
    }),
    "为审批节点补充失败分支"
  );
});

test("buildCanvasHistoryLabel falls back to the user prompt when the label is generic", () => {
  assert.equal(
    buildCanvasHistoryLabel({
      fallbackLabel: "快照",
      historyLabel: "快照",
      prompt: "detailed-design.md 用drawio绘制里面的mermaid图形"
    }),
    "detailed-design.md 用drawio绘制里面的mermaid图形"
  );
});

test("buildCanvasHistoryLabel falls back to the default label when neither summary nor prompt exists", () => {
  assert.equal(
    buildCanvasHistoryLabel({
      fallbackLabel: "快照",
      historyLabel: "   ",
      prompt: "   "
    }),
    "快照"
  );
});
