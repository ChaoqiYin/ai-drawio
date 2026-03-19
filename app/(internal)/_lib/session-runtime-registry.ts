export type SessionRuntimeStatus = {
  isReady: boolean;
  sessionId: string;
  status: string;
};

export type SessionRuntimeEntry = {
  documentBridge: object;
  getState: () => SessionRuntimeStatus;
};

type SessionShellControls = {
  ensureSessionTab?: (sessionId?: string) => Promise<{ id: string } | null> | { id: string } | null;
  openSessionTab?: (sessionId: string, title?: string) => Promise<void> | void;
};

const sessionRuntimes = new Map<string, SessionRuntimeEntry>();
const busySessions = new Set<string>();
let sessionShellControls: SessionShellControls = {};

export function registerSessionRuntime(sessionId: string, entry: SessionRuntimeEntry): void {
  sessionRuntimes.set(sessionId, entry);
}

export function unregisterSessionRuntime(sessionId: string): void {
  sessionRuntimes.delete(sessionId);
}

export function getSessionRuntime(sessionId: string): SessionRuntimeEntry | null {
  return sessionRuntimes.get(sessionId) ?? null;
}

export function listOpenSessions(): string[] {
  return [...sessionRuntimes.keys()];
}

export function getSessionStatus(sessionId: string): SessionRuntimeStatus | null {
  return sessionRuntimes.get(sessionId)?.getState() ?? null;
}

export function setSessionShellControls(nextControls: SessionShellControls): void {
  sessionShellControls = nextControls;
}

export function getSessionShellControls(): SessionShellControls {
  return sessionShellControls;
}

export async function runSessionDocumentAction<T>(
  sessionId: string,
  action: () => Promise<T> | T,
): Promise<T> {
  if (busySessions.has(sessionId)) {
    throw new Error(`SESSION_BUSY: session '${sessionId}' already has an active document action`);
  }

  busySessions.add(sessionId);

  try {
    return await action();
  } finally {
    busySessions.delete(sessionId);
  }
}

export function resetSessionRuntimeRegistryForTests(): void {
  sessionRuntimes.clear();
  busySessions.clear();
  sessionShellControls = {};
}
