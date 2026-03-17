#!/usr/bin/env -S node --experimental-strip-types

import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";

export const CONTROL_HOST = "127.0.0.1";
export const CONTROL_PORT = 47831;
export const DEFAULT_APP_COMMAND = "npm run dev";

export interface ParsedCommand {
  command: string;
  outputFile: string | null;
  payload: {
    baseVersion?: string | null;
    prompt?: string | null;
    title?: string | null;
    xmlFile?: string | null;
    xmlFromStdin?: boolean;
  };
  sessionId: string | null;
}

export interface ControlEnvelope {
  command: string;
  payload: {
    xml?: string;
    baseVersion?: string;
    prompt?: string;
    title?: string;
  };
  requestId: string;
  sessionId: string | null;
  source: {
    type: "cli";
    name: string;
  };
  timeoutMs: number;
}

export interface SessionResolutionCommand {
  command: "session.ensure" | "session.open";
  payload: {
    title?: string;
  };
  sessionId: string | null;
}

function buildBaseEnvelope(
  command: string,
  sessionId: string | null,
  payload: ControlEnvelope["payload"] = {}
): ControlEnvelope {
  return {
    command,
    payload,
    requestId: randomUUID(),
    sessionId,
    source: {
      type: "cli",
      name: "ai-drawio-cli"
    },
    timeoutMs: 20_000
  };
}

function fail(message: string): never {
  const error = new Error(message);
  (error as Error & { isCliError?: boolean }).isCliError = true;
  throw error;
}

function takeFlag(args: string[], flagName: string): string | null {
  const index = args.indexOf(flagName);
  if (index === -1) {
    return null;
  }

  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    fail(`缺少 ${flagName} 的值`);
  }

  args.splice(index, 2);
  return value;
}

function takeBooleanFlag(args: string[], flagName: string): boolean {
  const index = args.indexOf(flagName);
  if (index === -1) {
    return false;
  }

  args.splice(index, 1);
  return true;
}

export function parseCliArgs(argv: string[]): ParsedCommand {
  const args = [...argv];
  const root = args.shift();

  if (!root) {
    fail("缺少命令");
  }

  if (root === "open" || root === "status") {
    if (args.length > 0) {
      fail(`命令 ${root} 不接受额外参数`);
    }

    return {
      command: root,
      outputFile: null,
      payload: {},
      sessionId: null
    };
  }

  if (root === "conversation") {
    const action = args.shift();
    if (action !== "create") {
      fail("conversation 仅支持 create");
    }

    if (args.length > 0) {
      fail(`未知参数: ${args.join(" ")}`);
    }

    return {
      command: "conversation.create",
      outputFile: null,
      payload: {},
      sessionId: null
    };
  }

  if (root === "session") {
    const action = args.shift();
    if (action === "list") {
      if (args.length > 0) {
        fail(`未知参数: ${args.join(" ")}`);
      }

      return {
        command: "session.list",
        outputFile: null,
        payload: {},
        sessionId: null
      };
    }

    if (action === "get") {
      const sessionId = takeFlag(args, "--id");
      const title = takeFlag(args, "--title");

      if (sessionId && title) {
        fail("session.get 不能同时使用 --id 和 --title");
      }

      if (!sessionId && !title) {
        fail("session.get 需要 --id 或 --title");
      }

      if (args.length > 0) {
        fail(`未知参数: ${args.join(" ")}`);
      }

      return {
        command: "session.get",
        outputFile: null,
        payload: {
          title: title || null
        },
        sessionId
      };
    }

    if (action !== "open") {
      fail("session 仅支持 open、get 或 list");
    }

    const sessionId = takeFlag(args, "--id");
    const title = takeFlag(args, "--title");

    if (sessionId && title) {
      fail("session.open 不能同时使用 --id 和 --title");
    }

    if (!sessionId && !title) {
      fail("session.open 需要 --id 或 --title");
    }

    if (args.length > 0) {
      fail(`未知参数: ${args.join(" ")}`);
    }

    return {
      command: "session.open",
      outputFile: null,
      payload: {
        title: title || null
      },
      sessionId
    };
  }

  if (root === "canvas") {
    const subcommand = args.shift();
    const sessionId = takeFlag(args, "--session");
    const sessionTitle = takeFlag(args, "--session-title");
    const outputFile = takeFlag(args, "--output-file");

    if (sessionId && sessionTitle) {
      fail("canvas 命令不能同时使用 --session 和 --session-title");
    }

    if (subcommand === "document.get") {
      if (args.length > 0) {
        fail(`未知参数: ${args.join(" ")}`);
      }

      return {
        command: "canvas.document.get",
        outputFile,
        payload: {
          title: sessionTitle || null
        },
        sessionId
      };
    }

    if (subcommand === "document.svg") {
      if (args.length > 0) {
        fail(`未知参数: ${args.join(" ")}`);
      }

      return {
        command: "canvas.document.svg",
        outputFile,
        payload: {
          title: sessionTitle || null
        },
        sessionId
      };
    }

    if (subcommand === "document.apply") {
      const xmlFile = takeFlag(args, "--xml-file");
      const xmlFromStdin = takeBooleanFlag(args, "--xml-stdin");
      const baseVersion = takeFlag(args, "--base-version");
      const prompt = takeFlag(args, "--prompt");

      if (!xmlFile && !xmlFromStdin) {
        fail("document.apply 需要 --xml-file 或 --xml-stdin");
      }

      if (xmlFile && xmlFromStdin) {
        fail("document.apply 不能同时使用 --xml-file 和 --xml-stdin");
      }

      if (args.length > 0) {
        fail(`未知参数: ${args.join(" ")}`);
      }

      return {
        command: "canvas.document.apply",
        outputFile,
        payload: {
          baseVersion: baseVersion || null,
          prompt: prompt || null,
          title: sessionTitle || null,
          xmlFile,
          xmlFromStdin
        },
        sessionId
      };
    }

    if (subcommand === "document.restore") {
      const xmlFile = takeFlag(args, "--xml-file");
      const xmlFromStdin = takeBooleanFlag(args, "--xml-stdin");
      const baseVersion = takeFlag(args, "--base-version");

      if (!xmlFile && !xmlFromStdin) {
        fail("document.restore 需要 --xml-file 或 --xml-stdin");
      }

      if (xmlFile && xmlFromStdin) {
        fail("document.restore 不能同时使用 --xml-file 和 --xml-stdin");
      }

      if (args.length > 0) {
        fail(`未知参数: ${args.join(" ")}`);
      }

      return {
        command: "canvas.document.restore",
        outputFile,
        payload: {
          baseVersion: baseVersion || null,
          title: sessionTitle || null,
          xmlFile,
          xmlFromStdin
        },
        sessionId
      };
    }
  }

  fail(`未知命令: ${root}`);
}

async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    process.stdin.on("error", reject);
  });
}

export async function buildControlEnvelope(
  parsedCommand: ParsedCommand
): Promise<ControlEnvelope> {
  let payload: ControlEnvelope["payload"] = {};

  if (
    parsedCommand.command === "canvas.document.apply" ||
    parsedCommand.command === "canvas.document.restore"
  ) {
    const xml = parsedCommand.payload.xmlFile
      ? await fs.readFile(parsedCommand.payload.xmlFile, "utf8")
      : await readStdin();

    payload = {
      xml
    };

    if (parsedCommand.payload.baseVersion) {
      payload.baseVersion = parsedCommand.payload.baseVersion;
    }

    if (parsedCommand.payload.prompt) {
      payload.prompt = parsedCommand.payload.prompt;
    }
  }

  if (parsedCommand.command === "session.open" && parsedCommand.payload.title) {
    payload.title = parsedCommand.payload.title;
  }

  return buildBaseEnvelope(parsedCommand.command, parsedCommand.sessionId, payload);
}

export function getSessionResolutionCommand(
  parsedCommand: ParsedCommand
): SessionResolutionCommand {
  if (
    parsedCommand.command !== "canvas.document.get" &&
    parsedCommand.command !== "canvas.document.svg" &&
    parsedCommand.command !== "canvas.document.apply" &&
    parsedCommand.command !== "canvas.document.restore"
  ) {
    fail(`命令 ${parsedCommand.command} 不需要会话解析`);
  }

  if (parsedCommand.sessionId) {
    return {
      command: "session.open",
      payload: {},
      sessionId: parsedCommand.sessionId
    };
  }

  if (parsedCommand.payload.title) {
    return {
      command: "session.open",
      payload: {
        title: parsedCommand.payload.title
      },
      sessionId: null
    };
  }

  return {
    command: "session.ensure",
    payload: {},
    sessionId: null
  };
}

export function extractResolvedSessionId(response: Record<string, any>): string {
  const dataSessionId =
    typeof response.data?.sessionId === "string" ? response.data.sessionId.trim() : "";
  if (dataSessionId) {
    return dataSessionId;
  }

  const topLevelSessionId =
    typeof response.sessionId === "string" ? response.sessionId.trim() : "";
  if (topLevelSessionId) {
    return topLevelSessionId;
  }

  fail("控制响应缺少可用的会话编号");
}

export function getAppLaunchCommand(env: NodeJS.ProcessEnv = process.env): string {
  return env.AI_DRAWIO_APP_CMD || DEFAULT_APP_COMMAND;
}

export function requestControl(
  envelope: ControlEnvelope
): Promise<Record<string, any>> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(envelope);
    const request = http.request(
      {
        host: CONTROL_HOST,
        port: CONTROL_PORT,
        path: "/control",
        method: "POST",
        headers: {
          "Content-Length": Buffer.byteLength(body),
          "Content-Type": "application/json"
        }
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        response.on("end", () => {
          try {
            const payload = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
            resolve(payload);
          } catch (error) {
            reject(error);
          }
        });
      }
    );

    request.on("error", reject);
    request.write(body);
    request.end();
  });
}

async function waitForControlServer(timeoutMs = 20_000): Promise<Record<string, any>> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await requestControl({
        command: "status",
        payload: {},
        requestId: randomUUID(),
        sessionId: null,
        source: {
          type: "cli",
          name: "ai-drawio-cli"
        },
        timeoutMs: 5_000
      });

      if (response.ok) {
        return response;
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  fail("应用控制服务未就绪");
}

async function ensureDesktopApp(): Promise<boolean> {
  try {
    await requestControl({
      command: "status",
      payload: {},
      requestId: randomUUID(),
      sessionId: null,
      source: {
        type: "cli",
        name: "ai-drawio-cli"
      },
      timeoutMs: 5_000
    });

    return false;
  } catch {
    const command = getAppLaunchCommand();
    const child = spawn(command, {
      detached: true,
      shell: true,
      stdio: "ignore"
    });

    child.unref();
    await waitForControlServer();
    return true;
  }
}

export async function executeCli(argv: string[]): Promise<Record<string, any>> {
  const parsedCommand = parseCliArgs(argv);

  if (
    parsedCommand.command === "open" ||
    parsedCommand.command === "conversation.create" ||
    parsedCommand.command === "session.get" ||
    parsedCommand.command === "session.list"
  ) {
    const launched = await ensureDesktopApp();
    const response = await requestControl(await buildControlEnvelope(parsedCommand));
    return {
      ...response,
      data: {
        ...(response.data || {}),
        launched
      }
    };
  }

  if (
    parsedCommand.command === "canvas.document.get" ||
    parsedCommand.command === "canvas.document.svg" ||
    parsedCommand.command === "canvas.document.apply" ||
    parsedCommand.command === "canvas.document.restore"
  ) {
    const launched = await ensureDesktopApp();
    const resolution = getSessionResolutionCommand(parsedCommand);
    const resolutionResponse = await requestControl(
      buildBaseEnvelope(resolution.command, resolution.sessionId, resolution.payload)
    );

    if (!resolutionResponse.ok) {
      return {
        ...resolutionResponse,
        data: {
          ...(resolutionResponse.data || {}),
          launched
        }
      };
    }

    const envelope = await buildControlEnvelope(parsedCommand);
    envelope.sessionId = extractResolvedSessionId(resolutionResponse);

    const response = await requestControl(envelope);

    if (
      parsedCommand.outputFile &&
      response.ok &&
      typeof response.data?.xml === "string"
    ) {
      await fs.writeFile(parsedCommand.outputFile, response.data.xml, "utf8");
    }

    return {
      ...response,
      data: {
        ...(response.data || {}),
        launched
      }
    };
  }

  const response = await requestControl(await buildControlEnvelope(parsedCommand));

  if (
    parsedCommand.outputFile &&
    response.ok &&
    typeof response.data?.xml === "string"
  ) {
    await fs.writeFile(parsedCommand.outputFile, response.data.xml, "utf8");
  }

  return response;
}

async function main(): Promise<void> {
  try {
    const response = await executeCli(process.argv.slice(2));
    process.stdout.write(`${JSON.stringify(response, null, 2)}\n`);
    process.exitCode = response.ok ? 0 : 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stdout.write(
      `${JSON.stringify(
        {
          ok: false,
          error: {
            code: "CLI_ERROR",
            message
          }
        },
        null,
        2
      )}\n`
    );
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
