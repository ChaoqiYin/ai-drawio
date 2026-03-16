import test from "node:test";
import assert from "node:assert/strict";

import { getDrawioCopyPlan } from "../scripts/prepare-drawio.ts";

test("getDrawioCopyPlan maps webapp into public drawio", () => {
  const plan = getDrawioCopyPlan("/repo-root");

  assert.equal(plan.sourceDir, "/repo-root/webapp");
  assert.equal(plan.targetDir, "/repo-root/public/drawio");
});
