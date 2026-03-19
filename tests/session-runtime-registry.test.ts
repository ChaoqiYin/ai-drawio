import test from "node:test";
import assert from "node:assert/strict";

import {
  getSessionRuntime,
  getSessionStatus,
  listOpenSessions,
  registerSessionRuntime,
  resetSessionRuntimeRegistryForTests,
  runSessionDocumentAction,
  unregisterSessionRuntime,
} from "../app/(internal)/_lib/session-runtime-registry.ts";

test("session runtime registry tracks session-scoped runtime entries", () => {
  resetSessionRuntimeRegistryForTests();

  const runtime = {
    documentBridge: {
      getDocument: async () => ({ xml: "<mxfile />" }),
    },
    getState: () => ({
      isReady: true,
      sessionId: "session-1",
      status: "idle",
    }),
  };

  registerSessionRuntime("session-1", runtime);

  assert.equal(getSessionRuntime("session-1"), runtime);
  assert.deepEqual(listOpenSessions(), ["session-1"]);
  assert.deepEqual(getSessionStatus("session-1"), {
    isReady: true,
    sessionId: "session-1",
    status: "idle",
  });

  unregisterSessionRuntime("session-1");

  assert.equal(getSessionRuntime("session-1"), null);
  assert.deepEqual(listOpenSessions(), []);
  assert.equal(getSessionStatus("session-1"), null);
});

test("session runtime registry rejects overlapping actions for the same session but allows different sessions", async () => {
  resetSessionRuntimeRegistryForTests();

  let releaseFirstAction: (() => void) | null = null;
  const firstAction = runSessionDocumentAction("session-1", async () => {
    await new Promise<void>((resolve) => {
      releaseFirstAction = resolve;
    });
    return "first-done";
  });

  await Promise.resolve();

  await assert.rejects(
    () => runSessionDocumentAction("session-1", async () => "second-done"),
    /SESSION_BUSY/
  );

  const otherSessionResult = await runSessionDocumentAction("session-2", async () => "other-done");
  assert.equal(otherSessionResult, "other-done");

  releaseFirstAction?.();
  assert.equal(await firstAction, "first-done");
});
