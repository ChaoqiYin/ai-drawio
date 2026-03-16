import assert from "node:assert/strict";
import test from "node:test";

import {
  buildControlEnvelope,
  extractResolvedSessionId,
  getSessionResolutionCommand,
  parseCliArgs
} from "../scripts/ai-drawio-cli.ts";

test("parseCliArgs parses session open", () => {
  const parsed = parseCliArgs(["session", "open", "--id", "sess-1"]);

  assert.equal(parsed.command, "session.open");
  assert.equal(parsed.sessionId, "sess-1");
});

test("parseCliArgs parses conversation create", () => {
  const parsed = parseCliArgs(["conversation", "create"]);

  assert.equal(parsed.command, "conversation.create");
  assert.equal(parsed.sessionId, null);
  assert.equal(parsed.outputFile, null);
  assert.deepEqual(parsed.payload, {});
});

test("parseCliArgs parses canvas document get with output file", () => {
  const parsed = parseCliArgs([
    "canvas",
    "document.get",
    "--session",
    "sess-2",
    "--output-file",
    "./current.xml"
  ]);

  assert.equal(parsed.command, "canvas.document.get");
  assert.equal(parsed.outputFile, "./current.xml");
  assert.equal(parsed.sessionId, "sess-2");
});

test("parseCliArgs allows canvas document get without session id", () => {
  const parsed = parseCliArgs(["canvas", "document.get", "--output-file", "./current.xml"]);

  assert.equal(parsed.command, "canvas.document.get");
  assert.equal(parsed.outputFile, "./current.xml");
  assert.equal(parsed.sessionId, null);
});

test("parseCliArgs parses canvas document apply with xml file", () => {
  const parsed = parseCliArgs([
    "canvas",
    "document.apply",
    "--session",
    "sess-3",
    "--xml-file",
    "./next.xml",
    "--base-version",
    "sha256:abc"
  ]);

  assert.equal(parsed.command, "canvas.document.apply");
  assert.equal(parsed.payload.xmlFile, "./next.xml");
  assert.equal(parsed.payload.baseVersion, "sha256:abc");
});

test("parseCliArgs allows canvas document apply without session id", () => {
  const parsed = parseCliArgs([
    "canvas",
    "document.apply",
    "--xml-file",
    "./next.xml",
    "--base-version",
    "sha256:def"
  ]);

  assert.equal(parsed.command, "canvas.document.apply");
  assert.equal(parsed.sessionId, null);
  assert.equal(parsed.payload.xmlFile, "./next.xml");
  assert.equal(parsed.payload.baseVersion, "sha256:def");
});

test("getSessionResolutionCommand uses session.ensure when session id is omitted", () => {
  const parsed = parseCliArgs(["canvas", "document.get"]);
  const resolution = getSessionResolutionCommand(parsed);

  assert.deepEqual(resolution, {
    command: "session.ensure",
    sessionId: null
  });
});

test("getSessionResolutionCommand uses session.open when a session id is provided", () => {
  const parsed = parseCliArgs(["canvas", "document.get", "--session", "sess-9"]);
  const resolution = getSessionResolutionCommand(parsed);

  assert.deepEqual(resolution, {
    command: "session.open",
    sessionId: "sess-9"
  });
});

test("extractResolvedSessionId reads the ensured session id from control response data", () => {
  const sessionId = extractResolvedSessionId({
    ok: true,
    data: {
      route: "/session?id=sess-12",
      sessionId: "sess-12"
    },
    sessionId: null
  });

  assert.equal(sessionId, "sess-12");
});

test("extractResolvedSessionId falls back to the top-level session id for explicit opens", () => {
  const sessionId = extractResolvedSessionId({
    ok: true,
    data: {
      route: "/session?id=sess-14"
    },
    sessionId: "sess-14"
  });

  assert.equal(sessionId, "sess-14");
});

test("buildControlEnvelope creates the control payload shape", async () => {
  const envelope = await buildControlEnvelope({
    command: "status",
    outputFile: null,
    payload: {},
    sessionId: null
  });

  assert.equal(envelope.command, "status");
  assert.equal(envelope.source.name, "ai-drawio-cli");
  assert.equal(typeof envelope.requestId, "string");
  assert.equal(envelope.sessionId, null);
});
