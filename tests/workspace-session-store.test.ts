import test from "node:test";
import assert from "node:assert/strict";

import {
  createWorkspaceSessionStore,
  type WorkspaceSessionSummary,
} from "../app/(internal)/_lib/workspace-session-store.ts";

const alpha: WorkspaceSessionSummary = {
  id: "alpha",
  isReady: false,
  title: "Alpha",
  updatedAt: "2026-03-19T10:00:00.000Z",
};

const beta: WorkspaceSessionSummary = {
  id: "beta",
  isReady: true,
  title: "Beta",
  updatedAt: "2026-03-19T10:05:00.000Z",
};

test("enterSessionDetail replaces opened sessions with the selected session", () => {
  const store = createWorkspaceSessionStore();

  store.getState().enterSessionDetail(alpha);

  assert.deepEqual(store.getState().openedSessions, [alpha]);
  assert.equal(store.getState().activeSessionId, "alpha");
});

test("openSession appends without duplication and activates the target session", () => {
  const store = createWorkspaceSessionStore();

  store.getState().enterSessionDetail(alpha);
  store.getState().openSession(beta);
  store.getState().openSession(alpha);

  assert.deepEqual(store.getState().openedSessions, [alpha, beta]);
  assert.equal(store.getState().activeSessionId, "alpha");
});

test("openSession can append a session without changing the current active session", () => {
  const store = createWorkspaceSessionStore();

  store.getState().enterSessionDetail(alpha);
  store.getState().openSession(beta, { activate: false });

  assert.deepEqual(store.getState().openedSessions, [alpha, beta]);
  assert.equal(store.getState().activeSessionId, "alpha");
});

test("closeSession removes the target and falls back to the nearest remaining session", () => {
  const store = createWorkspaceSessionStore();

  store.getState().enterSessionDetail(alpha);
  store.getState().openSession(beta);
  store.getState().closeSession("beta");

  assert.deepEqual(store.getState().openedSessions, [alpha]);
  assert.equal(store.getState().activeSessionId, "alpha");
});

test("activateSession only updates the active session id", () => {
  const store = createWorkspaceSessionStore();

  store.getState().enterSessionDetail(alpha);
  store.getState().openSession(beta);
  store.getState().activateSession("alpha");

  assert.deepEqual(store.getState().openedSessions, [alpha, beta]);
  assert.equal(store.getState().activeSessionId, "alpha");
});

test("resetSessionDetail clears the whole detail session lifecycle", () => {
  const store = createWorkspaceSessionStore();

  store.getState().enterSessionDetail(alpha);
  store.getState().resetSessionDetail();

  assert.deepEqual(store.getState().openedSessions, []);
  assert.equal(store.getState().activeSessionId, "");
});
